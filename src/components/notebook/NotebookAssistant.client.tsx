import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowDownIcon,
  CaretDownIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  GearSixIcon,
  NotePencilIcon,
  PaperPlaneRightIcon,
  SpinnerGapIcon,
  StopIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Markdown as MarkdownRenderer } from '@tanstack/markdown/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  FormInput,
  FormSelect,
} from '~/components/ds/ui'
import type { ExampleWorkbenchRunResult } from '~/components/examples/ExampleWorkbench.client'
import { NotebookAgentActivity } from '~/components/notebook/NotebookAgentActivity'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  reduceNotebookAiActivity,
  type NotebookAiActivity,
  type NotebookAiActivityEvent,
} from '~/utils/notebook-ai-activity'
import {
  parseNotebookChatGptConnection,
  parseNotebookChatGptLogin,
  type NotebookChatGptConnection,
  type NotebookChatGptLogin,
} from '~/utils/notebook-ai-chatgpt'
import {
  serializeNotebookAiExecution,
  type NotebookAiExecution,
  type NotebookAiMessage,
  type NotebookAiRemoteProvider,
} from '~/utils/notebook-ai'
import {
  createNotebookAiThreadId,
  listNotebookAiThreads,
  loadNotebookAiTranscript,
  saveNotebookAiTranscript,
  type NotebookAiThread,
} from '~/utils/notebook-ai-persistence.client'
import {
  NotebookAiPromptQueue,
  type NotebookAiQueuedPrompt,
  type NotebookAiSendMode,
} from '~/utils/notebook-ai-prompt-queue'
import { runNotebookAiStream } from '~/utils/notebook-ai-stream.client'

type ByokModelChoice = {
  connection: 'byok'
  provider: NotebookAiRemoteProvider
  model: string
  label: string
}

type ChatGptModelChoice = {
  connection: 'chatgpt'
  model: string
  label: string
}

type ModelChoice = ByokModelChoice | ChatGptModelChoice

type TranscriptMessage = NotebookAiMessage & {
  id: string
  activity?: NotebookAiActivity
}

type TranscriptRow =
  | { id: string; kind: 'message'; message: TranscriptMessage }
  | { id: string; kind: 'queued'; prompt: NotebookAiQueuedPrompt }
  | {
      id: 'activity'
      kind: 'activity'
      activity: NotebookAiActivity
      message: string
    }
  | { id: 'error'; kind: 'error'; message: string }

const maxRepairAttempts = 2
const maxRuntimeErrorCharacters = 4_000
const supportsChatGptLogin = import.meta.env.DEV

const openAiDefault = {
  connection: 'byok',
  provider: 'openai',
  model: 'gpt-5.4-mini',
  label: 'GPT-5.4 mini',
} satisfies ByokModelChoice

const anthropicDefault = {
  connection: 'byok',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  label: 'Claude Sonnet 4.6',
} satisfies ByokModelChoice

const byokModelChoices = [
  openAiDefault,
  {
    connection: 'byok',
    provider: 'openai',
    model: 'gpt-5-mini',
    label: 'GPT-5 mini',
  },
  {
    connection: 'byok',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
  },
  anthropicDefault,
  {
    connection: 'byok',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
  },
] satisfies ReadonlyArray<ByokModelChoice>

const defaultModelByProvider = {
  openai: openAiDefault,
  anthropic: anthropicDefault,
} satisfies Record<NotebookAiRemoteProvider, ByokModelChoice>

const emptyApiKeys = {
  openai: '',
  anthropic: '',
} satisfies Record<NotebookAiRemoteProvider, string>

const chatGptPlaceholder = {
  connection: 'chatgpt',
  model: '',
  label: 'ChatGPT',
} satisfies ChatGptModelChoice

const disconnectedChatGpt = {
  connected: false,
  models: [],
} satisfies NotebookChatGptConnection

export function NotebookAssistant({
  authenticated,
  enabled,
  getExecution,
  hiddenFiles,
  onApply,
  onSignIn,
  storageScope,
}: {
  authenticated: boolean
  enabled: boolean
  getExecution: () => NotebookAiExecution
  hiddenFiles: ReadonlyArray<string>
  onApply: (
    execution: NotebookAiExecution,
    signal: AbortSignal,
  ) => Promise<ExampleWorkbenchRunResult>
  onSignIn?: () => void
  storageScope?: string
}) {
  const [selectedModel, setSelectedModel] = React.useState<ModelChoice>(
    supportsChatGptLogin ? chatGptPlaceholder : openAiDefault,
  )
  const [apiKeys, setApiKeys] =
    React.useState<Record<NotebookAiRemoteProvider, string>>(emptyApiKeys)
  const [settingsProvider, setSettingsProvider] =
    React.useState<NotebookAiRemoteProvider>('openai')
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [showApiKeySetup, setShowApiKeySetup] = React.useState(false)
  const [chatGptConnection, setChatGptConnection] =
    React.useState<NotebookChatGptConnection>()
  const [chatGptLogin, setChatGptLogin] = React.useState<NotebookChatGptLogin>()
  const [chatGptLoading, setChatGptLoading] =
    React.useState(supportsChatGptLogin)
  const [connectionError, setConnectionError] = React.useState('')
  const [prompt, setPrompt] = React.useState('')
  const [messages, setMessages] = React.useState<Array<TranscriptMessage>>([])
  const [queuedPrompts, setQueuedPrompts] = React.useState<
    ReadonlyArray<NotebookAiQueuedPrompt>
  >([])
  const [threadId, setThreadId] = React.useState(() =>
    storageScope
      ? (listNotebookAiThreads(storageScope)[0]?.id ??
        createNotebookAiThreadId())
      : createNotebookAiThreadId(),
  )
  const [threads, setThreads] = React.useState<Array<NotebookAiThread>>(() =>
    storageScope ? listNotebookAiThreads(storageScope) : [],
  )
  const [hydratedThreadId, setHydratedThreadId] = React.useState<string>()
  const [liveActivity, setLiveActivity] = React.useState<NotebookAiActivity>()
  const [streamingMessage, setStreamingMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [running, setRunning] = React.useState(false)
  const [agentStreaming, setAgentStreaming] = React.useState(false)
  const [sendMode, setSendMode] = React.useState<NotebookAiSendMode>('queue')
  const [queueAnnouncement, setQueueAnnouncement] = React.useState('')
  const [showLatest, setShowLatest] = React.useState(false)
  const abortRef = React.useRef<AbortController>(null)
  const abortIntentRef = React.useRef<'steer' | 'stop' | undefined>(undefined)
  const agentStreamingRef = React.useRef(false)
  const messagesRef = React.useRef<Array<TranscriptMessage>>([])
  const promptQueueRef = React.useRef(new NotebookAiPromptQueue())
  const transcriptRef = React.useRef<HTMLDivElement>(null)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const didInitialScrollRef = React.useRef(false)
  const hydrationGenerationRef = React.useRef(0)
  const didSelectConnectionRef = React.useRef(false)

  const chatGptModels = React.useMemo<Array<ChatGptModelChoice>>(
    () =>
      (chatGptConnection?.models ?? []).map((model) => ({
        connection: 'chatgpt',
        model: model.id,
        label: model.label,
      })),
    [chatGptConnection?.models],
  )
  const apiKey =
    selectedModel.connection === 'byok' ? apiKeys[selectedModel.provider] : ''
  const hasChatGptModel =
    selectedModel.connection === 'chatgpt' &&
    chatGptConnection?.connected === true &&
    chatGptConnection.models.some((model) => model.id === selectedModel.model)
  const needsConnection =
    selectedModel.connection === 'chatgpt' ? !hasChatGptModel : !apiKey.trim()
  const hydrating = Boolean(storageScope && hydratedThreadId !== threadId)
  const transcriptRows = React.useMemo<Array<TranscriptRow>>(() => {
    const rows: Array<TranscriptRow> = messages.map((message) => ({
      id: message.id,
      kind: 'message',
      message,
    }))
    if (liveActivity)
      rows.push({
        id: 'activity',
        kind: 'activity',
        activity: liveActivity,
        message: streamingMessage,
      })
    rows.push(
      ...queuedPrompts.map<TranscriptRow>((queuedPrompt) => ({
        id: `queued:${queuedPrompt.id}`,
        kind: 'queued',
        prompt: queuedPrompt,
      })),
    )
    if (error) rows.push({ id: 'error', kind: 'error', message: error })
    return rows
  }, [error, liveActivity, messages, queuedPrompts, streamingMessage])

  const getItemKey = React.useCallback(
    (index: number) => transcriptRows[index]!.id,
    [transcriptRows],
  )
  const virtualizer = useVirtualizer({
    count: transcriptRows.length,
    getScrollElement: () => transcriptRef.current,
    estimateSize: () => 96,
    getItemKey,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 80,
    overscan: 6,
    directDomUpdates: true,
    onChange(instance) {
      const next = transcriptRows.length > 0 && !instance.isAtEnd()
      setShowLatest((current) => (current === next ? current : next))
    },
  })

  const refreshThreads = React.useCallback(() => {
    setThreads(storageScope ? listNotebookAiThreads(storageScope) : [])
  }, [storageScope])

  React.useEffect(() => {
    const generation = hydrationGenerationRef.current + 1
    hydrationGenerationRef.current = generation
    setHydratedThreadId(undefined)
    messagesRef.current = []
    setMessages([])
    setLiveActivity(undefined)
    setStreamingMessage('')
    setError('')
    setShowLatest(false)
    didInitialScrollRef.current = false

    if (!storageScope) {
      setHydratedThreadId(threadId)
      return
    }

    void loadNotebookAiTranscript(storageScope, threadId).then((transcript) => {
      if (hydrationGenerationRef.current !== generation) return
      const nextMessages = transcript ?? []
      messagesRef.current = nextMessages
      setMessages(nextMessages)
      setHydratedThreadId(threadId)
      refreshThreads()
    })

    return () => {
      if (hydrationGenerationRef.current === generation) {
        hydrationGenerationRef.current += 1
      }
    }
  }, [refreshThreads, storageScope, threadId])

  React.useEffect(() => {
    if (!storageScope || hydratedThreadId !== threadId) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      void saveNotebookAiTranscript(storageScope, threadId, messages).then(
        () => {
          if (!cancelled) refreshThreads()
        },
      )
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [hydratedThreadId, messages, refreshThreads, storageScope, threadId])

  const refreshChatGptConnection = React.useCallback(
    async (signal?: AbortSignal, showLoading = false) => {
      if (!supportsChatGptLogin) return disconnectedChatGpt
      if (showLoading) setChatGptLoading(true)
      try {
        const response = await fetch('/api/notebook/chatgpt', {
          headers: { Accept: 'application/json' },
          signal,
        })
        const body: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          throw new Error(readErrorMessage(body, response.status))
        }

        const connection = parseNotebookChatGptConnection(body)
        setChatGptConnection(connection)
        setConnectionError('')
        if (connection.connected) {
          setChatGptLogin(undefined)
          setSelectedModel((current) => {
            if (didSelectConnectionRef.current) return current
            if (
              current.connection === 'chatgpt' &&
              connection.models.some((model) => model.id === current.model)
            ) {
              return current
            }
            const model = getPreferredChatGptModel(connection)
            return model ? chatGptModelChoice(model) : current
          })
        }
        return connection
      } catch (cause) {
        if (!isAbortError(cause)) {
          setConnectionError(formatError(cause))
        }
        return disconnectedChatGpt
      } finally {
        if (!signal?.aborted && showLoading) setChatGptLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    if (!supportsChatGptLogin || !authenticated || !enabled) return
    const abortController = new AbortController()
    void refreshChatGptConnection(abortController.signal, true)
    return () => abortController.abort()
  }, [authenticated, enabled, refreshChatGptConnection])

  React.useEffect(() => {
    if (!chatGptLogin || !enabled) return
    const interval = window.setInterval(() => {
      void refreshChatGptConnection(undefined, false)
    }, 2_500)
    return () => window.clearInterval(interval)
  }, [chatGptLogin, enabled, refreshChatGptConnection])

  React.useLayoutEffect(() => {
    const textarea = promptRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [prompt])

  React.useLayoutEffect(() => {
    if (didInitialScrollRef.current || transcriptRows.length === 0) return
    didInitialScrollRef.current = true
    virtualizer.scrollToEnd({ behavior: 'instant' })
  }, [transcriptRows.length, virtualizer])

  React.useEffect(() => {
    if (needsConnection) didInitialScrollRef.current = false
  }, [needsConnection])

  React.useEffect(() => () => abortRef.current?.abort(), [])

  function selectModel(model: ModelChoice) {
    if (running) return
    didSelectConnectionRef.current = true
    setSelectedModel(model)
    if (model.connection === 'byok') {
      setSettingsProvider(model.provider)
      if (!apiKeys[model.provider]) {
        setShowApiKeySetup(true)
        setSettingsOpen(true)
      }
    } else if (!chatGptConnection?.connected) {
      setSettingsOpen(true)
    }
    setError('')
  }

  function useChatGptConnection() {
    setShowApiKeySetup(false)
    const model = chatGptConnection
      ? getPreferredChatGptModel(chatGptConnection)
      : undefined
    if (chatGptConnection?.connected && model) {
      didSelectConnectionRef.current = true
      setSelectedModel(chatGptModelChoice(model))
      setSettingsOpen(false)
      return
    }
    didSelectConnectionRef.current = false
    setSelectedModel(chatGptPlaceholder)
  }

  function useApiKeyConnection() {
    didSelectConnectionRef.current = true
    setShowApiKeySetup(true)
  }

  function saveApiKey(provider: NotebookAiRemoteProvider, value: string) {
    setApiKeys((current) => ({ ...current, [provider]: value.trim() }))
    didSelectConnectionRef.current = true
    setSelectedModel(defaultModelByProvider[provider])
    setShowApiKeySetup(false)
    setSettingsOpen(false)
    setError('')
  }

  function clearApiKey(provider: NotebookAiRemoteProvider) {
    setApiKeys((current) => ({ ...current, [provider]: '' }))
    if (
      selectedModel.connection === 'byok' &&
      selectedModel.provider === provider
    ) {
      const fallbackProvider = (['openai', 'anthropic'] as const).find(
        (candidate) => candidate !== provider && apiKeys[candidate],
      )
      if (fallbackProvider) {
        setSelectedModel(defaultModelByProvider[fallbackProvider])
        setSettingsProvider(fallbackProvider)
      } else if (chatGptConnection?.connected) {
        const model = getPreferredChatGptModel(chatGptConnection)
        if (model) setSelectedModel(chatGptModelChoice(model))
      } else if (supportsChatGptLogin) {
        setSelectedModel(chatGptPlaceholder)
      }
    }
    setSettingsOpen(false)
  }

  async function startChatGptLogin() {
    setChatGptLoading(true)
    setConnectionError('')
    try {
      const login = parseNotebookChatGptLogin(
        await requestChatGptConnection({ action: 'login' }),
      )
      didSelectConnectionRef.current = false
      setChatGptLogin(login)
      setSelectedModel(chatGptPlaceholder)
      setShowApiKeySetup(false)
    } catch (cause) {
      setConnectionError(formatError(cause))
    } finally {
      setChatGptLoading(false)
    }
  }

  async function cancelChatGptLogin() {
    if (!chatGptLogin) return
    setChatGptLoading(true)
    setConnectionError('')
    try {
      await requestChatGptConnection({
        action: 'cancelLogin',
        loginId: chatGptLogin.loginId,
      })
      setChatGptLogin(undefined)
    } catch (cause) {
      setConnectionError(formatError(cause))
    } finally {
      setChatGptLoading(false)
    }
  }

  async function disconnectChatGpt() {
    setChatGptLoading(true)
    setConnectionError('')
    try {
      await requestChatGptConnection({ action: 'logout' })
      setChatGptConnection(disconnectedChatGpt)
      setChatGptLogin(undefined)
      const fallbackProvider = (['openai', 'anthropic'] as const).find(
        (provider) => apiKeys[provider],
      )
      setSelectedModel(
        fallbackProvider
          ? defaultModelByProvider[fallbackProvider]
          : chatGptPlaceholder,
      )
      setSettingsOpen(false)
    } catch (cause) {
      setConnectionError(formatError(cause))
    } finally {
      setChatGptLoading(false)
    }
  }

  async function resetConversation() {
    const nextThreadId = createNotebookAiThreadId()
    if (storageScope) {
      if (hydratedThreadId === threadId) {
        await saveNotebookAiTranscript(storageScope, threadId, messages)
      }
      await saveNotebookAiTranscript(storageScope, nextThreadId, [])
    }

    setThreadId(nextThreadId)
    messagesRef.current = []
    setMessages([])
    setPrompt('')
    setLiveActivity(undefined)
    setStreamingMessage('')
    setError('')
    setShowLatest(false)
    didInitialScrollRef.current = false
    window.requestAnimationFrame(() => promptRef.current?.focus())
  }

  async function selectThread(nextThreadId: string) {
    if (running || nextThreadId === threadId) return
    if (storageScope && hydratedThreadId === threadId) {
      await saveNotebookAiTranscript(storageScope, threadId, messages)
    }
    setThreadId(nextThreadId)
  }

  function syncQueuedPrompts() {
    setQueuedPrompts(promptQueueRef.current.items)
  }

  function queuePrompt(instruction: string, mode: NotebookAiSendMode) {
    const promptQueue = promptQueueRef.current
    const effectiveMode =
      mode === 'steer' &&
      agentStreamingRef.current &&
      abortIntentRef.current !== 'steer'
        ? 'steer'
        : 'queue'
    promptQueue.enqueue(instruction, effectiveMode)
    syncQueuedPrompts()
    setPrompt('')
    setSendMode('queue')
    setError('')

    if (effectiveMode === 'steer') {
      abortIntentRef.current = 'steer'
      setQueueAnnouncement('Steering current response.')
      abortRef.current?.abort()
    } else {
      const waiting = promptQueue.items.length
      setQueueAnnouncement(
        `Message queued. ${waiting} ${waiting === 1 ? 'message' : 'messages'} waiting.`,
      )
    }
    window.requestAnimationFrame(() =>
      virtualizer.scrollToEnd({ behavior: 'instant' }),
    )
  }

  function cancelQueuedPrompt(id: string) {
    if (!promptQueueRef.current.cancel(id)) return
    syncQueuedPrompts()
    const waiting = promptQueueRef.current.items.length
    setQueueAnnouncement(
      waiting === 0
        ? 'Queued message removed.'
        : `Queued message removed. ${waiting} ${waiting === 1 ? 'message' : 'messages'} waiting.`,
    )
  }

  function stopResponse() {
    const cleared = promptQueueRef.current.clear()
    syncQueuedPrompts()
    abortIntentRef.current = 'stop'
    setSendMode('queue')
    setQueueAnnouncement(
      cleared === 0
        ? 'Response stopped.'
        : `Response stopped. Cleared ${cleared} queued ${cleared === 1 ? 'message' : 'messages'}.`,
    )
    abortRef.current?.abort()
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const instruction = prompt.trim()
    if (!enabled || !instruction || hydrating) return
    if (!authenticated) {
      onSignIn?.()
      return
    }
    if (needsConnection) return

    const promptQueue = promptQueueRef.current
    if (!promptQueue.claim()) {
      queuePrompt(instruction, sendMode)
      return
    }

    const initialPrompt = {
      id: crypto.randomUUID(),
      content: instruction,
      createdAt: Date.now(),
      mode: 'queue',
    } satisfies NotebookAiQueuedPrompt
    setPrompt('')
    setError('')
    setRunning(true)
    setSendMode('queue')
    void runPromptSequence(initialPrompt)
  }

  async function runPromptSequence(initialPrompt: NotebookAiQueuedPrompt) {
    let nextPrompt: NotebookAiQueuedPrompt | undefined = initialPrompt

    try {
      while (nextPrompt) {
        const outcome = await runPrompt(nextPrompt.content)
        const shouldContinue =
          outcome === 'success' ||
          (outcome === 'aborted' && abortIntentRef.current === 'steer')
        abortIntentRef.current = undefined

        if (!shouldContinue) {
          const cleared = promptQueueRef.current.clear()
          syncQueuedPrompts()
          if (cleared > 0) {
            setQueueAnnouncement(
              `Queue cleared after the response stopped. ${cleared} ${cleared === 1 ? 'message was' : 'messages were'} removed.`,
            )
          }
          break
        }

        nextPrompt = promptQueueRef.current.take()
        syncQueuedPrompts()
      }
    } finally {
      agentStreamingRef.current = false
      setAgentStreaming(false)
      setSendMode('queue')
      promptQueueRef.current.release()
      setRunning(false)
    }
  }

  async function runPrompt(
    instruction: string,
  ): Promise<'success' | 'error' | 'aborted'> {
    const initialExecution = getExecution()
    const userMessage = createTranscriptMessage('user', instruction)
    const nextMessages = [...messagesRef.current, userMessage]
    messagesRef.current = nextMessages
    let requestMessages: Array<NotebookAiMessage> = nextMessages
      .slice(-20)
      .map(({ role, content }) => ({ role, content }))
    let requestExecution = initialExecution
    let repairAttempt = 0
    const activityId = crypto.randomUUID()
    let currentActivity: NotebookAiActivity | undefined
    const abortController = new AbortController()
    abortRef.current = abortController
    setMessages(nextMessages)
    setError('')
    setStreamingMessage('')
    updateActivity({
      type: 'run-started',
      runId: activityId,
      timestamp: Date.now(),
    })
    window.requestAnimationFrame(() =>
      virtualizer.scrollToEnd({ behavior: 'instant' }),
    )

    try {
      while (!abortController.signal.aborted) {
        const base = serializeNotebookAiExecution(requestExecution)
        setStreamingMessage('')

        agentStreamingRef.current = true
        setAgentStreaming(true)
        let response
        try {
          response =
            selectedModel.connection === 'chatgpt'
              ? await runChatGptAgent({
                  activityId,
                  abortController,
                  execution: requestExecution,
                  hiddenFiles,
                  messages: requestMessages,
                  model: selectedModel.model,
                  onActivityEvent: updateActivity,
                  onText: setStreamingMessage,
                  threadId,
                })
              : await runRemoteAgent({
                  activityId,
                  abortController,
                  apiKey,
                  execution: requestExecution,
                  hiddenFiles,
                  messages: requestMessages,
                  model: selectedModel.model,
                  onActivityEvent: updateActivity,
                  onText: setStreamingMessage,
                  provider: selectedModel.provider,
                  threadId,
                })
        } finally {
          agentStreamingRef.current = false
          setAgentStreaming(false)
          setSendMode('queue')
        }
        if (abortController.signal.aborted) {
          stopActivity()
          return 'aborted'
        }

        const currentExecution = getExecution()
        if (serializeNotebookAiExecution(currentExecution) !== base) {
          const message =
            'The notebook changed while the assistant was working.'
          failRepair(message)
          failActivity(message)
          setError(
            'The notebook changed while the assistant was working. Send the request again.',
          )
          return 'error'
        }

        if (response.changedFiles.length === 0 && !response.runtimeChanged) {
          if (repairAttempt > 0) {
            const message =
              'The notebook still has an error and no repair was applied.'
            failRepair(message)
            failActivity(message)
          } else {
            completeActivity()
          }
          commitAssistant(response.message)
          if (repairAttempt > 0) {
            setError(
              'The notebook still has an error and no repair was applied.',
            )
            return 'error'
          }
          return 'success'
        }

        const applyItemId = `apply:${repairAttempt}`
        updateActivity({
          type: 'item-running',
          runId: activityId,
          itemId: applyItemId,
          source: 'harness',
          name: 'apply_workspace',
          timestamp: Date.now(),
          input: { paths: response.changedFiles },
        })
        updateActivity({
          type: 'item-completed',
          runId: activityId,
          itemId: applyItemId,
          source: 'harness',
          name: 'apply_workspace',
          timestamp: Date.now(),
          output: { paths: response.changedFiles },
        })
        const runItemId = `run:${repairAttempt}`
        updateActivity({
          type: 'item-running',
          runId: activityId,
          itemId: runItemId,
          source: 'harness',
          name: 'run_notebook',
          timestamp: Date.now(),
        })
        const runResult = await onApply(
          response.execution,
          abortController.signal,
        )
        if (abortController.signal.aborted) {
          stopActivity()
          return 'aborted'
        }

        if (runResult.ok) {
          updateActivity({
            type: 'item-completed',
            runId: activityId,
            itemId: runItemId,
            source: 'harness',
            name: 'run_notebook',
            timestamp: Date.now(),
          })
          if (repairAttempt > 0) {
            updateActivity({
              type: 'item-completed',
              runId: activityId,
              itemId: `repair:${repairAttempt}`,
              source: 'harness',
              name: 'repair_notebook',
              timestamp: Date.now(),
            })
          }
          completeActivity()
          commitAssistant(response.message)
          return 'success'
        }

        updateActivity({
          type: 'item-running',
          runId: activityId,
          itemId: runItemId,
          source: 'harness',
          name: 'run_notebook',
          timestamp: Date.now(),
          input: { phase: runResult.phase },
        })
        updateActivity({
          type: 'item-failed',
          runId: activityId,
          itemId: runItemId,
          source: 'harness',
          name: 'run_notebook',
          timestamp: Date.now(),
          error: runResult.message,
        })
        failRepair(runResult.message)

        if (
          (runResult.phase !== 'compile' && runResult.phase !== 'runtime') ||
          repairAttempt >= maxRepairAttempts
        ) {
          const runError = formatRunError(runResult)
          failActivity(runError)
          commitAssistant(response.message)
          setError(runError)
          return 'error'
        }

        repairAttempt += 1
        updateActivity({
          type: 'item-running',
          runId: activityId,
          itemId: `repair:${repairAttempt}`,
          source: 'harness',
          name: 'repair_notebook',
          timestamp: Date.now(),
          input: {
            phase: runResult.phase,
            attempt: repairAttempt,
            maxAttempts: maxRepairAttempts,
          },
        })
        const diagnostic = createRepairDiagnostic(runResult)
        requestMessages = requestMessages
          .concat(
            { role: 'assistant', content: response.message },
            { role: 'user', content: diagnostic },
          )
          .slice(-20)
        requestExecution = response.execution
      }
    } catch (cause) {
      if (isAbortError(cause) || abortController.signal.aborted) {
        stopActivity()
        return 'aborted'
      } else {
        const message = formatError(cause)
        failRepair(message)
        failActivity(message)
        setError(message)
        return 'error'
      }
    } finally {
      if (abortRef.current === abortController) abortRef.current = null
    }

    return 'aborted'

    function updateActivity(event: NotebookAiActivityEvent) {
      currentActivity = reduceNotebookAiActivity(currentActivity, event)
      setLiveActivity(currentActivity)
    }

    function completeActivity() {
      updateActivity({
        type: 'run-completed',
        runId: activityId,
        timestamp: Date.now(),
      })
    }

    function failActivity(message: string) {
      updateActivity({
        type: 'run-failed',
        runId: activityId,
        timestamp: Date.now(),
        error: message,
      })
    }

    function stopActivity() {
      updateActivity({
        type: 'run-stopped',
        runId: activityId,
        timestamp: Date.now(),
      })
    }

    function failRepair(message: string) {
      if (repairAttempt === 0) return
      updateActivity({
        type: 'item-failed',
        runId: activityId,
        itemId: `repair:${repairAttempt}`,
        source: 'harness',
        name: 'repair_notebook',
        timestamp: Date.now(),
        error: message,
      })
    }

    function commitAssistant(content: string) {
      const savedActivity = currentActivity?.items.length
        ? currentActivity
        : undefined
      const assistantMessage = createTranscriptMessage(
        'assistant',
        content,
        savedActivity,
      )
      const committedMessages = [...messagesRef.current, assistantMessage]
      messagesRef.current = committedMessages
      setMessages(committedMessages)
      setLiveActivity(undefined)
      setStreamingMessage('')
    }
  }

  const submitDisabled = hydrating || !prompt.trim() || needsConnection
  const stopLabel =
    queuedPrompts.length === 0
      ? 'Stop response'
      : `Stop response and clear ${queuedPrompts.length} queued ${queuedPrompts.length === 1 ? 'message' : 'messages'}`
  const sendLabel = running
    ? sendMode === 'steer' && agentStreaming
      ? 'Steer current response'
      : 'Queue message'
    : 'Send message'

  return (
    <section
      aria-label="Notebook AI editor"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background-default"
    >
      <header className="flex h-12 shrink-0 items-center justify-end gap-1 border-b border-border-default px-3">
        {threads.length > 1 ? (
          <Dropdown>
            <Tooltip content="Recent conversations">
              <DropdownTrigger>
                <Button
                  type="button"
                  variant="icon"
                  color="gray"
                  size="icon-sm"
                  aria-label="Recent AI conversations"
                  disabled={running}
                >
                  <ClockCounterClockwiseIcon
                    className="size-4"
                    aria-hidden="true"
                  />
                </Button>
              </DropdownTrigger>
            </Tooltip>
            <DropdownContent align="end" className="w-72 rounded-xl">
              <div className="px-2 py-1 font-ds-mono text-[10px] uppercase tracking-wide text-text-muted">
                Recent conversations
              </div>
              {threads.map((thread) => (
                <DropdownItem
                  key={thread.id}
                  className="min-h-11 justify-between gap-3 rounded-lg px-2.5"
                  onSelect={() => void selectThread(thread.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-text-primary">
                      {thread.title}
                    </span>
                    <span className="block text-[10px] text-text-muted">
                      {formatChatDate(thread.lastAccessedAt)}
                    </span>
                  </span>
                  {thread.id === threadId ? (
                    <>
                      <span className="sr-only">Current</span>
                      <CheckIcon
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    </>
                  ) : null}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        ) : null}
        <Tooltip content="New conversation">
          <Button
            type="button"
            variant="icon"
            color="gray"
            size="icon-sm"
            aria-label="New AI conversation"
            disabled={running || messages.length === 0}
            onClick={() => void resetConversation()}
          >
            <NotePencilIcon className="size-4" aria-hidden="true" />
          </Button>
        </Tooltip>
        {authenticated ? (
          <Tooltip content="Model connections">
            <Button
              type="button"
              variant="icon"
              color="gray"
              size="icon-sm"
              aria-label="Open model connections"
              disabled={running}
              onClick={() => {
                if (selectedModel.connection === 'byok') {
                  setSettingsProvider(selectedModel.provider)
                }
                setSettingsOpen(true)
              }}
            >
              <GearSixIcon className="size-4" aria-hidden="true" />
            </Button>
          </Tooltip>
        ) : null}
      </header>

      {!authenticated ? (
        <SetupState title="Sign in to edit with AI">
          <Button type="button" size="sm" className="mt-5" onClick={onSignIn}>
            Sign in
          </Button>
        </SetupState>
      ) : needsConnection ? (
        <SetupState title="Connect a model" align="left">
          {supportsChatGptLogin && !showApiKeySetup ? (
            chatGptLogin ? (
              <DeviceLogin
                busy={chatGptLoading}
                error={connectionError}
                login={chatGptLogin}
                onCancel={() => void cancelChatGptLogin()}
                onRefresh={() => void refreshChatGptConnection(undefined, true)}
              />
            ) : (
              <ConnectionSetup
                busy={chatGptLoading}
                error={connectionError}
                onConnect={() => void startChatGptLogin()}
                onUseKey={useApiKeyConnection}
              />
            )
          ) : (
            <>
              <ProviderSettingsForm
                apiKey={apiKeys[settingsProvider]}
                provider={settingsProvider}
                onClear={clearApiKey}
                onProviderChange={setSettingsProvider}
                onSave={saveApiKey}
              />
              {supportsChatGptLogin ? (
                <button
                  type="button"
                  className="mx-auto mt-5 block text-xs font-medium text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
                  onClick={useChatGptConnection}
                >
                  Use ChatGPT
                </button>
              ) : null}
            </>
          )}
        </SetupState>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div
              ref={transcriptRef}
              role="region"
              aria-label="Notebook AI conversation"
              className="h-full overflow-y-auto overscroll-contain [overflow-anchor:none]"
            >
              <div ref={virtualizer.containerRef} className="relative w-full">
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const row = transcriptRows[virtualItem.index]!
                  return (
                    <div
                      key={virtualItem.key}
                      ref={virtualizer.measureElement}
                      data-index={virtualItem.index}
                      className="absolute top-0 left-0 w-full"
                    >
                      <TranscriptRowView
                        row={row}
                        onCancelQueued={cancelQueuedPrompt}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            {showLatest ? (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg"
                onClick={() => virtualizer.scrollToEnd({ behavior: 'smooth' })}
              >
                <ArrowDownIcon className="size-3.5" aria-hidden="true" />
                Latest
              </Button>
            ) : null}
          </div>

          <div className="shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
            <form
              className="mx-auto w-full max-w-3xl rounded-2xl border border-border-default bg-background-surface p-2 shadow-md focus-within:border-border-focus focus-within:ring-2 focus-within:ring-border-focus/30"
              onSubmit={submit}
            >
              <label className="sr-only" htmlFor="notebook-ai-prompt">
                Notebook change
              </label>
              <textarea
                ref={promptRef}
                id="notebook-ai-prompt"
                value={prompt}
                rows={1}
                maxLength={10_000}
                placeholder="Describe a notebook change"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                className="block max-h-40 min-h-11 w-full resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center justify-between gap-3 pl-1">
                <ModelPicker
                  chatGptModels={chatGptModels}
                  disabled={running}
                  selected={selectedModel}
                  onSelect={selectModel}
                />
                <div className="flex items-center gap-1">
                  {running ? (
                    <Tooltip content={stopLabel}>
                      <Button
                        type="button"
                        variant="icon"
                        color="gray"
                        size="icon-sm"
                        rounded="full"
                        aria-label={stopLabel}
                        onClick={stopResponse}
                      >
                        <StopIcon
                          className="size-3.5"
                          weight="fill"
                          aria-hidden="true"
                        />
                      </Button>
                    </Tooltip>
                  ) : null}
                  {running && agentStreaming ? (
                    <SendModePicker mode={sendMode} onChange={setSendMode} />
                  ) : null}
                  <Tooltip content={sendLabel}>
                    <Button
                      type="submit"
                      size="icon-sm"
                      rounded="full"
                      aria-label={sendLabel}
                      disabled={submitDisabled}
                    >
                      <PaperPlaneRightIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {running
          ? 'Assistant is working.'
          : error
            ? 'Assistant request failed.'
            : messages.at(-1)?.role === 'assistant'
              ? 'Assistant response complete.'
              : ''}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {queueAnnouncement}
      </span>

      <ConnectionsDialog
        apiKeys={apiKeys}
        busy={chatGptLoading}
        chatGpt={chatGptConnection ?? disconnectedChatGpt}
        chatGptError={connectionError}
        chatGptLogin={chatGptLogin}
        open={settingsOpen}
        provider={settingsProvider}
        showChatGpt={supportsChatGptLogin}
        onCancelLogin={() => void cancelChatGptLogin()}
        onClear={clearApiKey}
        onConnect={() => void startChatGptLogin()}
        onDisconnect={() => void disconnectChatGpt()}
        onOpenChange={setSettingsOpen}
        onProviderChange={setSettingsProvider}
        onRefresh={() => void refreshChatGptConnection(undefined, true)}
        onSave={saveApiKey}
      />
    </section>
  )
}

function SetupState({
  align = 'center',
  children,
  title,
}: {
  align?: 'center' | 'left'
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-5 py-12">
      <div
        className={`w-full max-w-sm ${align === 'center' ? 'text-center' : ''}`}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ConnectionSetup({
  busy,
  error,
  onConnect,
  onUseKey,
}: {
  busy: boolean
  error: string
  onConnect: () => void
  onUseKey: () => void
}) {
  return (
    <div className="mt-5">
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={onConnect}
      >
        {busy ? (
          <SpinnerGapIcon
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        Continue with ChatGPT
      </Button>
      <p className="mt-2 text-center text-xs text-text-muted">
        Uses your ChatGPT plan.
      </p>
      <button
        type="button"
        className="mx-auto mt-5 block text-xs font-medium text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
        onClick={onUseKey}
      >
        Use an API key
      </button>
      {error ? <ErrorMessage message={error} /> : null}
    </div>
  )
}

function DeviceLogin({
  busy,
  error,
  login,
  onCancel,
  onRefresh,
}: {
  busy: boolean
  error: string
  login: NotebookChatGptLogin
  onCancel: () => void
  onRefresh: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="mt-4">
      <p className="text-sm text-text-muted">
        Enter this one-time code on OpenAI.
      </p>
      <button
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-background-subtle px-4 py-4 font-ds-mono text-xl font-semibold tracking-[0.2em]"
        aria-label={
          copied ? 'OpenAI device code copied' : 'Copy OpenAI device code'
        }
        onClick={() => {
          void copyTextToClipboard(login.userCode).then(() => setCopied(true))
        }}
      >
        {login.userCode}
        {copied ? (
          <CheckIcon className="size-4" aria-hidden="true" />
        ) : (
          <CopyIcon className="size-4" aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'OpenAI device code copied.' : ''}
      </span>
      <Button
        as="a"
        href={login.verificationUrl}
        target="_blank"
        rel="noreferrer"
        size="sm"
        className="mt-4 w-full"
      >
        Open OpenAI
      </Button>
      <div className="mt-3 flex justify-center gap-4">
        <button
          type="button"
          className="text-xs font-medium text-text-muted hover:text-text-primary"
          disabled={busy}
          onClick={onRefresh}
        >
          Check again
        </button>
        <button
          type="button"
          className="text-xs font-medium text-text-muted hover:text-text-primary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error ? <ErrorMessage message={error} /> : null}
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      className="mt-4 rounded-lg border border-border-error bg-status-error-bg px-3 py-2 text-xs/5 text-text-error"
      role="alert"
    >
      {message}
    </p>
  )
}

function TranscriptRowView({
  row,
  onCancelQueued,
}: {
  row: TranscriptRow
  onCancelQueued: (id: string) => void
}) {
  return (
    <div className="px-4 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {row.kind === 'message' ? (
          row.message.role === 'user' ? (
            <article
              aria-label="You"
              className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-background-subtle px-4 py-2.5 text-sm/6 text-text-primary"
            >
              {row.message.content}
            </article>
          ) : (
            <AssistantMessage
              activity={row.message.activity}
              content={row.message.content}
            />
          )
        ) : row.kind === 'activity' ? (
          <AssistantMessage activity={row.activity} content={row.message} />
        ) : row.kind === 'queued' ? (
          <QueuedPrompt
            prompt={row.prompt}
            onCancel={() => onCancelQueued(row.prompt.id)}
          />
        ) : (
          <ErrorMessage message={row.message} />
        )}
      </div>
    </div>
  )
}

function QueuedPrompt({
  prompt,
  onCancel,
}: {
  prompt: NotebookAiQueuedPrompt
  onCancel: () => void
}) {
  const label = prompt.mode === 'steer' ? 'Steering' : 'Queued'

  return (
    <article
      aria-label={`${label} message`}
      className="ml-auto flex w-fit max-w-[85%] items-start gap-1 rounded-2xl bg-background-subtle py-2 pr-1.5 pl-4 text-sm/6 text-text-primary"
    >
      <div className="min-w-0">
        <p className="whitespace-pre-wrap">{prompt.content}</p>
        <p className="mt-1 font-ds-mono text-[10px] uppercase tracking-wide text-text-muted">
          {label}
        </p>
      </div>
      <Tooltip content={`Remove ${label.toLowerCase()} message`}>
        <Button
          type="button"
          variant="icon"
          color="gray"
          size="icon-sm"
          className="shrink-0"
          aria-label={`Remove ${label.toLowerCase()} message`}
          onClick={onCancel}
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </Tooltip>
    </article>
  )
}

function AssistantMessage({
  activity,
  content,
}: {
  activity?: NotebookAiActivity
  content: string
}) {
  return (
    <article aria-label="Assistant" className="space-y-3">
      {activity ? <NotebookAgentActivity activity={activity} /> : null}
      {content ? (
        <div className="prose prose-sm prose-gray dark:prose-invert max-w-none break-words text-text-secondary prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-background-subtle prose-pre:p-3">
          <MarkdownRenderer allowHtml={false}>{content}</MarkdownRenderer>
        </div>
      ) : null}
    </article>
  )
}

function ModelPicker({
  chatGptModels,
  disabled,
  selected,
  onSelect,
}: {
  chatGptModels: ReadonlyArray<ChatGptModelChoice>
  disabled: boolean
  selected: ModelChoice
  onSelect: (model: ModelChoice) => void
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          type="button"
          variant="ghost"
          color="gray"
          size="xs"
          disabled={disabled}
          className="max-w-52 px-2"
        >
          <span className="truncate">{selected.label}</span>
          <CaretDownIcon className="size-3" aria-hidden="true" />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="start" side="top" className="w-64 rounded-xl">
        {chatGptModels.length ? (
          <>
            <ModelGroup
              label="ChatGPT"
              models={chatGptModels}
              selected={selected}
              onSelect={onSelect}
            />
            <DropdownSeparator />
          </>
        ) : null}
        <ModelGroup
          label="OpenAI API key"
          models={byokModelChoices.filter(
            (model) => model.provider === 'openai',
          )}
          selected={selected}
          onSelect={onSelect}
        />
        <DropdownSeparator />
        <ModelGroup
          label="Anthropic API key"
          models={byokModelChoices.filter(
            (model) => model.provider === 'anthropic',
          )}
          selected={selected}
          onSelect={onSelect}
        />
      </DropdownContent>
    </Dropdown>
  )
}

function SendModePicker({
  mode,
  onChange,
}: {
  mode: NotebookAiSendMode
  onChange: (mode: NotebookAiSendMode) => void
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          type="button"
          variant="ghost"
          color="gray"
          size="xs"
          aria-label={`Send mode: ${mode === 'queue' ? 'Queue' : 'Steer'}`}
          className="px-2"
        >
          {mode === 'queue' ? 'Queue' : 'Steer'}
          <CaretDownIcon className="size-3" aria-hidden="true" />
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end" side="top" className="w-72 rounded-xl">
        <DropdownItem
          className="min-h-12 justify-between gap-3 rounded-lg px-2.5"
          onSelect={() => onChange('queue')}
        >
          <span>
            <span className="block text-sm text-text-primary">Queue</span>
            <span className="block text-xs text-text-muted">
              Send after the current response
            </span>
          </span>
          {mode === 'queue' ? (
            <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
          ) : null}
        </DropdownItem>
        <DropdownItem
          className="min-h-12 justify-between gap-3 rounded-lg px-2.5"
          onSelect={() => onChange('steer')}
        >
          <span>
            <span className="block text-sm text-text-primary">Steer</span>
            <span className="block text-xs text-text-muted">
              Stop this response and send now
            </span>
          </span>
          {mode === 'steer' ? (
            <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
          ) : null}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

function ModelGroup({
  label,
  models,
  selected,
  onSelect,
}: {
  label: string
  models: ReadonlyArray<ModelChoice>
  selected: ModelChoice
  onSelect: (model: ModelChoice) => void
}) {
  return (
    <div>
      <div className="px-2 py-1 font-ds-mono text-[10px] uppercase tracking-wide text-text-muted">
        {label}
      </div>
      {models.map((model) => (
        <DropdownItem
          key={`${model.connection}:${model.model}`}
          className="min-h-10 justify-between rounded-lg px-2.5"
          onSelect={() => onSelect(model)}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm text-text-primary">
              {model.label}
            </span>
            <span className="block truncate font-ds-mono text-[10px] text-text-muted">
              {model.model}
            </span>
          </span>
          {isSelectedModel(selected, model) ? (
            <>
              <span className="sr-only">Selected</span>
              <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
            </>
          ) : null}
        </DropdownItem>
      ))}
    </div>
  )
}

function isSelectedModel(selected: ModelChoice, model: ModelChoice) {
  return (
    selected.connection === model.connection &&
    selected.model === model.model &&
    (selected.connection === 'chatgpt' ||
      model.connection === 'chatgpt' ||
      selected.provider === model.provider)
  )
}

function ConnectionsDialog({
  apiKeys,
  busy,
  chatGpt,
  chatGptError,
  chatGptLogin,
  open,
  provider,
  showChatGpt,
  onCancelLogin,
  onClear,
  onConnect,
  onDisconnect,
  onOpenChange,
  onProviderChange,
  onRefresh,
  onSave,
}: {
  apiKeys: Record<NotebookAiRemoteProvider, string>
  busy: boolean
  chatGpt: NotebookChatGptConnection
  chatGptError: string
  chatGptLogin: NotebookChatGptLogin | undefined
  open: boolean
  provider: NotebookAiRemoteProvider
  showChatGpt: boolean
  onCancelLogin: () => void
  onClear: (provider: NotebookAiRemoteProvider) => void
  onConnect: () => void
  onDisconnect: () => void
  onOpenChange: (open: boolean) => void
  onProviderChange: (provider: NotebookAiRemoteProvider) => void
  onRefresh: () => void
  onSave: (provider: NotebookAiRemoteProvider, apiKey: string) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-[1000] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-default bg-background-surface text-text-primary shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          <header className="flex h-14 items-center justify-between border-b border-border-default px-5">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Model connections
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                aria-label="Close model connections"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <DialogPrimitive.Description className="sr-only">
            Connect a ChatGPT plan or configure an API key.
          </DialogPrimitive.Description>
          <div className="space-y-6 p-5">
            {showChatGpt ? (
              <div>
                <h3 className="text-sm font-medium">ChatGPT</h3>
                {chatGpt.connected ? (
                  <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border-default p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {chatGpt.email || 'Connected'}
                      </p>
                      {chatGpt.planType ? (
                        <p className="mt-0.5 text-xs text-text-muted">
                          {formatPlan(chatGpt.planType)} plan
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      onClick={onDisconnect}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : chatGptLogin ? (
                  <DeviceLogin
                    busy={busy}
                    error={chatGptError}
                    login={chatGptLogin}
                    onCancel={onCancelLogin}
                    onRefresh={onRefresh}
                  />
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      disabled={busy}
                      onClick={onConnect}
                    >
                      {busy ? (
                        <SpinnerGapIcon
                          className="size-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : null}
                      Continue with ChatGPT
                    </Button>
                    {chatGptError ? (
                      <ErrorMessage message={chatGptError} />
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <div
              className={
                showChatGpt ? 'border-t border-border-default pt-5' : ''
              }
            >
              <h3 className="text-sm font-medium">API key</h3>
              <ProviderSettingsForm
                apiKey={apiKeys[provider]}
                provider={provider}
                onClear={onClear}
                onProviderChange={onProviderChange}
                onSave={onSave}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ProviderSettingsForm({
  apiKey,
  provider,
  onClear,
  onProviderChange,
  onSave,
}: {
  apiKey: string
  provider: NotebookAiRemoteProvider
  onClear: (provider: NotebookAiRemoteProvider) => void
  onProviderChange: (provider: NotebookAiRemoteProvider) => void
  onSave: (provider: NotebookAiRemoteProvider, apiKey: string) => void
}) {
  const [draftKey, setDraftKey] = React.useState(apiKey)
  const providerId = React.useId()
  const apiKeyId = React.useId()
  React.useEffect(() => setDraftKey(apiKey), [apiKey, provider])

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (draftKey.trim()) onSave(provider, draftKey)
      }}
    >
      <div>
        <label
          htmlFor={providerId}
          className="block text-xs font-medium text-text-muted"
        >
          Provider
        </label>
        <FormSelect
          id={providerId}
          value={provider}
          className="mt-1.5"
          onChange={(event) =>
            onProviderChange(parseNotebookAiProvider(event.target.value))
          }
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </FormSelect>
      </div>
      <div>
        <label
          htmlFor={apiKeyId}
          className="block text-xs font-medium text-text-muted"
        >
          {provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key
        </label>
        <FormInput
          id={apiKeyId}
          type="password"
          value={draftKey}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 font-ds-mono text-sm"
          onChange={(event) => setDraftKey(event.target.value)}
        />
      </div>
      <p className="text-xs/5 text-text-muted">
        Kept in memory. Leaving or refreshing clears it.
      </p>
      <div className="flex justify-end gap-2">
        {apiKey ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onClear(provider)}
          >
            Remove key
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!draftKey.trim()}>
          {apiKey ? 'Update key' : 'Use key'}
        </Button>
      </div>
    </form>
  )
}

async function runChatGptAgent({
  activityId,
  abortController,
  execution,
  hiddenFiles,
  messages,
  model,
  onActivityEvent,
  onText,
  threadId,
}: {
  activityId: string
  abortController: AbortController
  execution: NotebookAiExecution
  hiddenFiles: ReadonlyArray<string>
  messages: Array<NotebookAiMessage>
  model: string
  onActivityEvent: (event: NotebookAiActivityEvent) => void
  onText: (text: string) => void
  threadId: string
}) {
  return runNotebookAiStream({
    endpoint: '/api/notebook/chatgpt/assist',
    activityId,
    forwardedProps: { model, execution, hiddenFiles },
    includeReasoningSummaries: true,
    messages,
    onActivityEvent,
    onText,
    signal: abortController.signal,
    threadId,
  })
}

async function runRemoteAgent({
  activityId,
  abortController,
  apiKey,
  execution,
  hiddenFiles,
  messages,
  model,
  onActivityEvent,
  onText,
  provider,
  threadId,
}: {
  activityId: string
  abortController: AbortController
  apiKey: string
  execution: NotebookAiExecution
  hiddenFiles: ReadonlyArray<string>
  messages: Array<NotebookAiMessage>
  model: string
  onActivityEvent: (event: NotebookAiActivityEvent) => void
  onText: (text: string) => void
  provider: NotebookAiRemoteProvider
  threadId: string
}) {
  return runNotebookAiStream({
    endpoint: '/api/notebook/assist',
    activityId,
    forwardedProps: {
      provider,
      model,
      apiKey,
      execution,
      hiddenFiles,
    },
    messages,
    onActivityEvent,
    onText,
    signal: abortController.signal,
    threadId,
  })
}

async function requestChatGptConnection(body: unknown) {
  const response = await fetch('/api/notebook/chatgpt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) throw new Error(readErrorMessage(value, response.status))
  return value
}

function chatGptModelChoice(
  model: NotebookChatGptConnection['models'][number],
): ChatGptModelChoice {
  return { connection: 'chatgpt', model: model.id, label: model.label }
}

function getPreferredChatGptModel(connection: NotebookChatGptConnection) {
  return (
    connection.models.find((model) => model.id === openAiDefault.model) ??
    connection.models.find((model) => model.isDefault) ??
    connection.models[0]
  )
}

function createRepairDiagnostic(
  result: Extract<ExampleWorkbenchRunResult, { ok: false }>,
) {
  const message = result.message.slice(0, maxRuntimeErrorCharacters)
  return `The notebook was updated, but it failed during ${result.phase}:\n\n${message}\n\nFix this error now. Inspect the current workspace, make only the necessary changes, and keep the requested behavior.`
}

function formatRunError(
  result: Extract<ExampleWorkbenchRunResult, { ok: false }>,
) {
  if (result.phase === 'compile' || result.phase === 'runtime') {
    return `The notebook still fails after ${maxRepairAttempts} repair attempts: ${result.message}`
  }
  return result.message
}

function createTranscriptMessage(
  role: NotebookAiMessage['role'],
  content: string,
  activity?: NotebookAiActivity,
): TranscriptMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    ...(activity ? { activity } : {}),
  }
}

function readErrorMessage(value: unknown, status: number) {
  if (isRecord(value) && typeof value.error === 'string') return value.error
  return `Notebook AI request failed (${status})`
}

function parseNotebookAiProvider(value: string): NotebookAiRemoteProvider {
  return value === 'anthropic' ? 'anthropic' : 'openai'
}

function formatPlan(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function formatChatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
