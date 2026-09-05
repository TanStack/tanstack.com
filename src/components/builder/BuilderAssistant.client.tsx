import * as React from 'react'
import {
  ArrowDownIcon,
  CaretDownIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  GearSixIcon,
  NotePencilIcon,
  PaperPlaneRightIcon,
  SidebarSimpleIcon,
  SpinnerGapIcon,
  StopIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Markdown as MarkdownRenderer } from '@tanstack/markdown/react'
import type { ByokClient, ByokSnapshot } from '@tanstack/ai-client/byok'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  FormInput,
  FormSelect,
} from '~/components/ds/ui'
import type { ExampleWorkbenchRunResult } from '~/components/examples/ExampleWorkbench.client'
import { BuilderAgentActivity } from '~/components/builder/BuilderAgentActivity'
import { useBuilderWorkspaceControls } from '~/components/builder/builder-workspace-controls.client'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  compactBuilderAiActivityForDurableSync,
  parseBuilderAiActivity,
  reduceBuilderAiActivity,
  type BuilderAiActivity,
  type BuilderAiActivityEvent,
} from '~/utils/builder-ai-activity'
import {
  parseBuilderChatGptConnection,
  parseBuilderChatGptLogin,
  type BuilderChatGptConnection,
  type BuilderChatGptLogin,
} from '~/utils/builder-ai-chatgpt'
import {
  cloneBuilderAiExecution,
  builderAiDefaultRemoteModels,
  builderAiRemoteModels,
  builderAiRemoteProviders,
  serializeBuilderAiExecution,
  type BuilderAiExecution,
  type BuilderAiMessage,
  type BuilderAiRemoteModel,
  type BuilderAiRemoteProvider,
} from '~/utils/builder-ai'
import {
  getBrowserBuilderAiByokConnection,
  type BuilderAiByokConnection,
} from '~/utils/builder-ai-api-key-storage.client'
import {
  createBuilderAiCheckpoint,
  loadLatestBuilderAiCheckpoint,
  builderAiCheckpointMatchesExecution,
  removeBuilderAiCheckpoint,
  updateBuilderAiCheckpointExpectedExecution,
  type BuilderAiCheckpoint,
} from '~/utils/builder-ai-checkpoints.client'
import {
  createBuilderAiEnvironmentSnapshot,
  formatBuilderAiEnvironmentEvidence,
  shouldRestoreBuilderAiCheckpoint,
  validateBuilderAiCompletion,
} from '~/utils/builder-ai-environment'
import {
  createBuilderAiThreadId,
  listBuilderAiThreads,
  loadBuilderAiTranscript,
  replaceBuilderAiTranscriptMessage,
  saveBuilderAiTranscript,
  type BuilderAiThread,
} from '~/utils/builder-ai-persistence.client'
import {
  builderProjectSyncCommandSchema,
  type BuilderProjectSyncCommand,
  type BuilderProjectSyncCommandResult,
  type BuilderProjectSyncMessage,
  type BuilderProjectSyncProject,
  type BuilderProjectSyncRun,
  type BuilderProjectSyncThread,
} from '~/utils/builder-project-sync'
import {
  clearBuilderProjectPendingPrompt,
  listBuilderProjectPendingPrompts,
  saveBuilderProjectPendingPrompt,
  type BuilderProjectPendingPrompt,
} from '~/utils/builder-project-pending-prompt.client'
import {
  BuilderProjectSyncCommandRejectedError,
  listBuilderProjectSyncOutbox,
} from '~/utils/builder-project-sync-outbox.client'
import type { BuilderProjectSyncRunEnqueueCommands } from '~/utils/builder-project-sync.client'
import {
  fingerprintBuilderAiDiagnostic,
  fingerprintBuilderAiValue,
  recordBuilderAiFailure,
  type BuilderAiFailureObservation,
} from '~/utils/builder-ai-progress'
import {
  BuilderAiPromptQueue,
  type BuilderAiPromptLifecycle,
  type BuilderAiQueuedPrompt,
  type BuilderAiSendMode,
} from '~/utils/builder-ai-prompt-queue'
import {
  runBuilderAiStream,
  type BuilderAiStreamValidationOutcome,
} from '~/utils/builder-ai-stream.client'
import type { BuilderAiValidationState } from '~/utils/builder-ai-validation'

type ByokModelChoice = {
  connection: 'byok'
  provider: BuilderAiRemoteProvider
  model: string
  label: string
  description: string
}

type ChatGptModelChoice = {
  connection: 'chatgpt'
  model: string
  label: string
}

type ModelChoice = ByokModelChoice | ChatGptModelChoice

type TranscriptMessage = BuilderAiMessage & {
  id: string
  activity?: BuilderAiActivity
}

type TranscriptRow =
  | { id: string; kind: 'message'; message: TranscriptMessage }
  | {
      id: string
      kind: 'queued'
      prompt: BuilderAiQueuedPrompt
      connection?: {
        provider: BuilderAiRemoteProvider
        locked: boolean
      }
    }
  | {
      id: 'activity'
      kind: 'activity'
      activity: BuilderAiActivity
      message: string
    }
  | { id: 'error'; kind: 'error'; message: string }
  | { id: 'checkpoint'; kind: 'checkpoint' }

type RollbackCheckpoint = {
  id: string
  execution: BuilderAiExecution
  persisted?: BuilderAiCheckpoint
}

const maxContinuousValidationAttempts = 8
const supportsChatGptLogin = import.meta.env.DEV

const openAiDefault = {
  connection: 'byok',
  ...builderAiDefaultRemoteModels.openai,
} satisfies ByokModelChoice

const anthropicDefault = {
  connection: 'byok',
  ...builderAiDefaultRemoteModels.anthropic,
} satisfies ByokModelChoice

function toByokModelChoice(model: BuilderAiRemoteModel): ByokModelChoice {
  return { connection: 'byok', ...model }
}

const byokModelChoices = builderAiRemoteModels.map(toByokModelChoice)

const defaultModelByProvider = {
  openai: openAiDefault,
  anthropic: anthropicDefault,
} satisfies Record<BuilderAiRemoteProvider, ByokModelChoice>

const chatGptPlaceholder = {
  connection: 'chatgpt',
  model: '',
  label: 'ChatGPT',
} satisfies ChatGptModelChoice

const disconnectedChatGpt = {
  connected: false,
  models: [],
} satisfies BuilderChatGptConnection

function getInitialModelChoice(): ModelChoice {
  return supportsChatGptLogin ? chatGptPlaceholder : openAiDefault
}

export type BuilderAssistantHandle = {
  persistTranscript(): Promise<void>
  submitPrompt(content: string, lifecycle?: BuilderAiPromptLifecycle): boolean
}

type BuilderRunFinishCommand = Extract<
  BuilderProjectSyncCommand,
  { type: 'run.finish' }
>

export type BuilderAssistantRevisionCommit = NonNullable<
  BuilderRunFinishCommand['revision']
>

export type BuilderAssistantProjectSync = {
  browserSessionId: string
  project: BuilderProjectSyncProject
  threads: ReadonlyArray<BuilderProjectSyncThread>
  messages: ReadonlyArray<BuilderProjectSyncMessage>
  runs: ReadonlyArray<BuilderProjectSyncRun>
  executeCommand: (
    command: BuilderProjectSyncCommand,
  ) => Promise<BuilderProjectSyncCommandResult>
  executeRunEnqueue: (
    commands: BuilderProjectSyncRunEnqueueCommands,
  ) => Promise<BuilderProjectSyncCommandResult>
}

type BuilderAssistantProps = {
  credentialScope?: string
  enabled: boolean
  getExecution: () => BuilderAiExecution
  hiddenFiles: ReadonlyArray<string>
  onApply: (
    execution: BuilderAiExecution,
    signal: AbortSignal,
  ) => Promise<ExampleWorkbenchRunResult>
  onCommit?: (
    execution: BuilderAiExecution,
  ) =>
    | BuilderAssistantRevisionCommit
    | void
    | Promise<BuilderAssistantRevisionCommit | void>
  onDismiss?: () => void
  onFinish?: () => void
  onPrepare?: () => Promise<BuilderAiExecution>
  onRevisionConflict?: (revision: BuilderAssistantRevisionCommit) => void
  onRestore: (
    execution: BuilderAiExecution,
    reason: 'manual' | 'rollback',
  ) => void | Promise<void>
  onRunningChange?: (running: boolean) => void
  projectSync?: BuilderAssistantProjectSync
  storageScope?: string
}

export const BuilderAssistant = React.forwardRef<
  BuilderAssistantHandle,
  BuilderAssistantProps
>(function BuilderAssistant(
  {
    credentialScope,
    enabled,
    getExecution,
    hiddenFiles,
    onApply,
    onCommit,
    onDismiss,
    onFinish,
    onPrepare,
    onRevisionConflict,
    onRestore,
    onRunningChange,
    projectSync,
    storageScope,
  },
  ref,
) {
  const byokConnection = React.useMemo(
    () => getBrowserBuilderAiByokConnection(credentialScope),
    [credentialScope],
  )
  const byokConnectionSnapshot = React.useSyncExternalStore(
    byokConnection.subscribe,
    byokConnection.getSnapshot,
    byokConnection.getSnapshot,
  )
  const byokSnapshot = React.useSyncExternalStore(
    byokConnection.current.subscribe,
    byokConnection.current.getSnapshot,
    byokConnection.current.getSnapshot,
  )
  const legacyByokSnapshot = React.useSyncExternalStore(
    byokConnection.legacy.subscribe,
    byokConnection.legacy.getSnapshot,
    byokConnection.legacy.getSnapshot,
  )
  const syncedProjectId = projectSync?.project.id
  const syncedThreads = projectSync?.threads
  const syncedMessages = projectSync?.messages
  const syncedRuns = projectSync?.runs
  const builderWorkspaceControls = useBuilderWorkspaceControls()
  const sidePanelButtonRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (builderWorkspaceControls?.open !== false) return
    sidePanelButtonRef.current?.focus()
  }, [builderWorkspaceControls?.open])
  const [selectedModel, setSelectedModel] = React.useState<ModelChoice>(() =>
    getInitialModelChoice(),
  )
  const [settingsProvider, setSettingsProvider] =
    React.useState<BuilderAiRemoteProvider>('openai')
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [showApiKeySetup, setShowApiKeySetup] = React.useState(false)
  const [chatGptConnection, setChatGptConnection] =
    React.useState<BuilderChatGptConnection>()
  const [chatGptLogin, setChatGptLogin] = React.useState<BuilderChatGptLogin>()
  const [chatGptLoading, setChatGptLoading] =
    React.useState(supportsChatGptLogin)
  const [connectionError, setConnectionError] = React.useState('')
  const [apiKeyStorageError, setApiKeyStorageError] = React.useState('')
  const [prompt, setPrompt] = React.useState('')
  const [messages, setMessages] = React.useState<Array<TranscriptMessage>>([])
  const [queuedPrompts, setQueuedPrompts] = React.useState<
    ReadonlyArray<BuilderAiQueuedPrompt>
  >([])
  const [threadId, setThreadId] = React.useState(() =>
    projectSync
      ? (getMostRecentBuilderProjectThread(projectSync.threads)?.id ??
        createBuilderAiThreadId())
      : storageScope
        ? (listBuilderAiThreads(storageScope)[0]?.id ??
          createBuilderAiThreadId())
        : createBuilderAiThreadId(),
  )
  const [threads, setThreads] = React.useState<Array<BuilderAiThread>>(() =>
    projectSync
      ? getBuilderProjectThreads(projectSync.threads)
      : storageScope
        ? listBuilderAiThreads(storageScope)
        : [],
  )
  const [hydratedThreadId, setHydratedThreadId] = React.useState<string>()
  const [liveActivity, setLiveActivity] = React.useState<BuilderAiActivity>()
  const [streamingMessage, setStreamingMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [rollbackCheckpoint, setRollbackCheckpoint] =
    React.useState<RollbackCheckpoint>()
  const [running, setRunning] = React.useState(false)
  const [agentStreaming, setAgentStreaming] = React.useState(false)
  const [sendMode, setSendMode] = React.useState<BuilderAiSendMode>('queue')
  const [queueAnnouncement, setQueueAnnouncement] = React.useState('')
  const [showLatest, setShowLatest] = React.useState(false)
  const abortRef = React.useRef<AbortController>(null)
  const onRunningChangeRef = React.useRef(onRunningChange)
  const abortIntentRef = React.useRef<'steer' | 'stop' | undefined>(undefined)
  const agentStreamingRef = React.useRef(false)
  const getExecutionRef = React.useRef(getExecution)
  const messagesRef = React.useRef<Array<TranscriptMessage>>([])
  const rollbackCheckpointRef = React.useRef<RollbackCheckpoint | undefined>(
    undefined,
  )
  const promptQueueRef = React.useRef(new BuilderAiPromptQueue())
  const unrecordedPromptRef = React.useRef<BuilderAiQueuedPrompt | undefined>(
    undefined,
  )
  const transcriptRef = React.useRef<HTMLDivElement>(null)
  const promptRef = React.useRef<HTMLTextAreaElement>(null)
  const didInitialScrollRef = React.useRef(false)
  const hydrationGenerationRef = React.useRef(0)
  const checkpointHydrationGenerationRef = React.useRef(0)
  const checkpointHydrationPromiseRef = React.useRef<
    Promise<
      | {
          checkpoint: RollbackCheckpoint
          scope: string
        }
      | undefined
    >
  >(Promise.resolve(undefined))
  const didSelectConnectionRef = React.useRef(false)
  const credentialScopeRef = React.useRef(credentialScope)
  const threadCreationMutationIdsRef = React.useRef(new Map<string, string>())
  const activePendingPromptIdRef = React.useRef<string | undefined>(undefined)
  const recoveredPendingPromptIdsRef = React.useRef(new Set<string>())
  const pendingPromptsRef = React.useRef(
    new Map<string, BuilderProjectPendingPrompt>(),
  )
  const pendingPromptWriteQueueRef = React.useRef(Promise.resolve())
  const pendingSubmissionGenerationRef = React.useRef(0)
  const unlockAllowedPromptIdsRef = React.useRef(new Set<string>())
  const mountedRef = React.useRef(true)
  const promptValueRef = React.useRef(prompt)
  const canUsePendingPromptRef = React.useRef(canUsePendingPrompt)
  const startPromptSequenceRef = React.useRef(startPromptSequence)

  getExecutionRef.current = getExecution
  onRunningChangeRef.current = onRunningChange
  promptValueRef.current = prompt
  canUsePendingPromptRef.current = canUsePendingPrompt
  startPromptSequenceRef.current = startPromptSequence

  React.useLayoutEffect(() => {
    if (credentialScopeRef.current === credentialScope) return
    credentialScopeRef.current = credentialScope
    abortIntentRef.current = 'stop'
    abortRef.current?.abort()
    discardUnrecordedPrompt()
    promptQueueRef.current.clear()
    unlockAllowedPromptIdsRef.current.clear()
    setQueuedPrompts([])

    const chatGptModel = chatGptConnection?.connected
      ? getPreferredChatGptModel(chatGptConnection)
      : undefined
    const nextModel = chatGptModel
      ? chatGptModelChoice(chatGptModel)
      : getInitialModelChoice()

    didSelectConnectionRef.current = false
    setSelectedModel(nextModel)
    setSettingsProvider(
      nextModel.connection === 'byok' ? nextModel.provider : 'openai',
    )
    setSettingsOpen(false)
    setShowApiKeySetup(false)
    setApiKeyStorageError('')
  }, [chatGptConnection, credentialScope])

  const chatGptModels = React.useMemo<Array<ChatGptModelChoice>>(
    () =>
      (chatGptConnection?.models ?? []).map((model) => ({
        connection: 'chatgpt',
        model: model.id,
        label: model.label,
      })),
    [chatGptConnection?.models],
  )
  const byokReady = byokConnectionSnapshot.ready
  const selectedByokConfigured =
    selectedModel.connection === 'byok' &&
    byokConnection.hasConfiguredKey(selectedModel.provider)
  const hasChatGptModel =
    selectedModel.connection === 'chatgpt' &&
    chatGptConnection?.connected === true &&
    chatGptConnection.models.some((model) => model.id === selectedModel.model)
  const needsConnection =
    !byokReady ||
    (selectedModel.connection === 'chatgpt'
      ? !hasChatGptModel
      : !selectedByokConfigured)

  React.useLayoutEffect(() => {
    if (!byokReady || didSelectConnectionRef.current) return
    const provider = builderAiRemoteProviders.find((candidate) =>
      byokConnection.hasConfiguredKey(candidate),
    )
    if (!provider) return
    didSelectConnectionRef.current = true
    setSelectedModel((current) =>
      current.connection === 'byok' && current.provider === provider
        ? current
        : defaultModelByProvider[provider],
    )
    setSettingsProvider(provider)
  }, [byokConnection, byokReady, byokSnapshot, legacyByokSnapshot])

  const hydrating = Boolean(
    (projectSync || storageScope) && hydratedThreadId !== threadId,
  )
  const getQueuedPromptConnection = React.useCallback(
    (queuedPrompt: BuilderAiQueuedPrompt) => {
      const pendingPrompt = pendingPromptsRef.current.get(queuedPrompt.id)
      const provider = pendingPrompt
        ? builderAiRemoteProviders.find(
            (candidate) => candidate === pendingPrompt.provider,
          )
        : undefined
      if (!pendingPrompt || !provider) return undefined
      const hasLegacyKey = legacyByokSnapshot.status[provider]?.state === 'set'
      if (
        byokConnection.getClient(provider, { allowUnlock: false }) ||
        (pendingPrompt.provider === 'openai' &&
          chatGptConnection?.connected === true &&
          chatGptConnection.models.some(
            (model) => model.id === pendingPrompt.model,
          ))
      ) {
        return undefined
      }
      return {
        provider,
        locked:
          byokSnapshot.status[provider]?.state === 'locked' && !hasLegacyKey,
      }
    },
    [byokConnection, byokSnapshot, chatGptConnection, legacyByokSnapshot],
  )
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
        connection: getQueuedPromptConnection(queuedPrompt),
      })),
    )
    if (error) rows.push({ id: 'error', kind: 'error', message: error })
    if (rollbackCheckpoint) {
      rows.push({ id: 'checkpoint', kind: 'checkpoint' })
    }
    return rows
  }, [
    error,
    getQueuedPromptConnection,
    liveActivity,
    messages,
    queuedPrompts,
    rollbackCheckpoint,
    streamingMessage,
  ])

  const getItemKey = React.useCallback(
    (index: number) => transcriptRows[index]!.id,
    [transcriptRows],
  )
  const virtualizer = useVirtualizer({
    count: transcriptRows.length,
    getScrollElement: () => transcriptRef.current,
    estimateSize: () => 96,
    getItemKey,
    paddingStart: 48,
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
    setThreads(
      syncedProjectId && syncedThreads
        ? getBuilderProjectThreads(syncedThreads)
        : storageScope
          ? listBuilderAiThreads(storageScope)
          : [],
    )
  }, [storageScope, syncedProjectId, syncedThreads])

  React.useEffect(() => {
    const generation = checkpointHydrationGenerationRef.current + 1
    checkpointHydrationGenerationRef.current = generation
    let active = true
    rollbackCheckpointRef.current = undefined
    setRollbackCheckpoint(undefined)
    if (!storageScope) {
      checkpointHydrationPromiseRef.current = Promise.resolve(undefined)
      return
    }

    const hydration = loadLatestBuilderAiCheckpoint(storageScope)
      .then(async (snapshot) => {
        if (!snapshot) return undefined
        const currentExecution = getExecutionRef.current()
        const matchesExpected = await builderAiCheckpointMatchesExecution(
          snapshot.checkpoint,
          currentExecution,
        )
        const needsRestore =
          serializeBuilderAiExecution(snapshot.execution) !==
          serializeBuilderAiExecution(currentExecution)
        if (!matchesExpected || !needsRestore) {
          await removeBuilderAiCheckpoint(storageScope, snapshot.checkpoint.id)
          return undefined
        }
        return {
          checkpoint: {
            id: snapshot.checkpoint.id,
            execution: snapshot.execution,
            persisted: snapshot.checkpoint,
          },
          scope: storageScope,
        }
      })
      .catch(() => undefined)
    checkpointHydrationPromiseRef.current = hydration
    void hydration.then((hydrated) => {
      if (
        !active ||
        generation !== checkpointHydrationGenerationRef.current ||
        !hydrated
      ) {
        return
      }
      const { checkpoint } = hydrated
      rollbackCheckpointRef.current = checkpoint
      setRollbackCheckpoint(checkpoint)
    })

    return () => {
      active = false
    }
  }, [storageScope])

  React.useEffect(() => {
    if (syncedProjectId && syncedThreads && syncedMessages && syncedRuns) {
      const selectedThread = syncedThreads.find(
        (thread) => thread.id === threadId && thread.archivedAt === null,
      )
      if (!selectedThread) {
        const nextThread = getMostRecentBuilderProjectThread(syncedThreads)
        if (nextThread) {
          setThreadId(nextThread.id)
          return
        }
      }

      if (hydratedThreadId !== threadId) {
        setLiveActivity(undefined)
        setStreamingMessage('')
        setShowLatest(false)
        didInitialScrollRef.current = false
      }
      const nextMessages = getBuilderProjectTranscriptMessages(
        threadId,
        syncedMessages,
        syncedRuns,
      )
      messagesRef.current = nextMessages
      setMessages(nextMessages)
      setThreads(getBuilderProjectThreads(syncedThreads))
      setHydratedThreadId(threadId)
      return
    }

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

    void loadBuilderAiTranscript(storageScope, threadId).then((transcript) => {
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
  }, [
    hydratedThreadId,
    refreshThreads,
    storageScope,
    syncedMessages,
    syncedProjectId,
    syncedRuns,
    syncedThreads,
    threadId,
  ])

  React.useEffect(() => {
    const currentProjectSync = projectSync
    const currentProjectId = syncedProjectId
    const currentMessages = syncedMessages
    const currentRuns = syncedRuns
    if (
      !currentProjectSync ||
      !currentProjectId ||
      !currentMessages ||
      !currentRuns
    ) {
      return
    }

    let active = true
    void recoverPendingPrompt({
      projectSync: currentProjectSync,
      projectId: currentProjectId,
      messages: currentMessages,
      runs: currentRuns,
    }).catch((cause: unknown) => {
      if (active) {
        setError(`Could not recover the pending message: ${formatError(cause)}`)
      }
    })

    return () => {
      active = false
    }

    async function recoverPendingPrompt({
      projectSync: durableProjectSync,
      projectId,
      messages: durableMessages,
      runs: durableRuns,
    }: {
      projectSync: BuilderAssistantProjectSync
      projectId: string
      messages: ReadonlyArray<BuilderProjectSyncMessage>
      runs: ReadonlyArray<BuilderProjectSyncRun>
    }) {
      const [cachedPrompts, outbox] = await Promise.all([
        listBuilderProjectPendingPrompts(projectId),
        listBuilderProjectSyncOutbox(projectId),
      ])
      if (!active) return
      const offlineEnqueueMutationIds = new Set(
        outbox.flatMap((entry) =>
          entry.command.type === 'run.enqueue'
            ? [entry.command.clientMutationId]
            : [],
        ),
      )
      const cachedByRunId = new Map(
        cachedPrompts.map((pendingPrompt) => [
          pendingPrompt.runId,
          pendingPrompt,
        ]),
      )
      const messagesByRunId = new Map(
        durableMessages
          .filter(
            (message) => message.role === 'user' && message.runId !== null,
          )
          .map((message) => [message.runId, message]),
      )
      const threadsById = new Map(
        durableProjectSync.threads.map((thread) => [thread.id, thread]),
      )
      const durablePendingPrompts = durableRuns
        .filter((run) => run.status === 'pending')
        .map((run) => {
          const message = messagesByRunId.get(run.id)
          const thread = threadsById.get(run.threadId)
          if (!message || !thread) return undefined
          const current = pendingPromptsRef.current.get(run.id)
          const cached = cachedByRunId.get(run.id)
          const reusable = [current, cached].find(
            (candidate) =>
              candidate?.leaseOwnerId === durableProjectSync.browserSessionId,
          )
          return reusable
            ? {
                ...reusable,
                queueKind: run.queueKind,
                content: message.content,
                provider: run.provider,
                model: run.model,
                createdAt: run.createdAt,
              }
            : createRecoveredPendingPrompt({
                projectId,
                projectSync: durableProjectSync,
                run,
                message,
                thread,
              })
        })
        .filter(
          (pendingPrompt): pendingPrompt is BuilderProjectPendingPrompt =>
            pendingPrompt !== undefined,
        )
      const durablePendingIds = new Set(
        durablePendingPrompts.map((pendingPrompt) => pendingPrompt.promptId),
      )
      const pendingPrompts = orderPendingPrompts([
        ...durablePendingPrompts,
        ...cachedPrompts.filter(
          (pendingPrompt) =>
            !durablePendingIds.has(pendingPrompt.promptId) &&
            pendingPrompt.leaseOwnerId ===
              durableProjectSync.browserSessionId &&
            offlineEnqueueMutationIds.has(
              pendingPrompt.runEnqueueClientMutationId,
            ),
        ),
      ])
      const pendingIds = new Set(
        pendingPrompts.map((pendingPrompt) => pendingPrompt.promptId),
      )
      for (const cached of cachedPrompts) {
        if (!pendingIds.has(cached.promptId)) {
          void clearBuilderProjectPendingPrompt(projectId, cached.promptId)
        }
      }
      for (const pendingPrompt of pendingPrompts) {
        pendingPromptsRef.current.set(pendingPrompt.promptId, pendingPrompt)
      }

      let queueChanged = false
      for (const queuedPrompt of promptQueueRef.current.items) {
        if (
          !pendingIds.has(queuedPrompt.id) &&
          activePendingPromptIdRef.current !== queuedPrompt.id
        ) {
          promptQueueRef.current.cancel(queuedPrompt.id)
          recoveredPendingPromptIdsRef.current.delete(queuedPrompt.id)
          queueChanged = true
        }
      }

      const firstPending = pendingPrompts[0]
      if (
        firstPending &&
        !promptQueueRef.current.active &&
        activePendingPromptIdRef.current === undefined &&
        firstPending.threadId !== threadId
      ) {
        if (queueChanged) syncQueuedPrompts()
        setThreadId(firstPending.threadId)
        return
      }

      for (const pendingPrompt of pendingPrompts) {
        if (
          pendingPrompt.threadId !== threadId ||
          activePendingPromptIdRef.current === pendingPrompt.promptId ||
          recoveredPendingPromptIdsRef.current.has(pendingPrompt.promptId)
        ) {
          continue
        }
        recoveredPendingPromptIdsRef.current.add(pendingPrompt.promptId)
        promptQueueRef.current.enqueuePrompt({
          id: pendingPrompt.promptId,
          content: pendingPrompt.content,
          createdAt: Date.parse(pendingPrompt.createdAt),
          mode: pendingPrompt.queueKind === 'steer' ? 'steer' : 'queue',
        })
        queueChanged = true
      }
      if (queueChanged) syncQueuedPrompts()

      if (
        promptQueueRef.current.active ||
        durableRuns.some((run) => run.status === 'running')
      ) {
        return
      }
      const nextPrompt = promptQueueRef.current.items[0]
      const nextPendingPrompt = nextPrompt
        ? pendingPromptsRef.current.get(nextPrompt.id)
        : undefined
      if (
        !nextPrompt ||
        !nextPendingPrompt ||
        !canUsePendingPromptRef.current(nextPendingPrompt)
      ) {
        return
      }
      if (!promptQueueRef.current.claim()) return
      const claimedPrompt = promptQueueRef.current.take()
      if (!claimedPrompt) {
        promptQueueRef.current.release()
        return
      }
      syncQueuedPrompts()
      startPromptSequenceRef.current(claimedPrompt, false)
    }
  }, [
    byokConnection,
    byokReady,
    byokSnapshot,
    chatGptConnection,
    legacyByokSnapshot,
    projectSync,
    syncedMessages,
    syncedProjectId,
    syncedRuns,
    threadId,
  ])

  React.useEffect(() => {
    if (syncedProjectId || !storageScope || hydratedThreadId !== threadId)
      return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      void saveBuilderAiTranscript(storageScope, threadId, messages).then(
        () => {
          if (!cancelled) refreshThreads()
        },
      )
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [
    hydratedThreadId,
    messages,
    refreshThreads,
    storageScope,
    syncedProjectId,
    threadId,
  ])

  const refreshChatGptConnection = React.useCallback(
    async (signal?: AbortSignal, showLoading = false) => {
      if (!supportsChatGptLogin) return disconnectedChatGpt
      if (showLoading) setChatGptLoading(true)
      try {
        const response = await fetch('/api/builder/chatgpt', {
          headers: { Accept: 'application/json' },
          signal,
        })
        const body: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          throw new Error(readErrorMessage(body, response.status))
        }

        const connection = parseBuilderChatGptConnection(body)
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
    if (!supportsChatGptLogin || !enabled) return
    const abortController = new AbortController()
    void refreshChatGptConnection(abortController.signal, true)
    return () => abortController.abort()
  }, [enabled, refreshChatGptConnection])

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

  React.useEffect(() => {
    mountedRef.current = true
    const promptQueue = promptQueueRef.current
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      discardUnrecordedPrompt()
      promptQueue.clear()
      onRunningChangeRef.current?.(false)
    }
  }, [])

  function selectModel(model: ModelChoice) {
    if (running) return
    didSelectConnectionRef.current =
      model.connection !== 'chatgpt' || Boolean(model.model)
    setSelectedModel(model)
    if (model.connection === 'byok') {
      setSettingsProvider(model.provider)
      setApiKeyStorageError('')
      if (!byokConnection.hasConfiguredKey(model.provider)) {
        setShowApiKeySetup(true)
        setSettingsOpen(true)
      }
    } else if (
      !chatGptConnection?.connected ||
      !chatGptConnection.models.some(
        (candidate) => candidate.id === model.model,
      )
    ) {
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
    setApiKeyStorageError('')
  }

  async function saveApiKey(provider: BuilderAiRemoteProvider, value: string) {
    const normalizedKey = value.trim()
    try {
      await byokConnection.save(provider, normalizedKey)
    } catch (cause) {
      setApiKeyStorageError(
        `This browser could not finish saving the API key: ${formatError(cause)}`,
      )
      return false
    }

    didSelectConnectionRef.current = true
    setSelectedModel(defaultModelByProvider[provider])
    setShowApiKeySetup(false)
    setSettingsOpen(false)
    setApiKeyStorageError('')
    setError('')
    return true
  }

  async function migrateLegacyApiKey(provider: BuilderAiRemoteProvider) {
    try {
      await byokConnection.migrateLegacy(provider)
      setApiKeyStorageError('')
      setError('')
    } catch (cause) {
      setApiKeyStorageError(
        `This browser could not finish moving the API key: ${formatError(cause)}`,
      )
    }
  }

  async function unlockApiKey(provider: BuilderAiRemoteProvider) {
    try {
      await byokConnection.unlock(provider)
      setApiKeyStorageError('')
    } catch (cause) {
      setApiKeyStorageError(
        `This browser could not unlock the API key: ${formatError(cause)}`,
      )
    }
  }

  async function clearApiKey(provider: BuilderAiRemoteProvider) {
    try {
      await byokConnection.clear(provider)
    } catch (cause) {
      setApiKeyStorageError(
        `This browser could not remove the API key: ${formatError(cause)}`,
      )
      return
    }

    if (
      selectedModel.connection === 'byok' &&
      selectedModel.provider === provider
    ) {
      const fallbackProvider = (['openai', 'anthropic'] as const).find(
        (candidate) =>
          candidate !== provider && byokConnection.hasConfiguredKey(candidate),
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
    setApiKeyStorageError('')
    setSettingsOpen(false)
  }

  function changeSettingsProvider(provider: BuilderAiRemoteProvider) {
    setSettingsProvider(provider)
    setApiKeyStorageError('')
  }

  function openQueuedPromptConnection(provider: BuilderAiRemoteProvider) {
    setSettingsProvider(provider)
    setShowApiKeySetup(true)
    setApiKeyStorageError('')
    setSettingsOpen(true)
  }

  async function startChatGptLogin() {
    setChatGptLoading(true)
    setConnectionError('')
    try {
      const login = parseBuilderChatGptLogin(
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
        (provider) => byokConnection.hasConfiguredKey(provider),
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
    const nextThreadId = createBuilderAiThreadId()
    if (!projectSync && storageScope) {
      if (hydratedThreadId === threadId) {
        await saveBuilderAiTranscript(storageScope, threadId, messages)
      }
      await saveBuilderAiTranscript(storageScope, nextThreadId, [])
    }

    setThreadId(nextThreadId)
    messagesRef.current = []
    setMessages([])
    promptValueRef.current = ''
    setPrompt('')
    setLiveActivity(undefined)
    setStreamingMessage('')
    setError('')
    setShowLatest(false)
    didInitialScrollRef.current = false
    if (projectSync) {
      const clientMutationId = getThreadCreationMutationId(nextThreadId)
      try {
        await projectSync.executeCommand(
          builderProjectSyncCommandSchema.parse({
            type: 'thread.create',
            clientMutationId,
            thread: {
              id: nextThreadId,
              title: 'New conversation',
            },
          }),
        )
      } catch (cause) {
        setError(`Could not start a new conversation: ${formatError(cause)}`)
      }
    }
    window.requestAnimationFrame(() => promptRef.current?.focus())
  }

  async function selectThread(nextThreadId: string) {
    if (running || nextThreadId === threadId) return
    if (!projectSync && storageScope && hydratedThreadId === threadId) {
      await saveBuilderAiTranscript(storageScope, threadId, messages)
    }
    setError('')
    setThreadId(nextThreadId)
  }

  function getThreadCreationMutationId(createdThreadId: string) {
    const current = threadCreationMutationIdsRef.current.get(createdThreadId)
    if (current) return current
    const created = crypto.randomUUID()
    threadCreationMutationIdsRef.current.set(createdThreadId, created)
    return created
  }

  async function dismissRollbackCheckpoint() {
    checkpointHydrationGenerationRef.current += 1
    const hydrated = await checkpointHydrationPromiseRef.current
    const checkpoint =
      rollbackCheckpointRef.current ??
      (hydrated && hydrated.scope === storageScope
        ? hydrated.checkpoint
        : undefined)
    rollbackCheckpointRef.current = undefined
    setRollbackCheckpoint(undefined)
    if (checkpoint && storageScope) {
      await removeBuilderAiCheckpoint(storageScope, checkpoint.id)
    }
  }

  async function restoreRollbackCheckpoint() {
    const checkpoint = rollbackCheckpointRef.current
    if (!checkpoint) return

    try {
      if (
        checkpoint.persisted &&
        !(await builderAiCheckpointMatchesExecution(
          checkpoint.persisted,
          getExecution(),
        ))
      ) {
        await dismissRollbackCheckpoint()
        setError('The project changed after this checkpoint was created.')
        return
      }
      await onRestore(cloneBuilderAiExecution(checkpoint.execution), 'manual')
      await dismissRollbackCheckpoint()
      setError('')
      setQueueAnnouncement('Restored the builder checkpoint.')
    } catch (cause) {
      setError(
        `Could not restore the builder checkpoint: ${formatError(cause)}`,
      )
    }
  }

  function syncQueuedPrompts() {
    setQueuedPrompts(promptQueueRef.current.items)
  }

  function queuePrompt(
    queuedPrompt: BuilderAiQueuedPrompt,
    clearComposer: boolean,
  ) {
    const promptQueue = promptQueueRef.current
    promptQueue.enqueuePrompt(queuedPrompt)
    syncQueuedPrompts()
    if (clearComposer) {
      promptValueRef.current = ''
      setPrompt('')
      setSendMode('queue')
    }
    setError('')

    if (queuedPrompt.mode === 'steer') {
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
    const pendingPrompt = pendingPromptsRef.current.get(id)
    void (
      pendingPrompt
        ? cancelDurablePendingPrompt(pendingPrompt)
        : Promise.resolve()
    )
      .then(() => {
        if (!promptQueueRef.current.cancel(id)) return
        syncQueuedPrompts()
        const waiting = promptQueueRef.current.items.length
        setQueueAnnouncement(
          waiting === 0
            ? 'Queued message removed.'
            : `Queued message removed. ${waiting} ${waiting === 1 ? 'message' : 'messages'} waiting.`,
        )
      })
      .catch((cause: unknown) => {
        setError(`Could not remove the queued message: ${formatError(cause)}`)
      })
  }

  function stopResponse() {
    pendingSubmissionGenerationRef.current += 1
    const queuedPromptIds = promptQueueRef.current.items.map((item) => item.id)
    const cleared = promptQueueRef.current.clear()
    for (const promptId of queuedPromptIds) discardDurablePrompt(promptId)
    const activePromptId = activePendingPromptIdRef.current
    if (activePromptId) discardDurablePrompt(activePromptId)
    syncQueuedPrompts()
    abortIntentRef.current = 'stop'
    setSendMode('queue')
    setQueueAnnouncement(
      cleared === 0
        ? 'Response stopped.'
        : `Response stopped. Cleared ${cleared} queued ${cleared === 1 ? 'message' : 'messages'}.`,
    )
    abortRef.current?.abort()
    discardUnrecordedPrompt()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    // Unlock the passkey-encrypted BYOK key here, on the click, while the
    // user activation is still fresh. Safari and Dia suppress the WebAuthn
    // prompt (it silently never resolves) if the unlock runs later in the
    // async send pipeline, past the activation window.
    if (selectedModel.connection === 'byok') {
      await unlockApiKey(selectedModel.provider)
      // Bail if it is still locked (unlock cancelled or failed) — the run
      // pipeline can no longer surface the WebAuthn prompt itself.
      const client = byokConnection.getClient(selectedModel.provider, {
        allowUnlock: false,
      })
      if (!client) return
    }
    submitInstruction(prompt, sendMode, true)
  }

  function updatePrompt(content: string) {
    promptValueRef.current = content
    setPrompt(content)
  }

  function submitInstruction(
    content: string,
    mode: BuilderAiSendMode,
    clearComposer: boolean,
    lifecycle?: BuilderAiPromptLifecycle,
  ) {
    const instruction = content.trim()
    if (
      !enabled ||
      !instruction ||
      instruction.length > 10_000 ||
      hydrating ||
      needsConnection
    ) {
      return false
    }

    const promptQueue = promptQueueRef.current
    const claimed = promptQueue.claim()
    const queuedPrompt: BuilderAiQueuedPrompt = {
      id: crypto.randomUUID(),
      content: instruction,
      createdAt: Date.now(),
      lifecycle,
      mode: getEffectiveSendMode(mode),
    }
    const startsImmediately = claimed && promptQueue.items.length === 0

    if (!projectSync) {
      acceptSubmittedPrompt(
        queuedPrompt,
        claimed,
        startsImmediately,
        clearComposer,
      )
      return true
    }

    const queueKind: BuilderProjectPendingPrompt['queueKind'] =
      startsImmediately ? 'active' : queuedPrompt.mode
    const pendingPrompt = createPendingPrompt(queuedPrompt, queueKind)
    const durableQueuedPrompt = {
      ...queuedPrompt,
      id: pendingPrompt.promptId,
      createdAt: Date.parse(pendingPrompt.createdAt),
    }
    const submissionGeneration = pendingSubmissionGenerationRef.current
    pendingPromptsRef.current.set(pendingPrompt.promptId, pendingPrompt)
    recoveredPendingPromptIdsRef.current.add(pendingPrompt.promptId)
    const write = pendingPromptWriteQueueRef.current.then(async () => {
      const threadCommand = getDurableThreadCreationCommand(pendingPrompt)
      const runCommand = getDurableRunEnqueueCommand(pendingPrompt)
      await projectSync.executeRunEnqueue(
        threadCommand
          ? { thread: threadCommand, run: runCommand }
          : { run: runCommand },
      )
      await saveBuilderProjectPendingPrompt(pendingPrompt).catch(
        () => undefined,
      )
      if (submissionGeneration !== pendingSubmissionGenerationRef.current) {
        await cancelDurablePendingPrompt(pendingPrompt)
        if (claimed) promptQueue.release()
        durableQueuedPrompt.lifecycle?.onDiscarded?.()
        return
      }
      if (!mountedRef.current) return
      acceptSubmittedPrompt(
        durableQueuedPrompt,
        claimed,
        startsImmediately,
        clearComposer,
      )
    })
    pendingPromptWriteQueueRef.current = write.then(
      () => undefined,
      () => undefined,
    )
    void write.catch((cause: unknown) => {
      if (!mountedRef.current) return
      if (claimed) promptQueue.release()
      pendingPromptsRef.current.delete(pendingPrompt.promptId)
      recoveredPendingPromptIdsRef.current.delete(pendingPrompt.promptId)
      durableQueuedPrompt.lifecycle?.onDiscarded?.()
      promptValueRef.current = instruction
      setPrompt((current) => current || instruction)
      setError(`Could not store the message: ${formatError(cause)}`)
    })
    return true
  }

  function acceptSubmittedPrompt(
    queuedPrompt: BuilderAiQueuedPrompt,
    claimed: boolean,
    startsImmediately: boolean,
    clearComposer: boolean,
  ) {
    if (startsImmediately) {
      unlockAllowedPromptIdsRef.current.add(queuedPrompt.id)
      startPromptSequence(queuedPrompt, clearComposer)
      return
    }
    if (!claimed) {
      queuePrompt(queuedPrompt, clearComposer)
      return
    }
    queuePrompt(queuedPrompt, clearComposer)
    const recoveredPrompt = promptQueueRef.current.take()
    if (!recoveredPrompt) return
    syncQueuedPrompts()
    startPromptSequence(recoveredPrompt, clearComposer)
  }

  function startPromptSequence(
    initialPrompt: BuilderAiQueuedPrompt,
    clearComposer: boolean,
  ) {
    if (clearComposer) {
      promptValueRef.current = ''
      setPrompt('')
      setSendMode('queue')
    }
    setError('')
    setRunning(true)
    onRunningChangeRef.current?.(true)
    void runPromptSequence(initialPrompt)
  }

  function getEffectiveSendMode(mode: BuilderAiSendMode) {
    return mode === 'steer' &&
      agentStreamingRef.current &&
      abortIntentRef.current !== 'steer'
      ? 'steer'
      : 'queue'
  }

  function createPendingPrompt(
    queuedPrompt: BuilderAiQueuedPrompt,
    queueKind: BuilderProjectPendingPrompt['queueKind'],
  ): BuilderProjectPendingPrompt {
    if (!projectSync) throw new Error('Builder project sync is unavailable')
    const runId = crypto.randomUUID()
    return {
      projectId: projectSync.project.id,
      promptId: runId,
      queueKind,
      threadId,
      threadCreateClientMutationId: getThreadCreationMutationId(threadId),
      runEnqueueClientMutationId: crypto.randomUUID(),
      runClaimClientMutationId: crypto.randomUUID(),
      runCancelClientMutationId: crypto.randomUUID(),
      runId,
      userMessageId: crypto.randomUUID(),
      userMessageClientMutationId: crypto.randomUUID(),
      content: queuedPrompt.content,
      provider:
        selectedModel.connection === 'byok' ? selectedModel.provider : 'openai',
      model: selectedModel.model,
      leaseOwnerId: projectSync.browserSessionId,
      createdAt: new Date(queuedPrompt.createdAt).toISOString(),
    }
  }

  function createRecoveredPendingPrompt({
    projectId,
    projectSync: durableProjectSync,
    run,
    message,
    thread,
  }: {
    projectId: string
    projectSync: BuilderAssistantProjectSync
    run: BuilderProjectSyncRun
    message: BuilderProjectSyncMessage
    thread: BuilderProjectSyncThread
  }): BuilderProjectPendingPrompt {
    return {
      projectId,
      promptId: run.id,
      queueKind: run.queueKind,
      threadId: run.threadId,
      threadCreateClientMutationId: thread.clientMutationId,
      runEnqueueClientMutationId: run.clientMutationId,
      runClaimClientMutationId: crypto.randomUUID(),
      runCancelClientMutationId: crypto.randomUUID(),
      runId: run.id,
      userMessageId: message.id,
      userMessageClientMutationId: message.clientMutationId,
      content: message.content,
      provider: run.provider,
      model: run.model,
      leaseOwnerId: durableProjectSync.browserSessionId,
      createdAt: run.createdAt,
    }
  }

  function canUsePendingPrompt(pendingPrompt: BuilderProjectPendingPrompt) {
    const remoteProvider = builderAiRemoteProviders.find(
      (provider) => provider === pendingPrompt.provider,
    )
    if (
      remoteProvider &&
      byokConnection.getClient(remoteProvider, {
        allowUnlock: unlockAllowedPromptIdsRef.current.has(
          pendingPrompt.promptId,
        ),
      })
    ) {
      return true
    }
    return (
      pendingPrompt.provider === 'openai' &&
      chatGptConnection?.connected === true &&
      chatGptConnection.models.some((model) => model.id === pendingPrompt.model)
    )
  }

  function getDurableThreadCreationCommand(
    pendingPrompt: BuilderProjectPendingPrompt,
  ) {
    if (
      !projectSync ||
      projectSync.threads.some(
        (candidate) =>
          candidate.id === pendingPrompt.threadId &&
          candidate.archivedAt === null,
      )
    ) {
      return undefined
    }

    const command = builderProjectSyncCommandSchema.parse({
      type: 'thread.create',
      clientMutationId: pendingPrompt.threadCreateClientMutationId,
      thread: {
        id: pendingPrompt.threadId,
        title: 'New conversation',
      },
    })
    if (command.type !== 'thread.create') {
      throw new Error('Invalid Builder thread creation command')
    }
    return command
  }

  function getDurableRunEnqueueCommand(
    pendingPrompt: BuilderProjectPendingPrompt,
  ) {
    const command = builderProjectSyncCommandSchema.parse({
      type: 'run.enqueue',
      clientMutationId: pendingPrompt.runEnqueueClientMutationId,
      run: {
        id: pendingPrompt.runId,
        threadId: pendingPrompt.threadId,
        queueKind: pendingPrompt.queueKind === 'steer' ? 'steer' : 'queue',
        provider: pendingPrompt.provider,
        model: pendingPrompt.model,
      },
      userMessage: {
        id: pendingPrompt.userMessageId,
        clientMutationId: pendingPrompt.userMessageClientMutationId,
        content: pendingPrompt.content,
        parts: [],
        createdAt: pendingPrompt.createdAt,
      },
    })
    if (command.type !== 'run.enqueue') {
      throw new Error('Invalid Builder run enqueue command')
    }
    return command
  }

  async function cancelDurablePendingPrompt(
    pendingPrompt: BuilderProjectPendingPrompt,
  ) {
    if (projectSync) {
      try {
        await projectSync.executeCommand(
          builderProjectSyncCommandSchema.parse({
            type: 'run.cancel',
            clientMutationId: pendingPrompt.runCancelClientMutationId,
            runId: pendingPrompt.runId,
            browserSessionId: projectSync.browserSessionId,
          }),
        )
      } catch (cause) {
        if (
          !(
            cause instanceof BuilderProjectSyncCommandRejectedError &&
            cause.rejection.code === 'run-lease-invalid'
          )
        ) {
          throw cause
        }
      }
    }
    await clearBuilderProjectPendingPrompt(
      pendingPrompt.projectId,
      pendingPrompt.promptId,
    ).catch(() => undefined)
    pendingPromptsRef.current.delete(pendingPrompt.promptId)
    recoveredPendingPromptIdsRef.current.delete(pendingPrompt.promptId)
  }

  function discardDurablePrompt(promptId: string) {
    const pendingPrompt = pendingPromptsRef.current.get(promptId)
    if (!pendingPrompt) return
    void cancelDurablePendingPrompt(pendingPrompt).catch((cause: unknown) => {
      if (
        !promptQueueRef.current.items.some((item) => item.id === promptId) &&
        activePendingPromptIdRef.current !== promptId
      ) {
        recoveredPendingPromptIdsRef.current.add(promptId)
        promptQueueRef.current.enqueuePrompt({
          id: promptId,
          content: pendingPrompt.content,
          createdAt: Date.parse(pendingPrompt.createdAt),
          mode: pendingPrompt.queueKind === 'steer' ? 'steer' : 'queue',
        })
        syncQueuedPrompts()
      }
      setError(`Could not discard the recovered message: ${formatError(cause)}`)
    })
  }

  React.useImperativeHandle(ref, () => ({
    async persistTranscript() {
      if (!projectSync && storageScope && hydratedThreadId === threadId) {
        const persisted = await saveBuilderAiTranscript(
          storageScope,
          threadId,
          messagesRef.current,
        )
        if (!persisted) {
          throw new Error('This browser could not store the conversation.')
        }
      }
    },
    submitPrompt(content, lifecycle) {
      return submitInstruction(content, 'queue', false, lifecycle)
    },
  }))

  async function runPromptSequence(initialPrompt: BuilderAiQueuedPrompt) {
    let nextPrompt: BuilderAiQueuedPrompt | undefined = initialPrompt

    try {
      while (nextPrompt) {
        const outcome = await runPrompt(nextPrompt)
        const shouldContinue =
          outcome === 'success' ||
          (outcome === 'aborted' && abortIntentRef.current === 'steer')
        abortIntentRef.current = undefined

        if (outcome === 'unavailable') break

        if (!shouldContinue) {
          pendingSubmissionGenerationRef.current += 1
          const discardedPromptIds = promptQueueRef.current.items.map(
            (item) => item.id,
          )
          const cleared = promptQueueRef.current.clear()
          for (const promptId of discardedPromptIds) {
            discardDurablePrompt(promptId)
          }
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
      onRunningChangeRef.current?.(false)
    }
  }

  async function runPrompt(
    prompt: BuilderAiQueuedPrompt,
  ): Promise<'success' | 'error' | 'aborted' | 'unavailable'> {
    const allowByokUnlock = unlockAllowedPromptIdsRef.current.has(prompt.id)
    const abortController = new AbortController()
    abortRef.current = abortController
    unrecordedPromptRef.current = prompt
    let pendingPrompt: BuilderProjectPendingPrompt | undefined
    if (projectSync) {
      const storedPrompt = pendingPromptsRef.current.get(prompt.id)
      if (!storedPrompt) {
        discardUnrecordedPrompt(prompt)
        setError('The pending Builder run is no longer available.')
        return 'error'
      }
      pendingPrompt = { ...storedPrompt, queueKind: 'active' }
      activePendingPromptIdRef.current = prompt.id
      await saveBuilderProjectPendingPrompt(pendingPrompt).catch(
        () => undefined,
      )
      pendingPromptsRef.current.set(pendingPrompt.promptId, pendingPrompt)
      if (!canUsePendingPrompt(pendingPrompt)) {
        activePendingPromptIdRef.current = undefined
        promptQueueRef.current.enqueuePrompt(prompt)
        syncQueuedPrompts()
        recordPrompt(prompt)
        setError(
          'This browser does not have the connection for the queued model.',
        )
        return 'unavailable'
      }
    }
    unlockAllowedPromptIdsRef.current.delete(prompt.id)
    let initialExecution: BuilderAiExecution
    try {
      await dismissRollbackCheckpoint()
      if (abortController.signal.aborted) {
        if (abortIntentRef.current) await discardPendingStart()
        if (activePendingPromptIdRef.current === pendingPrompt?.promptId) {
          activePendingPromptIdRef.current = undefined
        }
        discardUnrecordedPrompt(prompt)
        if (abortRef.current === abortController) abortRef.current = null
        return 'aborted'
      }
      initialExecution = onPrepare ? await onPrepare() : getExecution()
      if (abortController.signal.aborted) {
        if (abortIntentRef.current) await discardPendingStart()
        if (activePendingPromptIdRef.current === pendingPrompt?.promptId) {
          activePendingPromptIdRef.current = undefined
        }
        discardUnrecordedPrompt(prompt)
        if (abortRef.current === abortController) abortRef.current = null
        onFinish?.()
        return 'aborted'
      }
    } catch (cause) {
      if (activePendingPromptIdRef.current === pendingPrompt?.promptId) {
        activePendingPromptIdRef.current = undefined
      }
      if (pendingPrompt) recordPrompt(prompt)
      else discardUnrecordedPrompt(prompt)
      if (abortRef.current === abortController) abortRef.current = null
      if (abortController.signal.aborted) {
        if (abortIntentRef.current) await discardPendingStart()
        return 'aborted'
      }
      if (pendingPrompt) {
        recoveredPendingPromptIdsRef.current.add(pendingPrompt.promptId)
        promptQueueRef.current.enqueuePrompt(prompt)
        syncQueuedPrompts()
      }
      setError(`Could not prepare the builder: ${formatError(cause)}`)
      return pendingPrompt ? 'unavailable' : 'error'
    }
    const instruction = prompt.content
    const checkpointExecution = cloneBuilderAiExecution(initialExecution)
    const userMessage = createTranscriptMessage(
      'user',
      instruction,
      undefined,
      pendingPrompt?.userMessageId,
    )
    const previousMessages = messagesRef.current
    const nextMessages = replaceBuilderAiTranscriptMessage(
      previousMessages,
      userMessage,
    )
    messagesRef.current = nextMessages
    const requestMessages: Array<BuilderAiMessage> = nextMessages
      .filter((message) => message.content.trim())
      .slice(-20)
      .map(({ role, content }) => ({ role, content }))
    let repairHistory: Array<BuilderAiFailureObservation> = []
    let continuousValidationAttempt = 0
    let checkpoint: RollbackCheckpoint | undefined
    let didStageExecution = false
    let lastStagedExecution: BuilderAiExecution | undefined
    let preserveStoppedExecution = false
    const activityId = pendingPrompt?.runId ?? crypto.randomUUID()
    let currentActivity: BuilderAiActivity | undefined
    let durableLeaseFencingToken: number | undefined
    let heartbeatTimer: number | undefined
    let heartbeatInFlight = false
    let heartbeatFailure: unknown
    let terminalFinishAttempted = false
    let terminalFinishSettled = false
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
      if (projectSync) {
        abortController.signal.throwIfAborted()
        if (!pendingPrompt) {
          throw new Error('Builder run start was not stored')
        }
        const result = await projectSync.executeCommand(
          builderProjectSyncCommandSchema.parse({
            type: 'run.claim',
            clientMutationId: pendingPrompt.runClaimClientMutationId,
            runId: pendingPrompt.runId,
            leaseOwnerId: projectSync.browserSessionId,
          }),
        )
        if (result.leaseFencingToken === undefined) {
          throw new Error('Builder run lease was not acknowledged')
        }
        durableLeaseFencingToken = result.leaseFencingToken
        const pendingPromptCleared = await clearBuilderProjectPendingPrompt(
          pendingPrompt.projectId,
          pendingPrompt.promptId,
        ).catch(() => undefined)
        if (
          pendingPromptCleared !== undefined &&
          activePendingPromptIdRef.current === pendingPrompt.promptId
        ) {
          activePendingPromptIdRef.current = undefined
          pendingPromptsRef.current.delete(pendingPrompt.promptId)
          recoveredPendingPromptIdsRef.current.delete(pendingPrompt.promptId)
        }
        startHeartbeat()
      }
      recordPrompt(prompt)
      setStreamingMessage('')
      agentStreamingRef.current = true
      setAgentStreaming(true)
      let response
      try {
        const durableProvider = pendingPrompt
          ? builderAiRemoteProviders.find(
              (provider) => provider === pendingPrompt.provider,
            )
          : undefined
        const durableChatGptModel =
          pendingPrompt?.provider === 'openai' &&
          chatGptConnection?.connected === true &&
          chatGptConnection.models.some(
            (model) => model.id === pendingPrompt.model,
          )
        const runProvider = pendingPrompt
          ? (durableProvider ?? 'openai')
          : selectedModel.connection === 'byok'
            ? selectedModel.provider
            : 'openai'
        const runByok = byokConnection.getClient(runProvider, {
          allowUnlock: allowByokUnlock,
        })
        const useChatGpt = pendingPrompt
          ? Boolean(
              durableChatGptModel &&
              (selectedModel.connection === 'chatgpt' ||
                !durableProvider ||
                !runByok),
            )
          : selectedModel.connection === 'chatgpt'
        const runModel = pendingPrompt?.model ?? selectedModel.model
        const runThreadId = pendingPrompt?.threadId ?? threadId
        response = useChatGpt
          ? await runChatGptAgent({
              activityId,
              abortController,
              execution: initialExecution,
              hiddenFiles,
              messages: requestMessages,
              model: runModel,
              onActivityEvent: updateActivity,
              onText: setStreamingMessage,
              onValidate: validateContinuousCandidate,
              threadId: runThreadId,
            })
          : await runRemoteAgent({
              activityId,
              abortController,
              byok: requireBuilderAiByokClient(runByok),
              execution: initialExecution,
              hiddenFiles,
              messages: requestMessages,
              model: runModel,
              onActivityEvent: updateActivity,
              onText: setStreamingMessage,
              onValidate: validateContinuousCandidate,
              provider: runProvider,
              threadId: runThreadId,
            })
      } finally {
        agentStreamingRef.current = false
        setAgentStreaming(false)
        setSendMode('queue')
      }
      if (abortController.signal.aborted) {
        await rollbackStagedExecution()
        if (heartbeatFailure) {
          const message = `The Builder run lease was lost: ${formatError(heartbeatFailure)}`
          failActivity(message)
          const syncFailure = await finishDurableRun({
            status: 'failed',
            errorMessage: message,
          })
          setError(withTerminalSyncFailure(message, syncFailure))
          return 'error'
        }
        stopActivity()
        const syncFailure = await finishDurableRun({ status: 'cancelled' })
        if (syncFailure) {
          setError(
            `The response stopped, but its final state could not sync: ${formatError(syncFailure)}`,
          )
        }
        return 'aborted'
      }

      const expectedCurrentExecution =
        response.changedFiles.length > 0 || response.runtimeChanged
          ? response.execution
          : initialExecution
      if (
        serializeBuilderAiExecution(getExecution()) !==
        serializeBuilderAiExecution(expectedCurrentExecution)
      ) {
        const message = 'The project changed while the assistant was working.'
        await discardCheckpoint()
        failActivity(message)
        const syncFailure = await finishDurableRun({
          status: 'failed',
          errorMessage: message,
        })
        setError(
          withTerminalSyncFailure(
            `${message} Send the request again.`,
            syncFailure,
          ),
        )
        return 'error'
      }

      if (response.changedFiles.length === 0 && !response.runtimeChanged) {
        completeActivity()
        const assistantMessage = createTranscriptMessage(
          'assistant',
          response.message,
          currentActivity && (projectSync || currentActivity.items.length)
            ? currentActivity
            : undefined,
        )
        const syncFailure = await finishDurableRun({
          status: 'completed',
          assistantMessage,
        })
        commitAssistant(assistantMessage)
        if (syncFailure) {
          setError(
            `The response finished, but its final state could not sync: ${formatError(syncFailure)}`,
          )
          return 'error'
        }
        await discardCheckpoint()
        return 'success'
      }

      let revision: BuilderAssistantRevisionCommit | void
      try {
        revision = await onCommit?.(response.execution)
        if (projectSync && !revision) {
          throw new Error('The project revision was not prepared for sync')
        }
      } catch (cause) {
        const message = `The builder ran successfully but could not be saved: ${formatError(cause)}`
        retainCheckpoint()
        failActivity(message)
        const assistantMessage = createTranscriptMessage(
          'assistant',
          response.message,
          currentActivity && (projectSync || currentActivity.items.length)
            ? currentActivity
            : undefined,
        )
        const syncFailure = await finishDurableRun({
          status: 'failed',
          errorMessage: message,
          assistantMessage,
        })
        commitAssistant(assistantMessage)
        setError(withTerminalSyncFailure(message, syncFailure))
        return 'error'
      }
      completeActivity()
      const assistantMessage = createTranscriptMessage(
        'assistant',
        response.message,
        currentActivity && (projectSync || currentActivity.items.length)
          ? currentActivity
          : undefined,
      )
      const syncFailure = await finishDurableRun({
        status: 'completed',
        ...(revision ? { revision } : {}),
        assistantMessage,
      })
      commitAssistant(assistantMessage)
      if (syncFailure) {
        retainCheckpoint()
        setError(
          `The builder ran successfully, but its final state could not sync: ${formatError(syncFailure)}`,
        )
        return 'error'
      }
      await discardCheckpoint()
      return 'success'
    } catch (cause) {
      if (projectSync && durableLeaseFencingToken === undefined) {
        if (activePendingPromptIdRef.current === pendingPrompt?.promptId) {
          activePendingPromptIdRef.current = undefined
        }
        messagesRef.current = previousMessages
        setMessages(previousMessages)
        setLiveActivity(undefined)
        setStreamingMessage('')
        recordPrompt(prompt)
        if (abortController.signal.aborted) return 'aborted'
        if (pendingPrompt) {
          recoveredPendingPromptIdsRef.current.add(pendingPrompt.promptId)
          promptQueueRef.current.enqueuePrompt(prompt)
          syncQueuedPrompts()
        }
        setError(`Could not start the Builder run: ${formatError(cause)}`)
        return pendingPrompt ? 'unavailable' : 'error'
      }
      if (terminalFinishAttempted) {
        setError(
          `Could not sync the completed Builder run: ${formatError(cause)}`,
        )
        return 'error'
      }
      if (
        heartbeatFailure ||
        isAbortError(cause) ||
        abortController.signal.aborted
      ) {
        await rollbackStagedExecution()
        if (heartbeatFailure) {
          const message = `The Builder run lease was lost: ${formatError(heartbeatFailure)}`
          failActivity(message)
          const syncFailure = await finishDurableRun({
            status: 'failed',
            errorMessage: message,
          })
          setError(withTerminalSyncFailure(message, syncFailure))
          return 'error'
        }
        stopActivity()
        const syncFailure = await finishDurableRun({ status: 'cancelled' })
        if (syncFailure) {
          setError(
            `The response stopped, but its final state could not sync: ${formatError(syncFailure)}`,
          )
        }
        return 'aborted'
      } else {
        const message = formatError(cause)
        if (preserveStoppedExecution) await discardCheckpoint()
        else await rollbackStagedExecution()
        failActivity(message)
        const syncFailure = await finishDurableRun({
          status: 'failed',
          errorMessage: message,
        })
        setError(withTerminalSyncFailure(message, syncFailure))
        return 'error'
      }
    } finally {
      abortController.abort()
      stopHeartbeat()
      if (abortRef.current === abortController) abortRef.current = null
      onFinish?.()
    }

    return 'aborted'

    async function discardPendingStart() {
      if (!pendingPrompt) return
      try {
        await cancelDurablePendingPrompt(pendingPrompt)
      } catch (cause) {
        setError(
          `Could not discard the interrupted message: ${formatError(cause)}`,
        )
      }
    }

    function startHeartbeat() {
      if (!projectSync || durableLeaseFencingToken === undefined) return
      heartbeatTimer = window.setInterval(() => {
        if (heartbeatInFlight || terminalFinishSettled) return
        heartbeatInFlight = true
        void projectSync
          .executeCommand(
            builderProjectSyncCommandSchema.parse({
              type: 'run.heartbeat',
              clientMutationId: crypto.randomUUID(),
              runId: activityId,
              leaseOwnerId: projectSync.browserSessionId,
              leaseFencingToken: durableLeaseFencingToken,
            }),
          )
          .catch((cause: unknown) => {
            if (terminalFinishSettled || heartbeatFailure) return
            if (terminalFinishAttempted) return
            heartbeatFailure = cause
            abortController.abort()
          })
          .finally(() => {
            heartbeatInFlight = false
          })
      }, 10_000)
    }

    function stopHeartbeat() {
      if (heartbeatTimer === undefined) return
      window.clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }

    async function finishDurableRun({
      status,
      revision,
      errorMessage,
      assistantMessage,
    }: {
      status: BuilderRunFinishCommand['status']
      revision?: BuilderAssistantRevisionCommit
      errorMessage?: string
      assistantMessage?: TranscriptMessage
    }) {
      if (!projectSync || durableLeaseFencingToken === undefined) return
      terminalFinishAttempted = true
      const durableActivity = currentActivity
        ? compactBuilderAiActivityForDurableSync(currentActivity)
        : undefined
      const durableErrorMessage = errorMessage
        ? (durableActivity?.error ?? errorMessage.slice(0, 1_000))
        : undefined

      try {
        await projectSync.executeCommand(
          builderProjectSyncCommandSchema.parse({
            type: 'run.finish',
            clientMutationId: revision?.clientMutationId ?? crypto.randomUUID(),
            runId: activityId,
            leaseOwnerId: projectSync.browserSessionId,
            leaseFencingToken: durableLeaseFencingToken,
            status,
            ...(revision ? { revision } : {}),
            ...(durableErrorMessage
              ? { error: { message: durableErrorMessage } }
              : {}),
            ...(durableActivity ? { activity: durableActivity } : {}),
            ...(assistantMessage
              ? {
                  assistantMessage: {
                    id: assistantMessage.id,
                    clientMutationId: crypto.randomUUID(),
                    runId: activityId,
                    content: assistantMessage.content,
                    parts: [],
                    createdAt: new Date().toISOString(),
                  },
                }
              : {}),
          }),
        )
        terminalFinishSettled = true
        stopHeartbeat()
        if (!assistantMessage) {
          setLiveActivity(undefined)
          setStreamingMessage('')
        }
        return undefined
      } catch (cause) {
        if (
          revision &&
          cause instanceof BuilderProjectSyncCommandRejectedError &&
          cause.rejection.code === 'project-revision-conflict'
        ) {
          onRevisionConflict?.(revision)
        }
        terminalFinishSettled = true
        stopHeartbeat()
        return cause
      }
    }

    async function validateContinuousCandidate(
      state: BuilderAiValidationState,
    ): Promise<BuilderAiStreamValidationOutcome> {
      preserveStoppedExecution = false
      continuousValidationAttempt += 1
      if (continuousValidationAttempt > maxContinuousValidationAttempts) {
        return {
          result: {
            status: 'stop',
            preserveCurrentExecution: false,
            diagnostic:
              'The builder validation budget was reached without a working result.',
          },
        }
      }

      const expectedCurrentExecution = lastStagedExecution ?? initialExecution
      if (
        serializeBuilderAiExecution(getExecution()) !==
        serializeBuilderAiExecution(expectedCurrentExecution)
      ) {
        preserveStoppedExecution = true
        return {
          result: {
            status: 'stop',
            preserveCurrentExecution: true,
            diagnostic:
              'The project changed while the staged execution was being validated.',
          },
        }
      }

      const candidateChanged =
        serializeBuilderAiExecution(state.execution) !==
        serializeBuilderAiExecution(checkpointExecution)
      if (candidateChanged && !checkpoint) {
        checkpoint = { id: activityId, execution: checkpointExecution }
        if (storageScope) {
          const storedCheckpoint = await createBuilderAiCheckpoint(
            storageScope,
            checkpoint.id,
            checkpoint.execution,
          )
          checkpoint.persisted = storedCheckpoint
        }
      }
      didStageExecution ||= candidateChanged
      lastStagedExecution = cloneBuilderAiExecution(state.execution)
      if (storageScope && checkpoint?.persisted) {
        checkpoint.persisted = await updateBuilderAiCheckpointExpectedExecution(
          storageScope,
          checkpoint.id,
          state.execution,
        )
      }
      if (
        serializeBuilderAiExecution(getExecution()) !==
        serializeBuilderAiExecution(expectedCurrentExecution)
      ) {
        preserveStoppedExecution = true
        return {
          result: {
            status: 'stop',
            preserveCurrentExecution: true,
            diagnostic:
              'The project changed while the staged execution was being validated.',
          },
        }
      }

      const applyItemId = `validate:${continuousValidationAttempt}:apply`
      updateActivity({
        type: 'item-running',
        runId: activityId,
        itemId: applyItemId,
        source: 'harness',
        name: 'apply_workspace',
        timestamp: Date.now(),
        input: { paths: state.changedFiles },
      })
      const runItemId = `validate:${continuousValidationAttempt}:run`
      updateActivity({
        type: 'item-running',
        runId: activityId,
        itemId: runItemId,
        source: 'harness',
        name: 'run_project',
        timestamp: Date.now(),
      })
      const runResult = await onApply(state.execution, abortController.signal)
      updateActivity({
        type: 'item-completed',
        runId: activityId,
        itemId: applyItemId,
        source: 'harness',
        name: 'apply_workspace',
        timestamp: Date.now(),
        output: { paths: state.changedFiles },
      })

      const environmentSnapshot = createBuilderAiEnvironmentSnapshot({
        actualExecution: getExecution(),
        expectedExecution: state.execution,
        run: runResult,
      })
      const completion = validateBuilderAiCompletion(environmentSnapshot)
      if (completion.status === 'complete') {
        updateActivity({
          type: 'item-completed',
          runId: activityId,
          itemId: runItemId,
          source: 'harness',
          name: 'run_project',
          timestamp: Date.now(),
          output: { runtime: environmentSnapshot.run.snapshot.runtime },
        })
        return { result: completion }
      }

      updateActivity({
        type: 'item-failed',
        runId: activityId,
        itemId: runItemId,
        source: 'harness',
        name: 'run_project',
        timestamp: Date.now(),
        error: completion.diagnostic,
        output: {
          runtime: environmentSnapshot.run.snapshot.runtime,
          phase:
            completion.status === 'repair'
              ? completion.phase
              : runResult.ok
                ? 'validation'
                : runResult.phase,
        },
      })

      if (completion.status === 'stop') {
        preserveStoppedExecution = completion.preserveCurrentExecution
        return { result: completion }
      }

      const progress = recordBuilderAiFailure(repairHistory, {
        failureFingerprint: fingerprintBuilderAiDiagnostic(
          completion.phase,
          completion.diagnostic,
        ),
        executionFingerprint: fingerprintBuilderAiValue(state.execution),
        evidenceFingerprints: state.trace.evidenceFingerprints,
        mutationFingerprints: state.trace.mutationFingerprints,
      })
      repairHistory = progress.history
      if (progress.repeatedState) {
        return {
          result: {
            status: 'stop',
            preserveCurrentExecution: false,
            diagnostic:
              'The repair returned to a builder state that already failed with the same error.',
          },
        }
      }
      if (continuousValidationAttempt >= maxContinuousValidationAttempts) {
        return {
          result: {
            status: 'stop',
            preserveCurrentExecution: false,
            diagnostic: `The builder validation budget was reached: ${completion.diagnostic}`,
          },
        }
      }

      return {
        result: {
          ...completion,
          evidence: formatBuilderAiEnvironmentEvidence(environmentSnapshot),
        },
        repair: progress.repair,
      }
    }

    function updateActivity(event: BuilderAiActivityEvent) {
      currentActivity = reduceBuilderAiActivity(currentActivity, event)
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

    function retainCheckpoint() {
      if (!checkpoint || !didStageExecution) return
      rollbackCheckpointRef.current = checkpoint
      setRollbackCheckpoint(checkpoint)
    }

    async function rollbackStagedExecution() {
      if (!checkpoint || !didStageExecution) return
      if (
        lastStagedExecution &&
        !shouldRestoreBuilderAiCheckpoint({
          currentExecution: getExecution(),
          lastStagedExecution,
        })
      ) {
        await discardCheckpoint()
        return
      }

      const rollbackItemId = 'rollback'
      updateActivity({
        type: 'item-running',
        runId: activityId,
        itemId: rollbackItemId,
        source: 'harness',
        name: 'rollback_workspace',
        timestamp: Date.now(),
      })
      try {
        await onRestore(
          cloneBuilderAiExecution(checkpoint.execution),
          'rollback',
        )
        updateActivity({
          type: 'item-completed',
          runId: activityId,
          itemId: rollbackItemId,
          source: 'harness',
          name: 'rollback_workspace',
          timestamp: Date.now(),
        })
        await discardCheckpoint()
      } catch (cause) {
        const message = formatError(cause)
        updateActivity({
          type: 'item-failed',
          runId: activityId,
          itemId: rollbackItemId,
          source: 'harness',
          name: 'rollback_workspace',
          timestamp: Date.now(),
          error: message,
        })
        retainCheckpoint()
      }
    }

    async function discardCheckpoint() {
      if (!checkpoint) return
      const discarded = checkpoint
      checkpoint = undefined
      if (rollbackCheckpointRef.current?.id === discarded.id) {
        rollbackCheckpointRef.current = undefined
        setRollbackCheckpoint(undefined)
      }
      if (storageScope) {
        await removeBuilderAiCheckpoint(storageScope, discarded.id)
      }
    }

    function commitAssistant(assistantMessage: TranscriptMessage) {
      const committedMessages = [
        ...messagesRef.current.filter(
          (message) => message.id !== assistantMessage.id,
        ),
        assistantMessage,
      ]
      messagesRef.current = committedMessages
      setMessages(committedMessages)
      setLiveActivity(undefined)
      setStreamingMessage('')
    }
  }

  function discardUnrecordedPrompt(prompt?: BuilderAiQueuedPrompt) {
    const unrecordedPrompt = unrecordedPromptRef.current
    if (!unrecordedPrompt || (prompt && unrecordedPrompt.id !== prompt.id)) {
      return
    }
    unrecordedPromptRef.current = undefined
    unrecordedPrompt.lifecycle?.onDiscarded?.()
  }

  function recordPrompt(prompt: BuilderAiQueuedPrompt) {
    if (unrecordedPromptRef.current?.id === prompt.id) {
      unrecordedPromptRef.current = undefined
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
  const copyDebugTranscript = React.useCallback(
    () =>
      copyTextToClipboard(
        JSON.stringify(
          {
            version: 1,
            copiedAt: new Date().toISOString(),
            url: window.location.href,
            threadId,
            model:
              selectedModel.connection === 'byok'
                ? {
                    connection: selectedModel.connection,
                    provider: selectedModel.provider,
                    model: selectedModel.model,
                  }
                : {
                    connection: selectedModel.connection,
                    model: selectedModel.model,
                  },
            messages,
            current: {
              activity: liveActivity ?? null,
              response: streamingMessage || null,
              queuedPrompts,
              error: error || null,
            },
          },
          null,
          2,
        ),
      ),
    [
      error,
      liveActivity,
      messages,
      queuedPrompts,
      selectedModel,
      streamingMessage,
      threadId,
    ],
  )
  const floatingChatButtonClass =
    'pointer-events-auto size-7 border border-border-default bg-background-elevated p-0 text-text-muted shadow-sm hover:bg-background-elevated hover:text-text-primary max-[899px]:bg-background-elevated max-[899px]:text-text-muted disabled:opacity-100 disabled:text-text-disabled'

  return (
    <section
      aria-label="Builder AI editor"
      aria-busy={running}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background-default"
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 @min-[900px]:p-2">
        {onDismiss ? (
          <Tooltip content="Hide chat">
            <Button
              type="button"
              variant="icon"
              color="gray"
              size="icon-sm"
              className={floatingChatButtonClass}
              aria-label="Hide chat"
              onClick={() => {
                if (builderWorkspaceControls?.open === false) {
                  builderWorkspaceControls.toggle()
                }
                onDismiss()
              }}
            >
              <CaretDownIcon
                className="size-3.5 @min-[900px]:rotate-90"
                aria-hidden="true"
              />
            </Button>
          </Tooltip>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {threads.length > 1 ? (
            <Dropdown>
              <Tooltip content="Recent conversations">
                <DropdownTrigger>
                  <Button
                    type="button"
                    variant="icon"
                    color="gray"
                    size="icon-sm"
                    className={floatingChatButtonClass}
                    aria-label="Recent AI conversations"
                    disabled={running}
                  >
                    <ClockCounterClockwiseIcon
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownTrigger>
              </Tooltip>
              <DropdownContent
                align="end"
                className="sandbox-ui w-72 rounded-xl"
              >
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
              className={floatingChatButtonClass}
              aria-label="New AI conversation"
              disabled={running || messages.length === 0}
              onClick={() => void resetConversation()}
            >
              <NotePencilIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="Model connections">
            <Button
              type="button"
              variant="icon"
              color="gray"
              size="icon-sm"
              className={floatingChatButtonClass}
              aria-label="Open model connections"
              disabled={running}
              onClick={() => {
                if (selectedModel.connection === 'byok') {
                  setSettingsProvider(selectedModel.provider)
                }
                setSettingsOpen(true)
              }}
            >
              <GearSixIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>
          {builderWorkspaceControls ? (
            <Tooltip
              content={
                builderWorkspaceControls.open
                  ? 'Hide side panel'
                  : 'Show side panel'
              }
            >
              <Button
                ref={sidePanelButtonRef}
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                className={floatingChatButtonClass}
                aria-label={
                  builderWorkspaceControls.open
                    ? 'Hide side panel'
                    : 'Show side panel'
                }
                aria-controls={builderWorkspaceControls.controlsId}
                aria-expanded={builderWorkspaceControls.open}
                onClick={builderWorkspaceControls.toggle}
              >
                <SidebarSimpleIcon
                  className="size-3.5"
                  mirrored
                  aria-hidden="true"
                />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </header>

      {!byokReady ? (
        <SetupState title="Loading model connections">
          <SpinnerGapIcon
            className="mx-auto mt-5 size-5 animate-spin text-text-muted motion-reduce:animate-none"
            aria-hidden="true"
          />
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
                byok={byokConnection}
                byokSnapshot={byokSnapshot}
                error={apiKeyStorageError}
                legacyByokSnapshot={legacyByokSnapshot}
                provider={settingsProvider}
                onClear={clearApiKey}
                onMigrate={migrateLegacyApiKey}
                onProviderChange={changeSettingsProvider}
                onUnlock={unlockApiKey}
                onSave={saveApiKey}
              />
              {supportsChatGptLogin ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-5 w-full"
                  onClick={useChatGptConnection}
                >
                  {chatGptConnection?.connected
                    ? 'Use ChatGPT'
                    : 'Continue with ChatGPT'}
                </Button>
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
              aria-label="Builder AI conversation"
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
                        onConnectQueued={openQueuedPromptConnection}
                        onCopyDebugTranscript={copyDebugTranscript}
                        onDismissCheckpoint={() =>
                          void dismissRollbackCheckpoint()
                        }
                        onRestoreCheckpoint={() =>
                          void restoreRollbackCheckpoint()
                        }
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
              <label className="sr-only" htmlFor="builder-ai-prompt">
                Builder change
              </label>
              <textarea
                ref={promptRef}
                id="builder-ai-prompt"
                value={prompt}
                rows={1}
                maxLength={10_000}
                placeholder="Describe a builder change"
                onChange={(event) => updatePrompt(event.target.value)}
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
                  showChatGpt={supportsChatGptLogin}
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
        apiKeyError={apiKeyStorageError}
        byok={byokConnection}
        byokSnapshot={byokSnapshot}
        busy={chatGptLoading}
        chatGpt={chatGptConnection ?? disconnectedChatGpt}
        chatGptError={connectionError}
        chatGptLogin={chatGptLogin}
        open={settingsOpen}
        legacyByokSnapshot={legacyByokSnapshot}
        provider={settingsProvider}
        showChatGpt={supportsChatGptLogin}
        onCancelLogin={() => void cancelChatGptLogin()}
        onClear={clearApiKey}
        onConnect={() => void startChatGptLogin()}
        onDisconnect={() => void disconnectChatGpt()}
        onOpenChange={(open) => {
          setSettingsOpen(open)
          if (open) setApiKeyStorageError('')
        }}
        onProviderChange={changeSettingsProvider}
        onRefresh={() => void refreshChatGptConnection(undefined, true)}
        onMigrate={migrateLegacyApiKey}
        onSave={saveApiKey}
        onUnlock={unlockApiKey}
      />
    </section>
  )
})

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
  login: BuilderChatGptLogin
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

function ErrorMessage({
  message,
  onCopyDebugTranscript,
}: {
  message: string
  onCopyDebugTranscript?: () => Promise<void>
}) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="group/error relative mt-4 rounded-md border border-border-default bg-background-surface px-2.5 py-2">
      <p
        className="pr-7 text-xs/5 whitespace-pre-wrap text-text-secondary"
        role="alert"
      >
        {message}
      </p>
      {onCopyDebugTranscript ? (
        <Tooltip
          content={copied ? 'Debug transcript copied' : 'Copy debug transcript'}
        >
          <Button
            type="button"
            variant="icon"
            color="gray"
            size="icon-sm"
            className="absolute top-1 right-1 size-6 bg-transparent p-0 opacity-0 hover:bg-surface-state-hover focus-visible:opacity-100 group-hover/error:opacity-100"
            aria-label={
              copied ? 'Debug transcript copied' : 'Copy debug transcript'
            }
            onClick={() => {
              void onCopyDebugTranscript().then(() => setCopied(true))
            }}
          >
            {copied ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </Tooltip>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Debug transcript copied.' : ''}
      </span>
    </div>
  )
}

function TranscriptRowView({
  row,
  onCancelQueued,
  onConnectQueued,
  onCopyDebugTranscript,
  onDismissCheckpoint,
  onRestoreCheckpoint,
}: {
  row: TranscriptRow
  onCancelQueued: (id: string) => void
  onConnectQueued: (provider: BuilderAiRemoteProvider) => void
  onCopyDebugTranscript: () => Promise<void>
  onDismissCheckpoint: () => void
  onRestoreCheckpoint: () => void
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
            connection={row.connection}
            prompt={row.prompt}
            onCancel={() => onCancelQueued(row.prompt.id)}
            onConnect={() => {
              if (row.connection) onConnectQueued(row.connection.provider)
            }}
          />
        ) : row.kind === 'checkpoint' ? (
          <CheckpointNotice
            onDismiss={onDismissCheckpoint}
            onRestore={onRestoreCheckpoint}
          />
        ) : (
          <ErrorMessage
            message={row.message}
            onCopyDebugTranscript={onCopyDebugTranscript}
          />
        )}
      </div>
    </div>
  )
}

function CheckpointNotice({
  onDismiss,
  onRestore,
}: {
  onDismiss: () => void
  onRestore: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-background-elevated px-3 py-2">
      <p className="text-xs/5 text-text-secondary">
        The pre-run builder is available as a checkpoint.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="secondary" size="xs" onClick={onRestore}>
          Restore
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function QueuedPrompt({
  connection,
  prompt,
  onCancel,
  onConnect,
}: {
  connection?: {
    provider: BuilderAiRemoteProvider
    locked: boolean
  }
  prompt: BuilderAiQueuedPrompt
  onCancel: () => void
  onConnect: () => void
}) {
  const label = connection
    ? connection.locked
      ? 'Waiting for key unlock'
      : 'Waiting for model connection'
    : prompt.mode === 'steer'
      ? 'Steering'
      : 'Queued'

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
      {connection ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={onConnect}
        >
          {connection.locked ? 'Unlock' : 'Connect'}
        </Button>
      ) : null}
      <Tooltip content="Remove queued message">
        <Button
          type="button"
          variant="icon"
          color="gray"
          size="icon-sm"
          className="shrink-0"
          aria-label="Remove queued message"
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
  activity?: BuilderAiActivity
  content: string
}) {
  return (
    <article aria-label="Assistant" className="space-y-3">
      {activity ? <BuilderAgentActivity activity={activity} /> : null}
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
  showChatGpt,
  onSelect,
}: {
  chatGptModels: ReadonlyArray<ChatGptModelChoice>
  disabled: boolean
  selected: ModelChoice
  showChatGpt: boolean
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
          aria-label={`Select model, current ${selected.label}`}
          data-builder-ai-selected-model={selected.model}
          className="max-w-52 px-2"
        >
          <span className="truncate">{selected.label}</span>
          <CaretDownIcon className="size-3" aria-hidden="true" />
        </Button>
      </DropdownTrigger>
      <DropdownContent
        align="start"
        side="top"
        className="sandbox-ui w-64 rounded-xl"
      >
        {showChatGpt ? (
          <>
            {chatGptModels.length ? (
              <ModelGroup
                label="ChatGPT"
                models={chatGptModels}
                selected={selected}
                onSelect={onSelect}
              />
            ) : (
              <div>
                <div className="px-2 py-1 font-ds-mono text-[10px] uppercase tracking-wide text-text-muted">
                  ChatGPT
                </div>
                <DropdownItem
                  className="min-h-11 rounded-lg px-2.5"
                  onSelect={() => onSelect(chatGptPlaceholder)}
                >
                  <span>
                    <span className="block text-sm text-text-primary">
                      Connect ChatGPT
                    </span>
                    <span className="block text-xs text-text-muted">
                      Use your ChatGPT plan
                    </span>
                  </span>
                </DropdownItem>
              </div>
            )}
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
  mode: BuilderAiSendMode
  onChange: (mode: BuilderAiSendMode) => void
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
      <DropdownContent
        align="end"
        side="top"
        className="sandbox-ui w-72 rounded-xl"
      >
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
          <span
            className="min-w-0"
            data-builder-ai-connection={model.connection}
            data-builder-ai-model={model.model}
          >
            <span className="block truncate text-sm text-text-primary">
              {model.label}
            </span>
            <span className="block truncate font-ds-mono text-[10px] text-text-muted">
              {model.connection === 'byok' ? model.description : model.model}
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
  apiKeyError,
  byok,
  byokSnapshot,
  busy,
  chatGpt,
  chatGptError,
  chatGptLogin,
  open,
  legacyByokSnapshot,
  provider,
  showChatGpt,
  onCancelLogin,
  onClear,
  onConnect,
  onDisconnect,
  onMigrate,
  onOpenChange,
  onProviderChange,
  onRefresh,
  onSave,
  onUnlock,
}: {
  apiKeyError: string
  byok: BuilderAiByokConnection
  byokSnapshot: ByokSnapshot
  busy: boolean
  chatGpt: BuilderChatGptConnection
  chatGptError: string
  chatGptLogin: BuilderChatGptLogin | undefined
  open: boolean
  legacyByokSnapshot: ByokSnapshot
  provider: BuilderAiRemoteProvider
  showChatGpt: boolean
  onCancelLogin: () => void
  onClear: (provider: BuilderAiRemoteProvider) => Promise<void>
  onConnect: () => void
  onDisconnect: () => void
  onMigrate: (provider: BuilderAiRemoteProvider) => Promise<void>
  onOpenChange: (open: boolean) => void
  onProviderChange: (provider: BuilderAiRemoteProvider) => void
  onRefresh: () => void
  onSave: (
    provider: BuilderAiRemoteProvider,
    apiKey: string,
  ) => Promise<boolean>
  onUnlock: (provider: BuilderAiRemoteProvider) => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sandbox-ui` scopes the builder's own type/colour context; the DS
          panel supplies posture, elevation and behaviour. */}
      <DialogContent size="md" className="sandbox-ui">
        <DialogHeader title="Model connections" />
        <DialogBody className="space-y-6 pb-5">
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
            className={showChatGpt ? 'border-t border-border-default pt-5' : ''}
          >
            <h3 className="text-sm font-medium">API key</h3>
            <ProviderSettingsForm
              byok={byok}
              byokSnapshot={byokSnapshot}
              error={apiKeyError}
              legacyByokSnapshot={legacyByokSnapshot}
              provider={provider}
              onClear={onClear}
              onMigrate={onMigrate}
              onProviderChange={onProviderChange}
              onSave={onSave}
              onUnlock={onUnlock}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function ProviderSettingsForm({
  byok,
  byokSnapshot,
  error,
  legacyByokSnapshot,
  provider,
  onClear,
  onMigrate,
  onProviderChange,
  onSave,
  onUnlock,
}: {
  byok: BuilderAiByokConnection
  byokSnapshot: ByokSnapshot
  error: string
  legacyByokSnapshot: ByokSnapshot
  provider: BuilderAiRemoteProvider
  onClear: (provider: BuilderAiRemoteProvider) => Promise<void>
  onMigrate: (provider: BuilderAiRemoteProvider) => Promise<void>
  onProviderChange: (provider: BuilderAiRemoteProvider) => void
  onSave: (
    provider: BuilderAiRemoteProvider,
    apiKey: string,
  ) => Promise<boolean>
  onUnlock: (provider: BuilderAiRemoteProvider) => Promise<void>
}) {
  const [pendingAction, setPendingAction] = React.useState<
    'clear' | 'migrate' | 'save' | 'unlock'
  >()
  const pendingActionRef = React.useRef(false)
  const providerId = React.useId()
  const apiKeyId = React.useId()
  const status = byokSnapshot.status[provider]
  const hasCurrentKey = byok.hasCurrentKey(provider)
  const hasLegacyKey = byok.hasLegacyKey(provider)
  const hasKey = hasCurrentKey || hasLegacyKey
  const legacyOnly = hasLegacyKey && !hasCurrentKey
  const busy = pendingAction !== undefined
  const maskedKey = hasCurrentKey
    ? status?.state === 'empty' || status?.state === 'error'
      ? undefined
      : status?.masked
    : legacyByokSnapshot.status[provider]?.state === 'empty'
      ? undefined
      : legacyByokSnapshot.status[provider]?.masked

  let storageDescription: string
  if (status?.state === 'error') {
    storageDescription = hasCurrentKey
      ? 'The replacement was not saved. Your previous key is still available in this tab.'
      : 'The key was not saved.'
  } else if (hasCurrentKey && hasLegacyKey) {
    storageDescription = byok.storage.persistent
      ? 'The current key is encrypted with your passkey, but an older unencrypted browser copy still exists.'
      : 'The current key is in memory for this tab, but an older unencrypted browser copy still exists.'
  } else if (legacyOnly) {
    storageDescription = byok.storage.persistent
      ? 'This key is in older unencrypted browser storage. Move it to passkey storage to encrypt it.'
      : 'This key is in older unencrypted browser storage. Open Builder over HTTPS in a passkey-capable browser to move it.'
  } else if (status?.state === 'locked') {
    storageDescription =
      'Encrypted with your passkey. Unlock it now, or unlock it when you send a message.'
  } else if (hasCurrentKey && byok.storage.persistent) {
    storageDescription = 'Encrypted with your passkey and saved on this device.'
  } else if (hasCurrentKey) {
    storageDescription =
      'Kept in memory for this tab. Refreshing this page clears it.'
  } else if (byok.storage.persistent) {
    storageDescription =
      'New keys are encrypted with your passkey and saved on this device.'
  } else {
    storageDescription =
      byok.storage.warning ??
      'New keys stay in memory for this tab and clear on refresh.'
  }
  const visibleError =
    error ||
    (status?.state === 'error' ? status.message : '') ||
    byokSnapshot.storageError ||
    ''

  async function runKeyAction(
    action: 'clear' | 'migrate' | 'save' | 'unlock',
    callback: () => Promise<unknown>,
  ) {
    if (pendingActionRef.current) return
    pendingActionRef.current = true
    setPendingAction(action)
    try {
      await callback()
    } finally {
      pendingActionRef.current = false
      setPendingAction(undefined)
    }
  }

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const value = new FormData(form).get('apiKey')
        if (typeof value !== 'string' || !value.trim()) return
        form.reset()
        void runKeyAction('save', () => onSave(provider, value))
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
          disabled={busy}
          onChange={(event) =>
            onProviderChange(parseBuilderAiProvider(event.target.value))
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
          key={provider}
          id={apiKeyId}
          name="apiKey"
          type="password"
          maxLength={4_096}
          autoComplete="off"
          spellCheck={false}
          required
          disabled={busy}
          placeholder={hasKey ? 'Paste a replacement key' : 'Paste API key'}
          className="mt-1.5 font-ds-mono text-sm"
        />
      </div>
      <div className="rounded-lg border border-border-default bg-background-subtle p-3 text-xs/5">
        {maskedKey ? (
          <p className="font-ds-mono text-text-primary">{maskedKey}</p>
        ) : null}
        <p className={maskedKey ? 'mt-0.5 text-text-muted' : 'text-text-muted'}>
          {storageDescription}
        </p>
        {hasLegacyKey && (hasCurrentKey || byok.storage.persistent) ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-2"
            disabled={busy}
            onClick={() =>
              void runKeyAction('migrate', () => onMigrate(provider))
            }
          >
            {pendingAction === 'migrate'
              ? 'Moving…'
              : hasCurrentKey
                ? 'Remove older copy'
                : 'Move to passkey storage'}
          </Button>
        ) : status?.state === 'locked' ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-2"
            disabled={busy}
            onClick={() =>
              void runKeyAction('unlock', () => onUnlock(provider))
            }
          >
            {pendingAction === 'unlock' ? 'Unlocking…' : 'Unlock saved key'}
          </Button>
        ) : null}
      </div>
      {visibleError ? <ErrorMessage message={visibleError} /> : null}
      <div className="flex justify-end gap-2">
        {hasKey ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void runKeyAction('clear', () => onClear(provider))}
          >
            {pendingAction === 'clear' ? 'Removing…' : 'Remove key'}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {pendingAction === 'save'
            ? 'Saving…'
            : hasKey
              ? 'Replace key'
              : 'Use key'}
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
  onValidate,
  threadId,
}: {
  activityId: string
  abortController: AbortController
  execution: BuilderAiExecution
  hiddenFiles: ReadonlyArray<string>
  messages: Array<BuilderAiMessage>
  model: string
  onActivityEvent: (event: BuilderAiActivityEvent) => void
  onText: (text: string) => void
  onValidate: (
    state: BuilderAiValidationState,
  ) => Promise<BuilderAiStreamValidationOutcome>
  threadId: string
}) {
  return runBuilderAiStream({
    endpoint: '/api/builder/chatgpt/assist',
    activityId,
    forwardedProps: {
      model,
      execution,
      hiddenFiles,
    },
    includeReasoningSummaries: true,
    messages,
    onActivityEvent,
    onLocalValidate: onValidate,
    onText,
    signal: abortController.signal,
    threadId,
  })
}

async function runRemoteAgent({
  activityId,
  abortController,
  byok,
  execution,
  hiddenFiles,
  messages,
  model,
  onActivityEvent,
  onText,
  onValidate,
  provider,
  threadId,
}: {
  activityId: string
  abortController: AbortController
  byok: ByokClient
  execution: BuilderAiExecution
  hiddenFiles: ReadonlyArray<string>
  messages: Array<BuilderAiMessage>
  model: string
  onActivityEvent: (event: BuilderAiActivityEvent) => void
  onText: (text: string) => void
  onValidate: (
    state: BuilderAiValidationState,
  ) => Promise<BuilderAiStreamValidationOutcome>
  provider: BuilderAiRemoteProvider
  threadId: string
}) {
  return runBuilderAiStream({
    endpoint: '/api/builder/assist',
    activityId,
    forwardedProps: {
      provider,
      model,
      execution,
      hiddenFiles,
    },
    byok,
    byokProvider: provider,
    messages,
    onActivityEvent,
    onText,
    onValidate,
    signal: abortController.signal,
    threadId,
  })
}

function requireBuilderAiByokClient(client: ByokClient | undefined) {
  if (!client) throw new Error('This browser does not have this API key.')
  return client
}

async function requestChatGptConnection(body: unknown) {
  const response = await fetch('/api/builder/chatgpt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) throw new Error(readErrorMessage(value, response.status))
  return value
}

function chatGptModelChoice(
  model: BuilderChatGptConnection['models'][number],
): ChatGptModelChoice {
  return { connection: 'chatgpt', model: model.id, label: model.label }
}

function getPreferredChatGptModel(connection: BuilderChatGptConnection) {
  return (
    connection.models.find((model) => model.id === openAiDefault.model) ??
    connection.models.find((model) => model.isDefault) ??
    connection.models[0]
  )
}

function createTranscriptMessage(
  role: BuilderAiMessage['role'],
  content: string,
  activity?: BuilderAiActivity,
  id: string = crypto.randomUUID(),
): TranscriptMessage {
  return {
    id,
    role,
    content,
    ...(activity ? { activity } : {}),
  }
}

function orderPendingPrompts(
  prompts: ReadonlyArray<BuilderProjectPendingPrompt>,
) {
  return [...prompts].sort(
    (left, right) =>
      getPendingPromptPriority(left.queueKind) -
        getPendingPromptPriority(right.queueKind) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.runId.localeCompare(right.runId),
  )
}

function getPendingPromptPriority(
  queueKind: BuilderProjectPendingPrompt['queueKind'],
) {
  switch (queueKind) {
    case 'active':
      return 0
    case 'steer':
      return 1
    case 'queue':
      return 2
  }
}

function getMostRecentBuilderProjectThread(
  threads: ReadonlyArray<BuilderProjectSyncThread>,
) {
  return threads
    .filter((thread) => thread.archivedAt === null)
    .reduce<BuilderProjectSyncThread | undefined>(
      (latest, thread) =>
        !latest || thread.updatedAt > latest.updatedAt ? thread : latest,
      undefined,
    )
}

function getBuilderProjectThreads(
  threads: ReadonlyArray<BuilderProjectSyncThread>,
): Array<BuilderAiThread> {
  return threads
    .filter((thread) => thread.archivedAt === null)
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: Date.parse(thread.createdAt),
      lastAccessedAt: Date.parse(thread.updatedAt),
      sizeBytes: 0,
    }))
    .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
}

function getBuilderProjectTranscriptMessages(
  threadId: string,
  messages: ReadonlyArray<BuilderProjectSyncMessage>,
  runs: ReadonlyArray<BuilderProjectSyncRun>,
) {
  const allThreadMessages = messages.filter(
    (message) => message.threadId === threadId,
  )
  const runsById = new Map(
    runs.filter((run) => run.threadId === threadId).map((run) => [run.id, run]),
  )
  const assistantRunIds = new Set(
    allThreadMessages
      .filter(
        (message) => message.role === 'assistant' && message.runId !== null,
      )
      .map((message) => message.runId)
      .filter((runId): runId is string => runId !== null),
  )
  const pendingRunIds = new Set(
    [...runsById.values()]
      .filter((run) => run.status === 'pending')
      .map((run) => run.id),
  )
  const threadMessages = allThreadMessages.filter(
    (message) =>
      message.role !== 'user' ||
      message.runId === null ||
      !pendingRunIds.has(message.runId),
  )
  const positioned: Array<{
    position: number
    createdAt: string
    message: TranscriptMessage
  }> = threadMessages.map((message) => {
    const activity =
      message.role === 'assistant' && message.runId
        ? getBuilderProjectRunActivity(runsById.get(message.runId))
        : undefined
    return {
      position: message.position * 2,
      createdAt: message.createdAt,
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        ...(activity ? { activity } : {}),
      },
    }
  })

  for (const run of runsById.values()) {
    if (assistantRunIds.has(run.id)) continue
    const activity = getBuilderProjectRunActivity(run)
    if (!activity) continue
    const userPosition = threadMessages.find(
      (message) => message.role === 'user' && message.runId === run.id,
    )?.position
    positioned.push({
      position:
        userPosition === undefined
          ? Number.MAX_SAFE_INTEGER
          : userPosition * 2 + 1,
      createdAt: run.updatedAt,
      message: {
        id: `run:${run.id}`,
        role: 'assistant',
        content: '',
        activity,
      },
    })
  }

  return positioned
    .sort(
      (left, right) =>
        left.position - right.position ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .map(({ message }) => message)
}

function getBuilderProjectRunActivity(run: BuilderProjectSyncRun | undefined) {
  if (!run) return undefined
  if (run.activity) return parseBuilderAiActivity(run.activity)
  if (run.status === 'pending') return undefined

  const startedAt = Date.parse(run.startedAt ?? run.createdAt)
  let activity = reduceBuilderAiActivity(undefined, {
    type: 'run-started',
    runId: run.id,
    timestamp: startedAt,
  })
  if (run.status === 'running') return activity

  const completedAt = Date.parse(run.completedAt ?? run.updatedAt)
  if (run.status === 'completed') {
    activity = reduceBuilderAiActivity(activity, {
      type: 'run-completed',
      runId: run.id,
      timestamp: completedAt,
    })
  } else if (run.status === 'failed') {
    activity = reduceBuilderAiActivity(activity, {
      type: 'run-failed',
      runId: run.id,
      timestamp: completedAt,
      error: readBuilderProjectRunError(run.error),
    })
  } else if (run.status === 'cancelled' || run.status === 'interrupted') {
    activity = reduceBuilderAiActivity(activity, {
      type: 'run-stopped',
      runId: run.id,
      timestamp: completedAt,
    })
  }
  return activity
}

function readBuilderProjectRunError(error: BuilderProjectSyncRun['error']) {
  return error && typeof error.message === 'string'
    ? error.message
    : 'Builder run failed'
}

function withTerminalSyncFailure(message: string, syncFailure: unknown) {
  return syncFailure
    ? `${message}\nThe run's final state could not sync: ${formatError(syncFailure)}`
    : message
}

function readErrorMessage(value: unknown, status: number) {
  if (isRecord(value) && typeof value.error === 'string') return value.error
  return `Builder AI request failed (${status})`
}

function parseBuilderAiProvider(value: string): BuilderAiRemoteProvider {
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
