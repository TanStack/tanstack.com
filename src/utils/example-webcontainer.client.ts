import type {
  FileSystemTree,
  PreviewMessage,
  Unsubscribe,
  WebContainer,
  WebContainerProcess,
} from '@webcontainer/api'
import {
  decodeExampleBinaryFile,
  isCanonicalExamplePath,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'
import { env } from './env'
import {
  getTanStackStartOxcRuntimeSpecifier,
  getWebContainerStartCommand,
  prepareTanStackStartWebContainerFiles,
} from './example-webcontainer-start'
import { createExampleSandboxBrowserScript } from './example-sandbox.client'

export type ExampleWebContainerStatus =
  | 'booting'
  | 'installing'
  | 'mounting'
  | 'ready'
  | 'starting'
  | 'stopped'

export type ExampleWebContainerEvent =
  | {
      kind: 'error'
      message: string
    }
  | {
      kind: 'output'
      process: 'install' | 'server'
      value: string
    }
  | {
      kind: 'preview'
      port: number
      url: string
    }
  | {
      fatal: boolean
      kind: 'preview-error'
      message: string
    }
  | {
      kind: 'status'
      status: ExampleWebContainerStatus
    }
  | {
      kind: 'superseded'
    }

export type WebContainerExampleSession = {
  dispose(): void
  openTerminal(options: {
    cols: number
    onError(cause: unknown): void
    onExit(exitCode: number): void
    onOutput(value: string): void
    rows: number
  }): Promise<WebContainerTerminal>
  reloadPreview(frame: HTMLIFrameElement): Promise<void>
  restart(): Promise<void>
  start(): Promise<void>
  writeFile(path: string, source: string): Promise<void>
}

export type WebContainerTerminal = {
  dispose(): void
  resize(dimensions: { cols: number; rows: number }): void
  write(value: string): Promise<void>
}

type WebContainerTerminalProcess = Pick<
  WebContainerProcess,
  'exit' | 'input' | 'kill' | 'output' | 'resize'
>

export type ExampleWebContainerSupport =
  | { supported: true }
  | { supported: false; reason: string }

let activeSession: ExampleWebContainerSessionImplementation | undefined
let activationQueue = Promise.resolve()
let apiKeyConfigured = false

export function getExampleWebContainerSupport(): ExampleWebContainerSupport {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'WebContainer requires a browser.' }
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'WebContainer requires a secure browser context.',
    }
  }

  if (!window.crossOriginIsolated) {
    return {
      supported: false,
      reason: 'WebContainer requires cross-origin isolation.',
    }
  }

  if (typeof SharedArrayBuffer === 'undefined') {
    return {
      supported: false,
      reason: 'WebContainer requires SharedArrayBuffer support.',
    }
  }

  if (typeof WebAssembly === 'undefined') {
    return {
      supported: false,
      reason: 'WebContainer requires WebAssembly support.',
    }
  }

  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      reason: 'WebContainer requires service worker support.',
    }
  }

  return { supported: true }
}

export function createWebContainerExampleSession({
  browserChannel = crypto.randomUUID(),
  onEvent,
  runtime,
  workspace,
}: {
  browserChannel?: string
  onEvent: (event: ExampleWebContainerEvent) => void
  runtime: ExampleRuntime
  workspace: ExampleWorkspace
}): WebContainerExampleSession {
  return new ExampleWebContainerSessionImplementation({
    browserChannel,
    onEvent,
    runtime,
    workspace,
  })
}

export function connectWebContainerTerminalProcess({
  onError,
  onExit,
  onOutput,
  process,
}: {
  onError(cause: unknown): void
  onExit(exitCode: number): void
  onOutput(value: string): void
  process: WebContainerTerminalProcess
}): WebContainerTerminal {
  const input = process.input.getWriter()
  const outputAbort = new AbortController()
  let disposed = false
  let inputReleased = false
  let writeQueue = Promise.resolve()

  function releaseInput() {
    if (inputReleased) return
    inputReleased = true
    void writeQueue.finally(() => input.releaseLock())
  }

  const output = process.output
    .pipeTo(
      new WritableStream({
        write(value) {
          if (!disposed) onOutput(value)
        },
      }),
      { signal: outputAbort.signal },
    )
    .catch((cause) => {
      if (!disposed) onError(cause)
    })

  void process.exit
    .then(async (exitCode) => {
      if (disposed) return
      await output
      if (disposed) return
      disposed = true
      releaseInput()
      onExit(exitCode)
    })
    .catch((cause) => {
      if (disposed) return
      disposed = true
      outputAbort.abort()
      releaseInput()
      onError(cause)
    })

  return {
    dispose() {
      if (disposed) return
      disposed = true
      outputAbort.abort()
      process.kill()
      releaseInput()
    },
    resize(dimensions) {
      if (!disposed) process.resize(dimensions)
    },
    write(value) {
      if (disposed) return Promise.resolve()

      const write = writeQueue.then(() => {
        if (!disposed) return input.write(value)
      })
      writeQueue = write.catch(() => undefined)
      return write
    },
  }
}

export function createWebContainerFileSystemTree(
  files: Record<string, string>,
  binaryFiles: Record<string, string> = {},
): FileSystemTree {
  const root: FileSystemTree = {}
  const entries: Array<[string, string | Uint8Array]> = [
    ...Object.entries(files),
    ...Object.entries(binaryFiles).map(
      ([path, source]): [string, Uint8Array] => [
        path,
        decodeExampleBinaryFile(source),
      ],
    ),
  ]

  for (const [path, source] of entries.sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!isCanonicalExamplePath(path)) {
      throw new Error(`Invalid WebContainer file path: ${path}`)
    }

    const segments = path.split('/').filter(Boolean)
    const fileName = segments.pop()
    if (!fileName) throw new Error(`Invalid WebContainer file path: ${path}`)

    let tree = root
    for (const segment of segments) {
      const existing = tree[segment]

      if (existing) {
        if (!('directory' in existing)) {
          throw new Error(`WebContainer path is already a file: ${segment}`)
        }

        tree = existing.directory
        continue
      }

      const directory = { directory: {} }
      tree[segment] = directory
      tree = directory.directory
    }

    if (tree[fileName]) {
      throw new Error(`Duplicate WebContainer file path: ${path}`)
    }

    tree[fileName] = { file: { contents: source } }
  }

  return root
}

class ExampleWebContainerSessionImplementation implements WebContainerExampleSession {
  private binaryFiles: Record<string, string>
  private browserChannel: string
  private container: WebContainer | undefined
  private disposed = false
  private files: Record<string, string>
  private installProcess: WebContainerProcess | undefined
  private mounted = false
  private onEvent: (event: ExampleWebContainerEvent) => void
  private restartPromise: Promise<void> | undefined
  private runtime: ExampleRuntime
  private serverPort: number | undefined
  private serverProcess: WebContainerProcess | undefined
  private startPromise: Promise<void> | undefined
  private terminals = new Set<WebContainerTerminal>()
  private unsubscribers: Array<Unsubscribe> = []
  private writeQueue = Promise.resolve()

  constructor({
    browserChannel,
    onEvent,
    runtime,
    workspace,
  }: {
    browserChannel: string
    onEvent: (event: ExampleWebContainerEvent) => void
    runtime: ExampleRuntime
    workspace: ExampleWorkspace
  }) {
    this.binaryFiles = { ...workspace.binaryFiles }
    this.browserChannel = browserChannel
    this.files = { ...workspace.files }
    this.onEvent = onEvent
    this.runtime = {
      type: 'webcontainer',
      ...(runtime.compatibility
        ? { compatibility: runtime.compatibility }
        : {}),
      install: {
        command: runtime.install.command,
        args: [...runtime.install.args],
      },
      start: {
        command: runtime.start.command,
        args: [...runtime.start.args],
      },
    }
  }

  start() {
    this.assertUsable()
    if (this.startPromise) return this.startPromise

    claimActiveSession(this)

    this.startPromise = enqueueActivation(async () => {
      try {
        await this.startRuntime()
      } catch (cause) {
        this.stopRuntime()
        if (!(cause instanceof SessionDisposedError)) {
          this.emit({ kind: 'error', message: formatError(cause) })
        }
        throw cause
      }
    })

    return this.startPromise
  }

  async writeFile(path: string, source: string) {
    this.assertUsable()
    if (!isCanonicalExamplePath(path)) {
      throw new Error(`Invalid WebContainer file path: ${path}`)
    }

    this.files[path] = source
    if (!this.mounted) return

    await this.enqueueWrite(path, source)
  }

  async openTerminal({
    cols,
    onError,
    onExit,
    onOutput,
    rows,
  }: {
    cols: number
    onError(cause: unknown): void
    onExit(exitCode: number): void
    onOutput(value: string): void
    rows: number
  }) {
    this.assertUsable()
    const start = this.startPromise
    if (!start) throw new Error('Run the example before opening a terminal.')

    await start
    this.assertUsable()

    const process = await this.getContainer().spawn('jsh', {
      terminal: { cols, rows },
    })

    if (this.disposed) {
      process.kill()
      throw new SessionDisposedError()
    }

    const connection = connectWebContainerTerminalProcess({
      onError,
      onExit: (exitCode) => {
        this.terminals.delete(terminal)
        onExit(exitCode)
      },
      onOutput,
      process,
    })
    const terminal: WebContainerTerminal = {
      dispose: () => {
        connection.dispose()
        this.terminals.delete(terminal)
      },
      resize: (dimensions) => connection.resize(dimensions),
      write: (value) => connection.write(value),
    }
    this.terminals.add(terminal)
    return terminal
  }

  async reloadPreview(frame: HTMLIFrameElement) {
    this.assertUsable()
    const { reloadPreview } = await import('@webcontainer/api')
    this.assertUsable()
    await reloadPreview(frame)
  }

  async restart() {
    this.assertUsable()

    if (!this.startPromise) {
      await this.start()
      return
    }

    await this.startPromise
    this.assertUsable()
    if (this.restartPromise) return this.restartPromise

    this.restartPromise = (async () => {
      await this.writeQueue
      await this.stopServer()
      this.assertUsable()
      await this.startServer()
    })()

    try {
      await this.restartPromise
    } catch (cause) {
      if (!(cause instanceof SessionDisposedError)) {
        this.emit({ kind: 'error', message: formatError(cause) })
      }
      throw cause
    } finally {
      this.restartPromise = undefined
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true

    this.installProcess?.kill()
    this.installProcess = undefined
    this.serverProcess?.kill()
    this.serverProcess = undefined
    this.disposeTerminals()
    this.unsubscribe()
    this.teardownContainer()

    if (activeSession === this) activeSession = undefined
  }

  supersede() {
    this.emit({ kind: 'superseded' })
    this.dispose()
  }

  private async startRuntime() {
    const support = getExampleWebContainerSupport()
    if (!support.supported) throw new Error(support.reason)

    this.emit({ kind: 'status', status: 'booting' })
    const webContainerApi = await import('@webcontainer/api')
    this.assertUsable()

    if (env.VITE_WEBCONTAINER_API_KEY && !apiKeyConfigured) {
      webContainerApi.configureAPIKey(env.VITE_WEBCONTAINER_API_KEY)
      apiKeyConfigured = true
    }

    const container = await webContainerApi.WebContainer.boot({
      coep: 'credentialless',
      forwardPreviewErrors: true,
      workdirName: 'tanstack-example',
    })
    this.container = container
    this.assertUsable()
    this.subscribe(container)

    await container.setPreviewScript(
      createExampleSandboxBrowserScript({
        channel: this.browserChannel,
        mode: 'webcontainer',
      }),
    )
    this.assertUsable()

    this.emit({ kind: 'status', status: 'mounting' })
    const mountedFiles = prepareTanStackStartWebContainerFiles(
      this.files,
      this.runtime,
    )
    await container.mount(
      createWebContainerFileSystemTree(mountedFiles, this.binaryFiles),
    )
    this.assertUsable()
    this.mounted = true

    await Promise.all(
      Object.entries(this.files)
        .filter(([path, source]) => mountedFiles[path] !== source)
        .map(([path, source]) => this.enqueueWrite(path, source)),
    )

    await this.installDependencies()
    await this.installCompatibilityDependencies()
    this.assertUsable()
    await this.startServer()
  }

  private subscribe(container: WebContainer) {
    this.unsubscribers.push(
      container.on('error', ({ message }) => {
        this.emit({ kind: 'error', message })
      }),
      container.on('port', (port, type) => {
        if (type !== 'close' || port !== this.serverPort) return
        this.serverPort = undefined
        this.emit({ kind: 'status', status: 'stopped' })
      }),
      container.on('preview-message', (message) => {
        this.emit({
          fatal: !('args' in message),
          kind: 'preview-error',
          message: formatPreviewMessage(message),
        })
      }),
      container.on('server-ready', (port, url) => {
        this.serverPort = port
        this.emit({ kind: 'preview', port, url })
        this.emit({ kind: 'status', status: 'ready' })
      }),
    )
  }

  private async installDependencies() {
    const container = this.getContainer()
    this.emit({ kind: 'status', status: 'installing' })
    const process = await container.spawn(
      this.runtime.install.command,
      this.runtime.install.args,
    )
    this.installProcess = process
    const output = this.readOutput(process, 'install')
    const exitCode = await process.exit
    await output
    if (this.installProcess === process) this.installProcess = undefined
    this.assertUsable()

    if (exitCode !== 0) {
      throw new Error(`Dependency installation exited with code ${exitCode}.`)
    }
  }

  private async installCompatibilityDependencies() {
    if (this.runtime.compatibility !== 'tanstack-start-async-context') return

    const container = this.getContainer()
    const packageManager = this.runtime.install.command
    const rolldownPackagePath =
      packageManager === 'npm'
        ? 'node_modules/rolldown/package.json'
        : packageManager === 'pnpm'
          ? 'node_modules/.pnpm/node_modules/rolldown/package.json'
          : undefined
    if (!rolldownPackagePath) {
      throw new Error(
        'TanStack Start async-context compatibility requires npm or pnpm.',
      )
    }

    const rolldownPackageSource = await container.fs.readFile(
      rolldownPackagePath,
      'utf-8',
    )
    const runtimeSpecifier = getTanStackStartOxcRuntimeSpecifier(
      rolldownPackageSource,
    )
    const process = await container.spawn(
      packageManager,
      packageManager === 'npm'
        ? ['install', '--no-save', '--package-lock=false', runtimeSpecifier]
        : ['add', '--save-dev', '--lockfile=false', runtimeSpecifier],
    )
    this.installProcess = process
    const output = this.readOutput(process, 'install')
    const exitCode = await process.exit
    await output
    if (this.installProcess === process) this.installProcess = undefined
    this.assertUsable()

    if (exitCode !== 0) {
      throw new Error(
        `Compatibility dependency installation exited with code ${exitCode}.`,
      )
    }
  }

  private async startServer() {
    const container = this.getContainer()
    const startCommand = getWebContainerStartCommand(this.runtime)
    this.emit({ kind: 'status', status: 'starting' })
    const process = await container.spawn(
      startCommand.command,
      startCommand.args,
      {
        env: {
          __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: '.webcontainer-api.io',
        },
      },
    )
    this.assertUsable()
    this.serverProcess = process

    void this.readOutput(process, 'server').catch((cause) => {
      if (!this.disposed) {
        this.emit({ kind: 'error', message: formatError(cause) })
      }
    })
    void process.exit
      .then((exitCode) => {
        if (this.disposed || this.serverProcess !== process) return
        this.serverProcess = undefined
        this.serverPort = undefined

        if (exitCode === 0) {
          this.emit({ kind: 'status', status: 'stopped' })
        } else {
          this.emit({
            kind: 'error',
            message: `Development server exited with code ${exitCode}.`,
          })
        }
      })
      .catch((cause) => {
        if (this.disposed || this.serverProcess !== process) return
        this.serverProcess = undefined
        this.serverPort = undefined
        this.emit({ kind: 'error', message: formatError(cause) })
      })
  }

  private async stopServer() {
    const process = this.serverProcess
    this.serverProcess = undefined
    this.serverPort = undefined
    if (!process) return

    process.kill()
    await process.exit.catch(() => undefined)
  }

  private enqueueWrite(path: string, source: string) {
    const write = this.writeQueue.then(async () => {
      if (this.disposed) return
      await this.getContainer().fs.writeFile(path, source)
    })

    this.writeQueue = write.catch(() => undefined)
    return write
  }

  private async readOutput(
    process: WebContainerProcess,
    processName: 'install' | 'server',
  ) {
    const reader = process.output.getReader()

    try {
      while (true) {
        const result = await reader.read()
        if (result.done) return
        if (!this.disposed) {
          this.emit({
            kind: 'output',
            process: processName,
            value: result.value,
          })
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private getContainer() {
    this.assertUsable()
    if (!this.container) throw new Error('WebContainer has not started.')
    return this.container
  }

  private assertUsable() {
    if (this.disposed) throw new SessionDisposedError()
  }

  private emit(event: ExampleWebContainerEvent) {
    if (!this.disposed) this.onEvent(event)
  }

  private stopRuntime() {
    this.installProcess?.kill()
    this.installProcess = undefined
    this.serverProcess?.kill()
    this.serverProcess = undefined
    this.disposeTerminals()
    this.unsubscribe()
    this.teardownContainer()
  }

  private unsubscribe() {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe()
  }

  private disposeTerminals() {
    const terminals = [...this.terminals]
    this.terminals.clear()
    for (const terminal of terminals) terminal.dispose()
  }

  private teardownContainer() {
    const container = this.container
    this.container = undefined
    this.mounted = false
    if (container) container.teardown()
  }
}

class SessionDisposedError extends Error {
  constructor() {
    super('WebContainer session was disposed.')
  }
}

function enqueueActivation(task: () => Promise<void>) {
  const result = activationQueue.catch(() => undefined).then(task)
  activationQueue = result.catch(() => undefined)
  return result
}

function claimActiveSession(session: ExampleWebContainerSessionImplementation) {
  if (activeSession === session) return
  activeSession?.supersede()
  activeSession = session
}

function formatPreviewMessage(message: PreviewMessage) {
  if ('message' in message) {
    return message.stack || message.message
  }

  return message.args.map(formatValue).join(' ')
}

function formatValue(value: unknown) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message

  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? error.stack || error.message : String(error)
}
