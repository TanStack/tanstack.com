import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { promises as fs } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { EventType, type StreamChunk } from '@tanstack/ai'
import {
  parseNotebookAiExecution,
  type NotebookAiExecution,
  type NotebookAiMessage,
  type NotebookAiResponse,
} from '../src/utils/notebook-ai'
import {
  getChangedNotebookAiFiles,
  installNotebookAiPackage,
  listNotebookAiFiles,
  readNotebookAiFile,
  replaceNotebookAiFile,
  upgradeNotebookAiWorkspaceToWebContainer,
  type NotebookAiWorkspaceState,
} from '../src/utils/notebook-ai-workspace'
import { notebookImportAliases } from '../src/utils/notebook-environment'

const maxRequestBytes = 2 * 1024 * 1024
const maxActionRequestBytes = 16 * 1024
const maxResponseBytes = 4 * 1024 * 1024
const maxMessages = 20
const maxWireMessages = 100
const maxMessageCharacters = 10_000
const maxReadCharacters = 50_000
const maxToolResultCharacters = 400_000
const maxNpmResponseBytes = 64 * 1024
const npmPackageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const configuredPort = Number(process.env.NOTEBOOK_AI_PORT ?? '0')
const codexHome = path.resolve(
  process.env.CODEX_HOME ?? '.cache/notebook-ai/codex-home',
)

if (
  !Number.isInteger(configuredPort) ||
  configuredPort < 0 ||
  configuredPort > 65_535
) {
  throw new Error('Invalid notebook AI bridge port')
}

await fs.mkdir(codexHome, { recursive: true, mode: 0o700 })
await fs.chmod(codexHome, 0o700)

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  signal?: AbortSignal
  abort?: () => void
}

type RequestOptions = {
  timeoutMs?: number
  signal?: AbortSignal
  onAbortedResult?: (value: unknown) => void
}

type TurnWaiter = {
  stream: AgentStreamContext
  resolve: (message: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  signal: AbortSignal
  abort: () => void
  turnId?: string
}

type ToolContext = {
  execution: NotebookAiExecution
  originalExecution: NotebookAiExecution
  hiddenFiles: ReadonlyArray<string>
  signal: AbortSignal
  stream: AgentStreamContext
  resultCharacters: number
}

type AgentMessageState = {
  text: string
  ended: boolean
}

type ReasoningState = {
  activeMessageId?: string
  activeSummaryIndex?: number
}

type AgentStreamContext = {
  threadId: string
  runId: string
  emit: (event: StreamChunk) => void
  agentMessages: Map<string, AgentMessageState>
  reasoning: Map<string, ReasoningState>
  lastAgentMessageId?: string
}

class AppServerClient {
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private turns = new Map<string, TurnWaiter>()
  private toolContexts = new Map<string, ToolContext>()
  private child = spawn(
    process.env.CODEX_BINARY ?? 'codex',
    ['app-server', '--disable', 'plugins'],
    {
      cwd: os.tmpdir(),
      env: { ...process.env, CODEX_HOME: codexHome },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )

  readonly ready = this.initialize()

  constructor() {
    readline
      .createInterface({ input: this.child.stdout })
      .on('line', (line) => this.receive(line))

    // Drain diagnostics without forwarding them. App Server owns credentials.
    this.child.stderr.resume()
    this.child.once('error', (error) => this.close(error))
    this.child.once('exit', (code, signal) => {
      this.close(
        new Error(`Codex App Server exited (${code ?? signal ?? 'unknown'})`),
      )
    })
  }

  async readAccount() {
    await this.ready
    const response = await this.request('account/read', {
      refreshToken: false,
    })
    if (!isRecord(response) || !isRecord(response.account)) {
      return { connected: false, models: [] }
    }
    const account = response.account
    if (account.type !== 'chatgpt') {
      return { connected: false, models: [] }
    }

    return {
      connected: true,
      ...(typeof account.email === 'string' ? { email: account.email } : {}),
      ...(typeof account.planType === 'string'
        ? { planType: account.planType }
        : {}),
      models: await this.listModels(),
    }
  }

  async startLogin() {
    await this.ready
    const response = await this.request('account/login/start', {
      type: 'chatgptDeviceCode',
    })
    if (
      !isRecord(response) ||
      response.type !== 'chatgptDeviceCode' ||
      typeof response.loginId !== 'string' ||
      !response.loginId ||
      typeof response.verificationUrl !== 'string' ||
      !response.verificationUrl ||
      typeof response.userCode !== 'string' ||
      !response.userCode
    ) {
      throw new Error('OpenAI did not return a device login')
    }
    return {
      loginId: response.loginId,
      verificationUrl: response.verificationUrl,
      userCode: response.userCode,
    }
  }

  async cancelLogin(loginId: string) {
    await this.ready
    await this.request('account/login/cancel', { loginId })
  }

  async logout() {
    await this.ready
    await this.request('account/logout')
  }

  async editNotebook(
    input: NotebookChatGptRequest,
    signal: AbortSignal,
    emit: (event: StreamChunk) => void,
  ): Promise<NotebookAiResponse> {
    await this.ready
    throwIfAborted(signal)
    const models = await this.listModels(signal)
    if (!models.some((model) => model.id === input.model)) {
      throw new HttpError(400, `Unsupported OpenAI model: ${input.model}`)
    }

    const runDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tanstack-notebook-ai-'),
    )
    await fs.chmod(runDirectory, 0o700)

    let threadId: string | undefined
    try {
      const stream: AgentStreamContext = {
        threadId: input.threadId,
        runId: input.runId,
        emit,
        agentMessages: new Map(),
        reasoning: new Map(),
      }
      const context: ToolContext = {
        execution: input.execution,
        originalExecution: input.execution,
        hiddenFiles: input.hiddenFiles,
        signal,
        stream,
        resultCharacters: 0,
      }
      const threadResponse = await this.request(
        'thread/start',
        {
          model: input.model,
          cwd: runDirectory,
          approvalPolicy: 'never',
          sandbox: 'read-only',
          developerInstructions: notebookDeveloperInstructions,
          dynamicTools: notebookDynamicTools,
          environments: [],
          ephemeral: true,
        },
        { timeoutMs: 60_000, signal },
      )
      const activeThreadId = readThreadId(threadResponse)
      threadId = activeThreadId
      throwIfAborted(signal)
      this.toolContexts.set(activeThreadId, context)

      const turn = this.waitForTurn(activeThreadId, signal, stream)
      try {
        const turnResponse = await this.request(
          'turn/start',
          {
            threadId: activeThreadId,
            input: [
              {
                type: 'text',
                text: formatConversation(input.messages),
                text_elements: [],
              },
            ],
          },
          {
            timeoutMs: 60_000,
            signal,
            onAbortedResult: (value) => {
              try {
                void this.interruptTurn(activeThreadId, readTurnId(value))
              } catch {
                // A failed turn start has no turn to interrupt.
              }
            },
          },
        )
        const turnId = readTurnId(turnResponse)
        turn.setTurnId(turnId)
      } catch (error) {
        turn.reject(toError(error))
        throw error
      }

      const message = await turn.promise
      const execution = context.execution
      return {
        message: message.trim() || 'Notebook changes are ready.',
        execution,
        changedFiles: getChangedNotebookAiFiles(
          context.originalExecution.workspace,
          execution.workspace,
        ),
        runtimeChanged:
          JSON.stringify(context.originalExecution.runtime) !==
          JSON.stringify(execution.runtime),
      }
    } finally {
      if (threadId) this.toolContexts.delete(threadId)
      await fs.rm(runDirectory, { recursive: true, force: true })
    }
  }

  private async initialize() {
    await this.request('initialize', {
      clientInfo: {
        name: 'tanstack-notebook',
        title: 'TanStack Notebook',
        version: '0.1.0',
      },
      capabilities: { experimentalApi: true, requestAttestation: false },
    })
    this.write({ method: 'initialized' })
  }

  private async listModels(signal?: AbortSignal) {
    const models: Array<NotebookChatGptModel> = []
    let cursor: string | null = null

    do {
      const response = await this.request(
        'model/list',
        {
          includeHidden: false,
          limit: 100,
          cursor,
        },
        signal ? { signal } : undefined,
      )
      if (!isRecord(response) || !Array.isArray(response.data)) break
      models.push(...parseModels(response.data))
      cursor =
        typeof response.nextCursor === 'string' ? response.nextCursor : null
    } while (cursor && models.length < 200)

    return models.slice(0, 200)
  }

  private receive(line: string) {
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (!isRecord(message)) return

    if ('id' in message && !('method' in message)) {
      if (typeof message.id !== 'number') return
      const pending = this.takePendingRequest(message.id)
      if (!pending) return
      if (isRecord(message.error)) {
        pending.reject(
          new Error(
            typeof message.error.message === 'string'
              ? message.error.message
              : 'Codex App Server request failed',
          ),
        )
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (typeof message.method !== 'string') return
    if ('id' in message) {
      void this.respondToServerRequest(message)
      return
    }
    if (!isRecord(message.params)) return

    if (message.method === 'item/started') {
      this.startItem(message.params)
      return
    }

    if (message.method === 'item/completed') {
      this.completeItem(message.params)
      return
    }

    if (message.method === 'item/agentMessage/delta') {
      this.appendAgentMessage(message.params)
      return
    }

    if (message.method === 'item/reasoning/summaryPartAdded') {
      this.startReasoningPart(message.params)
      return
    }

    if (message.method === 'item/reasoning/summaryTextDelta') {
      this.appendReasoningSummary(message.params)
      return
    }

    if (
      message.method === 'turn/completed' &&
      typeof message.params.threadId === 'string'
    ) {
      this.completeTurn(message.params.threadId, message.params.turn)
    }
  }

  private startItem(params: Record<string, unknown>) {
    if (typeof params.threadId !== 'string' || !isRecord(params.item)) return
    const waiter = this.turns.get(params.threadId)
    if (!waiter) return
    const item = params.item
    if (item.type !== 'agentMessage' || typeof item.id !== 'string') return

    const state = ensureAgentMessage(waiter.stream, item.id)
    if (typeof item.text === 'string' && item.text) {
      appendMissingAgentText(waiter.stream, item.id, state, item.text)
    }
  }

  private completeItem(params: Record<string, unknown>) {
    if (typeof params.threadId !== 'string' || !isRecord(params.item)) return
    const waiter = this.turns.get(params.threadId)
    if (!waiter) return
    const item = params.item

    if (item.type === 'agentMessage' && typeof item.id === 'string') {
      const state = ensureAgentMessage(waiter.stream, item.id)
      if (typeof item.text === 'string' && item.text) {
        appendMissingAgentText(waiter.stream, item.id, state, item.text)
      }
      finishAgentMessage(waiter.stream, item.id, state)
      return
    }

    if (item.type === 'reasoning' && typeof item.id === 'string') {
      finishReasoning(waiter.stream, item.id)
    }
  }

  private appendAgentMessage(params: Record<string, unknown>) {
    if (
      typeof params.threadId !== 'string' ||
      typeof params.itemId !== 'string' ||
      typeof params.delta !== 'string'
    ) {
      return
    }
    const waiter = this.turns.get(params.threadId)
    if (!waiter) return
    const state = ensureAgentMessage(waiter.stream, params.itemId)
    if (state.ended) return
    state.text += params.delta
    waiter.stream.emit({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: params.itemId,
      delta: params.delta,
      timestamp: Date.now(),
    })
  }

  private startReasoningPart(params: Record<string, unknown>) {
    if (
      typeof params.threadId !== 'string' ||
      typeof params.itemId !== 'string' ||
      typeof params.summaryIndex !== 'number' ||
      !Number.isInteger(params.summaryIndex) ||
      params.summaryIndex < 0
    ) {
      return
    }
    const waiter = this.turns.get(params.threadId)
    if (!waiter) return
    ensureReasoningPart(waiter.stream, params.itemId, params.summaryIndex)
  }

  private appendReasoningSummary(params: Record<string, unknown>) {
    if (
      typeof params.threadId !== 'string' ||
      typeof params.itemId !== 'string' ||
      typeof params.delta !== 'string' ||
      typeof params.summaryIndex !== 'number' ||
      !Number.isInteger(params.summaryIndex) ||
      params.summaryIndex < 0
    ) {
      return
    }
    const waiter = this.turns.get(params.threadId)
    if (!waiter) return
    const messageId = ensureReasoningPart(
      waiter.stream,
      params.itemId,
      params.summaryIndex,
    )
    waiter.stream.emit({
      type: EventType.REASONING_MESSAGE_CONTENT,
      messageId,
      delta: params.delta,
      timestamp: Date.now(),
    })
  }

  private async respondToServerRequest(message: Record<string, unknown>) {
    if (typeof message.id !== 'number' && typeof message.id !== 'string') return

    if (message.method === 'item/tool/call') {
      const result = await this.callDynamicTool(message.params)
      this.write({ id: message.id, result })
      return
    }

    if (
      message.method === 'applyPatchApproval' ||
      message.method === 'execCommandApproval' ||
      message.method === 'item/commandExecution/requestApproval' ||
      message.method === 'item/fileChange/requestApproval'
    ) {
      this.write({ id: message.id, result: { decision: 'decline' } })
      return
    }

    if (message.method === 'item/permissions/requestApproval') {
      this.write({
        id: message.id,
        result: {
          permissions: { fileSystem: null, network: null },
          scope: 'turn',
        },
      })
      return
    }

    this.write({
      id: message.id,
      error: {
        code: -32601,
        message: `Unsupported server request: ${String(message.method)}`,
      },
    })
  }

  private async callDynamicTool(params: unknown) {
    if (
      !isRecord(params) ||
      typeof params.threadId !== 'string' ||
      typeof params.callId !== 'string' ||
      !params.callId ||
      typeof params.tool !== 'string' ||
      (params.namespace !== null && params.namespace !== undefined)
    ) {
      return dynamicToolFailure('Invalid notebook tool call')
    }

    const context = this.toolContexts.get(params.threadId)
    if (!context) return dynamicToolFailure('Notebook edit is no longer active')

    const argumentsJson = serializeJson(params.arguments)
    context.stream.emit({
      type: EventType.TOOL_CALL_START,
      toolCallId: params.callId,
      toolCallName: params.tool,
      toolName: params.tool,
      ...(context.stream.lastAgentMessageId
        ? { parentMessageId: context.stream.lastAgentMessageId }
        : {}),
      timestamp: Date.now(),
    })
    context.stream.emit({
      type: EventType.TOOL_CALL_ARGS,
      toolCallId: params.callId,
      delta: argumentsJson,
      args: argumentsJson,
      timestamp: Date.now(),
    })
    context.stream.emit({
      type: EventType.TOOL_CALL_END,
      toolCallId: params.callId,
      toolCallName: params.tool,
      toolName: params.tool,
      input: params.arguments,
      timestamp: Date.now(),
    })

    try {
      throwIfAborted(context.signal)
      const result = await runNotebookTool(
        context,
        params.tool,
        params.arguments,
      )
      const content = JSON.stringify(result)
      context.resultCharacters += content.length
      if (context.resultCharacters > maxToolResultCharacters) {
        throw new Error('Notebook AI tool output limit reached')
      }
      context.stream.emit({
        type: EventType.TOOL_CALL_RESULT,
        messageId: `${params.callId}:result`,
        toolCallId: params.callId,
        content,
        role: 'tool',
        state: 'output-available',
        timestamp: Date.now(),
      })
      return {
        contentItems: [{ type: 'inputText', text: content }],
        success: true,
      }
    } catch (error) {
      const message = formatError(error)
      context.stream.emit({
        type: EventType.TOOL_CALL_RESULT,
        messageId: `${params.callId}:result`,
        toolCallId: params.callId,
        content: JSON.stringify({ error: message }),
        role: 'tool',
        state: 'output-error',
        timestamp: Date.now(),
      })
      return dynamicToolFailure(message)
    }
  }

  private request(
    method: string,
    params?: unknown,
    options: RequestOptions = {},
  ) {
    const timeoutMs = options.timeoutMs ?? 30_000
    if (options.signal?.aborted) {
      return Promise.reject(new Error('Notebook edit was canceled'))
    }

    const id = this.nextId++
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.takePendingRequest(id)
        pending?.reject(new Error(`Codex App Server timed out: ${method}`))
      }, timeoutMs)
      const abort = options.signal
        ? () => {
            const pending = this.pending.get(id)
            if (!pending) return

            if (options.onAbortedResult) {
              if (pending.signal && pending.abort) {
                pending.signal.removeEventListener('abort', pending.abort)
              }
              delete pending.signal
              delete pending.abort
              pending.resolve = options.onAbortedResult
              pending.reject = () => undefined
              reject(new Error('Notebook edit was canceled'))
              return
            }

            this.takePendingRequest(id)?.reject(
              new Error('Notebook edit was canceled'),
            )
          }
        : undefined
      const pending: PendingRequest = {
        resolve,
        reject,
        timeout,
        ...(options.signal && abort ? { signal: options.signal, abort } : {}),
      }
      this.pending.set(id, pending)
      if (options.signal && abort) {
        options.signal.addEventListener('abort', abort, { once: true })
      }

      try {
        this.write({ method, id, params })
      } catch (error) {
        this.takePendingRequest(id)?.reject(toError(error))
      }
    })
  }

  private takePendingRequest(id: number) {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    clearTimeout(pending.timeout)
    if (pending.signal && pending.abort) {
      pending.signal.removeEventListener('abort', pending.abort)
    }
    return pending
  }

  private write(message: object) {
    if (!this.child.stdin.writable) {
      throw new Error('Codex App Server is unavailable')
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private waitForTurn(
    threadId: string,
    signal: AbortSignal,
    stream: AgentStreamContext,
  ) {
    let resolvePromise: (message: string) => void = () => undefined
    let rejectPromise: (error: Error) => void = () => undefined
    const promise = new Promise<string>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })
    void promise.catch(() => undefined)
    const abort = () => {
      const turn = this.turns.get(threadId)
      if (!turn) return
      finishOpenStreamItems(turn.stream)
      this.finishTurn(threadId)
      rejectPromise(new Error('Notebook edit was canceled'))
      if (turn.turnId) void this.interruptTurn(threadId, turn.turnId)
    }
    const timeout = setTimeout(() => {
      const turn = this.turns.get(threadId)
      if (!turn) return
      finishOpenStreamItems(turn.stream)
      this.finishTurn(threadId)
      rejectPromise(new Error('Codex timed out while editing the notebook'))
      if (turn.turnId) void this.interruptTurn(threadId, turn.turnId)
    }, 100_000)
    const waiter: TurnWaiter = {
      stream,
      resolve: resolvePromise,
      reject: rejectPromise,
      timeout,
      signal,
      abort,
    }
    this.turns.set(threadId, waiter)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()

    return {
      promise,
      setTurnId: (turnId: string) => {
        const active = this.turns.get(threadId)
        if (active) active.turnId = turnId
        else if (signal.aborted) void this.interruptTurn(threadId, turnId)
      },
      reject: (error: Error) => {
        const active = this.turns.get(threadId)
        if (!active) return
        finishOpenStreamItems(active.stream)
        this.finishTurn(threadId)
        rejectPromise(error)
      },
    }
  }

  private completeTurn(threadId: string, value: unknown) {
    const waiter = this.turns.get(threadId)
    if (!waiter) return
    finishOpenStreamItems(waiter.stream)
    this.finishTurn(threadId)
    const turn = isRecord(value) ? value : undefined
    if (turn?.status !== 'completed') {
      waiter.reject(new Error(readTurnError(turn)))
      return
    }
    waiter.resolve(readAgentMessage(turn))
  }

  private finishTurn(threadId: string) {
    const waiter = this.turns.get(threadId)
    if (!waiter) return
    this.turns.delete(threadId)
    clearTimeout(waiter.timeout)
    waiter.signal.removeEventListener('abort', waiter.abort)
  }

  private async interruptTurn(threadId: string, turnId: string) {
    try {
      await this.request(
        'turn/interrupt',
        { threadId, turnId },
        { timeoutMs: 10_000 },
      )
    } catch {
      // The turn may have completed before the interrupt arrived.
    }
  }

  private close(error: Error) {
    for (const id of [...this.pending.keys()]) {
      this.takePendingRequest(id)?.reject(error)
    }
    for (const [threadId, waiter] of this.turns) {
      finishOpenStreamItems(waiter.stream)
      this.finishTurn(threadId)
      waiter.reject(error)
    }
    this.pending.clear()
    this.turns.clear()
    this.toolContexts.clear()
  }
}

type NotebookChatGptModel = {
  id: string
  label: string
  isDefault: boolean
}

type NotebookChatGptRequest = {
  threadId: string
  runId: string
  parentRunId?: string
  model: string
  messages: Array<NotebookAiMessage>
  execution: NotebookAiExecution
  hiddenFiles: ReadonlyArray<string>
}

const notebookDynamicTools = [
  dynamicTool(
    'describe_notebook',
    'Describe the notebook runtime, entry, built-in imports, workspace import overrides, and package manifest. Call this first.',
    objectSchema({}, []),
  ),
  dynamicTool(
    'list_files',
    'List editable text files in the notebook.',
    objectSchema({}, []),
  ),
  dynamicTool(
    'read_file',
    'Read an editable notebook text file. Reads at most 50,000 characters; use nextOffset to continue when the result is truncated.',
    objectSchema(
      {
        path: { type: 'string' },
        offset: { type: 'integer', minimum: 0 },
      },
      ['path'],
    ),
  ),
  dynamicTool(
    'replace_file',
    'Replace an existing editable notebook text file with complete new contents. Read it first and preserve unrelated code.',
    objectSchema({ path: { type: 'string' }, content: { type: 'string' } }, [
      'path',
      'content',
    ]),
  ),
  dynamicTool(
    'upgrade_runtime',
    'Upgrade a browser notebook to the full React/Vite WebContainer runtime. Use this before installing a package that is not built into the client runtime. The host creates the scaffold and fixed commands.',
    objectSchema({}, []),
  ),
  dynamicTool(
    'install_dependency',
    'Add or update one npm dependency in a WebContainer notebook. Call upgrade_runtime first when the current runtime is client. Supply an exact version or omit it to resolve the current version from npm. This updates package.json; the host runs pnpm install.',
    objectSchema(
      {
        name: { type: 'string', minLength: 1, maxLength: 214 },
        version: { type: 'string', minLength: 1, maxLength: 128 },
      },
      ['name'],
    ),
  ),
]

const notebookDeveloperInstructions =
  'You edit a TanStack Notebook exclusively through the provided notebook tools. Call describe_notebook first, then list_files and read every file you need before editing. Do not use shell or filesystem tools; the working directory is intentionally empty and read-only. Treat every library or framework named by the user as a requirement: never silently replace it with native CSS, another package, or a hand-built substitute. TanStack Charts is built into the client runtime: use Chart from @tanstack/charts/react, chart primitives such as barX or barY and defineChart from @tanstack/charts, and scales from @tanstack/charts/scales/linear or @tanstack/charts/scales/band. @tanstack/react-charts is obsolete. The client runtime supports the built-in imports returned by describe_notebook. If the request needs another npm package, call upgrade_runtime, then install_dependency; omit its version when you do not know the exact current version. Use replace_file only for requested changes and preserve unrelated code. If the latest message contains a compile or runtime error, fix it without removing a user-required library. Never claim a change you did not make. Finish with a short summary.'

const codex = new AppServerClient()

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')

  if (!isLocalRequest(request)) {
    sendJson(response, 403, { error: 'Local notebook AI access only' })
    return
  }

  const abortController = new AbortController()
  request.once('aborted', () => abortController.abort())
  response.once('close', () => {
    if (!response.writableEnded) abortController.abort()
  })

  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (request.method === 'GET' && url.pathname === '/account') {
      sendJson(response, 200, await codex.readAccount())
      return
    }
    if (request.method === 'POST' && url.pathname === '/login') {
      assertJsonRequest(request)
      const body = parseObject(await readBody(request, maxActionRequestBytes))
      if (!hasOnlyKeys(body, ['action']) || body.action !== 'login') {
        throw new HttpError(400, 'Invalid login request')
      }
      sendJson(response, 200, await codex.startLogin())
      return
    }
    if (request.method === 'POST' && url.pathname === '/login/cancel') {
      assertJsonRequest(request)
      const body = parseObject(await readBody(request, maxActionRequestBytes))
      if (
        !hasOnlyKeys(body, ['action', 'loginId']) ||
        (body.action !== undefined && body.action !== 'cancelLogin') ||
        typeof body.loginId !== 'string' ||
        !body.loginId ||
        body.loginId.length > 256
      ) {
        throw new HttpError(400, 'Invalid login cancellation')
      }
      await codex.cancelLogin(body.loginId)
      sendJson(response, 200, { canceled: true })
      return
    }
    if (request.method === 'POST' && url.pathname === '/logout') {
      assertJsonRequest(request)
      const body = parseObject(await readBody(request, maxActionRequestBytes))
      if (!hasOnlyKeys(body, ['action']) || body.action !== 'logout') {
        throw new HttpError(400, 'Invalid logout request')
      }
      await codex.logout()
      sendJson(response, 200, { disconnected: true })
      return
    }
    if (request.method === 'POST' && url.pathname === '/assist') {
      assertJsonRequest(request)
      const body = await readBody(request, maxRequestBytes)
      const input = parseAssistRequest(body)
      await streamNotebookEdit(response, input, abortController)
      return
    }
    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    if (!response.writableEnded && !response.destroyed) {
      if (response.headersSent) {
        response.end()
      } else {
        const status = error instanceof HttpError ? error.status : 502
        sendJson(response, status, { error: formatError(error) })
      }
    }
  }
})

server.once('error', () => {
  process.exitCode = 1
})
server.listen(configuredPort, '127.0.0.1', () => {
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Notebook AI bridge did not bind a TCP port')
  }
  process.stdout.write(
    `${JSON.stringify({ type: 'listening', port: address.port })}\n`,
  )
})

async function streamNotebookEdit(
  response: http.ServerResponse,
  input: NotebookChatGptRequest,
  abortController: AbortController,
) {
  const editAbortController = new AbortController()
  const abortEdit = () => editAbortController.abort()
  abortController.signal.addEventListener('abort', abortEdit, { once: true })
  if (abortController.signal.aborted) abortEdit()

  const overflowEvent = encodeServerSentEvent({
    type: EventType.RUN_ERROR,
    message: 'Notebook AI response is too large',
    timestamp: Date.now(),
  })
  const events = new AsyncEventQueue(
    maxResponseBytes - overflowEvent.byteLength,
    overflowEvent,
    abortEdit,
  )
  const emit = (event: StreamChunk) => {
    events.push(encodeServerSentEvent(event))
  }
  response.statusCode = 200
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders()
  emit({
    type: EventType.RUN_STARTED,
    threadId: input.threadId,
    runId: input.runId,
    ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
    timestamp: Date.now(),
  })

  const edit = (async () => {
    try {
      const result = await codex.editNotebook(
        input,
        editAbortController.signal,
        emit,
      )
      emit({
        type: EventType.CUSTOM,
        name: 'notebook.execution',
        value: result,
        threadId: input.threadId,
        runId: input.runId,
        timestamp: Date.now(),
      })
      emit({
        type: EventType.RUN_FINISHED,
        threadId: input.threadId,
        runId: input.runId,
        outcome: { type: 'success' },
        finishReason: 'stop',
        timestamp: Date.now(),
      })
    } catch (error) {
      emit({
        type: EventType.RUN_ERROR,
        message: formatError(error),
        timestamp: Date.now(),
      })
    } finally {
      events.close()
    }
  })()

  try {
    await Promise.all([
      writeServerSentEvents(response, events, abortController.signal),
      edit,
    ])
  } finally {
    abortController.signal.removeEventListener('abort', abortEdit)
    editAbortController.abort()
    abortController.abort()
  }
}

async function writeServerSentEvents(
  response: http.ServerResponse,
  events: AsyncIterable<Buffer>,
  signal: AbortSignal,
) {
  let size = 0
  for await (const chunk of events) {
    if (signal.aborted || response.destroyed) return
    size += chunk.byteLength
    if (size > maxResponseBytes) {
      throw new Error('Notebook AI response is too large')
    }
    if (!response.write(chunk)) {
      await once(response, 'drain', { signal })
    }
  }
  if (!response.writableEnded && !response.destroyed) response.end()
}

function encodeServerSentEvent(event: StreamChunk) {
  return Buffer.from(`data: ${JSON.stringify(event)}\n\n`)
}

class AsyncEventQueue implements AsyncIterableIterator<Buffer> {
  private values: Array<Buffer> = []
  private waiting: Array<(result: IteratorResult<Buffer, undefined>) => void> =
    []
  private closed = false

  constructor(
    private remainingBytes: number,
    private readonly overflowEvent: Buffer,
    private readonly onOverflow: () => void,
  ) {}

  push(value: Buffer) {
    if (this.closed) return false
    if (value.byteLength > this.remainingBytes) {
      this.overflow()
      return false
    }
    this.remainingBytes -= value.byteLength
    const resolve = this.waiting.shift()
    if (resolve) resolve({ value, done: false })
    else this.values.push(value)
    return true
  }

  close() {
    if (this.closed) return
    this.closed = true
    for (const resolve of this.waiting.splice(0)) {
      resolve({ value: undefined, done: true })
    }
  }

  next(): Promise<IteratorResult<Buffer, undefined>> {
    const value = this.values.shift()
    if (value !== undefined) {
      return Promise.resolve({ value, done: false })
    }
    if (this.closed) {
      return Promise.resolve({ value: undefined, done: true })
    }
    return new Promise((resolve) => this.waiting.push(resolve))
  }

  [Symbol.asyncIterator]() {
    return this
  }

  private overflow() {
    this.closed = true
    const resolve = this.waiting.shift()
    if (resolve) resolve({ value: this.overflowEvent, done: false })
    else this.values.push(this.overflowEvent)
    for (const waiting of this.waiting.splice(0)) {
      waiting({ value: undefined, done: true })
    }
    this.onOverflow()
  }
}

async function runNotebookTool(
  context: ToolContext,
  name: string,
  value: unknown,
) {
  const input = readToolInput(value)

  if (name === 'describe_notebook') {
    assertOnlyKeys(input, [])
    const packageJson = context.execution.workspace.files['/package.json']
    return {
      runtime: context.execution.runtime ? 'webcontainer' : 'client',
      entry: context.execution.workspace.entry,
      environment: context.execution.workspace.environment ?? null,
      builtInImports: notebookImportAliases,
      workspaceImports: context.execution.workspace.imports ?? {},
      packageJson: packageJson?.slice(0, maxReadCharacters) ?? null,
      packageJsonTruncated:
        packageJson !== undefined && packageJson.length > maxReadCharacters,
    }
  }

  if (name === 'list_files') {
    assertOnlyKeys(input, [])
    return {
      files: listNotebookAiFiles(
        context.execution.workspace,
        context.hiddenFiles,
      ),
    }
  }

  if (name === 'read_file') {
    assertOnlyKeys(input, ['path', 'offset'])
    if (
      typeof input.path !== 'string' ||
      (input.offset !== undefined &&
        (typeof input.offset !== 'number' ||
          !Number.isInteger(input.offset) ||
          input.offset < 0))
    ) {
      throw new Error('Invalid read_file input')
    }
    const offset = input.offset ?? 0
    if (typeof offset !== 'number') throw new Error('Invalid read_file offset')
    const source = readNotebookAiFile(
      context.execution.workspace,
      context.hiddenFiles,
      input.path,
    )
    if (offset > source.length) {
      throw new Error(`Read offset exceeds file length: ${input.path}`)
    }
    const end = Math.min(source.length, offset + maxReadCharacters)
    return {
      path: input.path,
      content: source.slice(offset, end),
      offset,
      totalCharacters: source.length,
      nextOffset: end < source.length ? end : null,
    }
  }

  if (name === 'replace_file') {
    assertOnlyKeys(input, ['path', 'content'])
    if (typeof input.path !== 'string' || typeof input.content !== 'string') {
      throw new Error('Invalid replace_file input')
    }
    const current = context.execution
    const workspace = replaceNotebookAiFile(
      current.workspace,
      context.hiddenFiles,
      input.path,
      input.content,
    )
    context.execution = { runtime: current.runtime, workspace }
    return { path: input.path, characters: input.content.length }
  }

  if (name === 'upgrade_runtime') {
    assertOnlyKeys(input, [])
    const current = context.execution
    const next = upgradeNotebookAiWorkspaceToWebContainer(
      toWorkspaceState(current),
    )
    context.execution = toExecution(next)
    return {
      runtime: 'webcontainer',
      createdFiles: getChangedNotebookAiFiles(
        current.workspace,
        context.execution.workspace,
      ),
    }
  }

  if (name === 'install_dependency') {
    assertOnlyKeys(input, ['name', 'version'])
    if (
      typeof input.name !== 'string' ||
      !input.name ||
      input.name.length > 214 ||
      !npmPackageNamePattern.test(input.name) ||
      (input.version !== undefined &&
        (typeof input.version !== 'string' ||
          !input.version ||
          input.version.length > 128))
    ) {
      throw new Error('Invalid install_dependency input')
    }
    if (!context.execution.runtime) {
      throw new Error('Call upgrade_runtime before install_dependency')
    }
    const exactVersion =
      input.version ??
      (await resolveNpmPackageVersion(input.name, context.signal))
    context.execution = toExecution(
      installNotebookAiPackage(
        toWorkspaceState(context.execution),
        input.name,
        exactVersion,
      ),
    )
    return {
      name: input.name,
      version: exactVersion,
      packageJson: '/package.json',
    }
  }

  throw new Error(`Unknown notebook tool: ${name}`)
}

function parseAssistRequest(source: string): NotebookChatGptRequest {
  const value = parseObject(source)
  if (
    !hasOnlyKeys(value, [
      'threadId',
      'runId',
      'parentRunId',
      'state',
      'messages',
      'tools',
      'context',
      'forwardedProps',
      'resume',
      'data',
    ]) ||
    typeof value.threadId !== 'string' ||
    !value.threadId ||
    value.threadId.length > 256 ||
    typeof value.runId !== 'string' ||
    !value.runId ||
    value.runId.length > 256 ||
    (value.parentRunId !== undefined &&
      (typeof value.parentRunId !== 'string' ||
        !value.parentRunId ||
        value.parentRunId.length > 256)) ||
    !Array.isArray(value.messages) ||
    value.messages.length === 0 ||
    value.messages.length > maxWireMessages ||
    !Array.isArray(value.tools) ||
    !Array.isArray(value.context) ||
    (value.resume !== undefined && !Array.isArray(value.resume)) ||
    !isRecord(value.forwardedProps) ||
    (value.data !== undefined && !isRecord(value.data))
  ) {
    throw new HttpError(400, 'Invalid AG-UI notebook request')
  }

  const forwarded = value.forwardedProps
  if (
    !hasOnlyKeys(forwarded, ['model', 'execution', 'hiddenFiles']) ||
    typeof forwarded.model !== 'string' ||
    !forwarded.model.trim() ||
    forwarded.model.length > 256 ||
    !Array.isArray(forwarded.hiddenFiles) ||
    !forwarded.hiddenFiles.every(
      (filePath) => typeof filePath === 'string' && filePath.length <= 1_024,
    )
  ) {
    throw new HttpError(400, 'Invalid notebook AI forwarding data')
  }

  const messages = parseWireMessages(value.messages)
  let execution: NotebookAiExecution
  try {
    execution = parseNotebookAiExecution(forwarded.execution)
  } catch {
    throw new HttpError(400, 'Invalid notebook AI execution')
  }
  if (
    forwarded.hiddenFiles.some(
      (filePath) => execution.workspace.files[filePath] === undefined,
    )
  ) {
    throw new HttpError(400, 'Invalid hidden notebook file')
  }

  return {
    threadId: value.threadId,
    runId: value.runId,
    ...(typeof value.parentRunId === 'string'
      ? { parentRunId: value.parentRunId }
      : {}),
    model: forwarded.model,
    messages,
    execution,
    hiddenFiles: forwarded.hiddenFiles,
  }
}

function parseWireMessages(values: Array<unknown>) {
  const messages: Array<NotebookAiMessage> = []

  for (const value of values) {
    if (!isRecord(value) || typeof value.role !== 'string') {
      throw new HttpError(400, 'Invalid AG-UI message')
    }
    if (
      value.role !== 'developer' &&
      value.role !== 'system' &&
      value.role !== 'assistant' &&
      value.role !== 'user' &&
      value.role !== 'tool' &&
      value.role !== 'activity' &&
      value.role !== 'reasoning'
    ) {
      throw new HttpError(400, 'Invalid AG-UI message role')
    }
    if (value.role !== 'assistant' && value.role !== 'user') continue

    const content = readWireMessageContent(value.content)
    if (content === undefined || !content.trim()) {
      if (value.role === 'assistant') continue
      throw new HttpError(400, 'Invalid AG-UI user message')
    }
    if (content.length > maxMessageCharacters) {
      throw new HttpError(400, 'AG-UI message is too long')
    }
    messages.push({ role: value.role, content })
  }

  const recent = messages.slice(-maxMessages)
  if (recent.length === 0 || recent.at(-1)?.role !== 'user') {
    throw new HttpError(400, 'Notebook AI requires a user message')
  }
  return recent
}

function readWireMessageContent(value: unknown) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return undefined

  let content = ''
  for (const part of value) {
    if (
      !isRecord(part) ||
      part.type !== 'text' ||
      typeof part.text !== 'string'
    ) {
      throw new HttpError(400, 'Notebook AI only accepts text messages')
    }
    content += part.text
  }
  return content
}

function parseModels(values: Array<unknown>) {
  return values.flatMap((value): Array<NotebookChatGptModel> => {
    if (
      !isRecord(value) ||
      value.hidden === true ||
      typeof value.model !== 'string' ||
      !value.model ||
      typeof value.displayName !== 'string' ||
      !value.displayName
    ) {
      return []
    }
    return [
      {
        id: value.model,
        label: value.displayName,
        isDefault: value.isDefault === true,
      },
    ]
  })
}

async function resolveNpmPackageVersion(name: string, signal: AbortSignal) {
  throwIfAborted(signal)
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
    {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal,
    },
  )
  if (!response.ok) {
    throw new Error(`npm could not resolve ${name} (${response.status})`)
  }
  const source = await readFetchBody(response, maxNpmResponseBytes)
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error(`npm returned an invalid package record for ${name}`)
  }
  if (!isRecord(value) || typeof value.version !== 'string') {
    throw new Error(`npm returned an invalid package record for ${name}`)
  }
  return value.version
}

async function readFetchBody(response: Response, limit: number) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let source = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new Error('Remote response is too large')
    }
    source += decoder.decode(chunk.value, { stream: true })
  }
  return source + decoder.decode()
}

function formatConversation(messages: Array<NotebookAiMessage>) {
  return messages
    .map(
      (message) =>
        `${message.role === 'user' ? 'User' : 'Assistant'}:\n${message.content}`,
    )
    .join('\n\n')
}

function dynamicTool(name: string, description: string, inputSchema: object) {
  return { type: 'function', name, description, inputSchema }
}

function objectSchema(
  properties: Record<string, object>,
  required: Array<string>,
) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function ensureAgentMessage(stream: AgentStreamContext, itemId: string) {
  const existing = stream.agentMessages.get(itemId)
  if (existing) return existing

  const state: AgentMessageState = { text: '', ended: false }
  stream.agentMessages.set(itemId, state)
  stream.lastAgentMessageId = itemId
  stream.emit({
    type: EventType.TEXT_MESSAGE_START,
    messageId: itemId,
    role: 'assistant',
    timestamp: Date.now(),
  })
  return state
}

function appendMissingAgentText(
  stream: AgentStreamContext,
  itemId: string,
  state: AgentMessageState,
  text: string,
) {
  if (state.ended || text === state.text) return
  const delta = text.startsWith(state.text) ? text.slice(state.text.length) : ''
  if (!delta) return
  state.text += delta
  stream.emit({
    type: EventType.TEXT_MESSAGE_CONTENT,
    messageId: itemId,
    delta,
    timestamp: Date.now(),
  })
}

function finishAgentMessage(
  stream: AgentStreamContext,
  itemId: string,
  state: AgentMessageState,
) {
  if (state.ended) return
  state.ended = true
  stream.emit({
    type: EventType.TEXT_MESSAGE_END,
    messageId: itemId,
    timestamp: Date.now(),
  })
}

function ensureReasoningPart(
  stream: AgentStreamContext,
  itemId: string,
  summaryIndex: number,
) {
  let state = stream.reasoning.get(itemId)
  if (!state) {
    state = {}
    stream.reasoning.set(itemId, state)
    stream.emit({
      type: EventType.REASONING_START,
      messageId: itemId,
      timestamp: Date.now(),
    })
  }

  if (state.activeSummaryIndex === summaryIndex && state.activeMessageId) {
    return state.activeMessageId
  }
  if (state.activeMessageId) {
    stream.emit({
      type: EventType.REASONING_MESSAGE_END,
      messageId: state.activeMessageId,
      timestamp: Date.now(),
    })
  }

  const messageId = `${itemId}:${summaryIndex}`
  state.activeSummaryIndex = summaryIndex
  state.activeMessageId = messageId
  stream.emit({
    type: EventType.REASONING_MESSAGE_START,
    messageId,
    role: 'reasoning',
    timestamp: Date.now(),
  })
  return messageId
}

function finishReasoning(stream: AgentStreamContext, itemId: string) {
  const state = stream.reasoning.get(itemId)
  if (!state) return
  if (state.activeMessageId) {
    stream.emit({
      type: EventType.REASONING_MESSAGE_END,
      messageId: state.activeMessageId,
      timestamp: Date.now(),
    })
  }
  stream.emit({
    type: EventType.REASONING_END,
    messageId: itemId,
    timestamp: Date.now(),
  })
  stream.reasoning.delete(itemId)
}

function finishOpenStreamItems(stream: AgentStreamContext) {
  for (const [itemId, state] of stream.agentMessages) {
    finishAgentMessage(stream, itemId, state)
  }
  for (const itemId of [...stream.reasoning.keys()]) {
    finishReasoning(stream, itemId)
  }
}

function serializeJson(value: unknown) {
  return JSON.stringify(value) ?? 'null'
}

function dynamicToolFailure(message: string) {
  return {
    contentItems: [{ type: 'inputText', text: message }],
    success: false,
  }
}

function readThreadId(value: unknown) {
  if (
    !isRecord(value) ||
    !isRecord(value.thread) ||
    typeof value.thread.id !== 'string'
  ) {
    throw new Error('Codex returned an invalid thread')
  }
  return value.thread.id
}

function readTurnId(value: unknown) {
  if (
    !isRecord(value) ||
    !isRecord(value.turn) ||
    typeof value.turn.id !== 'string'
  ) {
    throw new Error('Codex returned an invalid turn')
  }
  return value.turn.id
}

function readAgentMessage(turn: Record<string, unknown>) {
  if (!Array.isArray(turn.items)) return ''
  let fallback = ''
  let finalAnswer = ''
  for (const item of turn.items) {
    if (
      isRecord(item) &&
      item.type === 'agentMessage' &&
      typeof item.text === 'string'
    ) {
      fallback = item.text
      if (item.phase === 'final_answer') finalAnswer = item.text
    }
  }
  return finalAnswer || fallback
}

function readTurnError(turn: Record<string, unknown> | undefined) {
  const error = isRecord(turn?.error) ? turn.error : undefined
  return typeof error?.message === 'string'
    ? error.message
    : 'Codex could not complete the notebook edit'
}

function toWorkspaceState(
  execution: NotebookAiExecution,
): NotebookAiWorkspaceState {
  return execution.runtime
    ? { runtime: execution.runtime, workspace: execution.workspace }
    : { workspace: execution.workspace }
}

function toExecution(state: NotebookAiWorkspaceState): NotebookAiExecution {
  return { runtime: state.runtime ?? null, workspace: state.workspace }
}

function readToolInput(value: unknown) {
  if (!isRecord(value)) throw new Error('Invalid notebook tool input')
  return value
}

function assertOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  if (!hasOnlyKeys(value, keys)) {
    throw new Error('Invalid notebook tool input')
  }
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Notebook edit was canceled')
}

function assertJsonRequest(request: http.IncomingMessage) {
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim()
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json')
  }
}

async function readBody(request: http.IncomingMessage, limit: number) {
  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new HttpError(413, 'Request body too large')
  }

  const chunks: Array<Buffer> = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > limit) throw new HttpError(413, 'Request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseObject(source: string) {
  let value: unknown
  try {
    value = source ? JSON.parse(source) : {}
  } catch {
    throw new HttpError(400, 'Invalid JSON request')
  }
  if (!isRecord(value)) throw new HttpError(400, 'Invalid JSON request')
  return value
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  value: unknown,
) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  const body = JSON.stringify(value)
  if (Buffer.byteLength(body) > maxResponseBytes) {
    response.statusCode = 413
    response.end(JSON.stringify({ error: 'Response body too large' }))
    return
  }
  response.statusCode = status
  response.end(body)
}

function isLocalRequest(request: http.IncomingMessage) {
  const host = request.headers.host
  if (!host || !isLocalUrl(`http://${host}`)) return false
  const origin = request.headers.origin
  return !origin || isLocalUrl(origin)
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
