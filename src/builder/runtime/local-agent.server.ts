import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { transform } from 'esbuild'
import {
  compileHandler,
  type CompileResponse,
  type ProjectDefinition,
} from '~/builder/api/compile'
import { createLocalBuilderManifestBundleFromFiles } from '~/builder/manifest'
import type { BuilderFileSource, BuilderRunStatus } from '~/builder/schema'
import type { LocalBuilderTimelineEvent } from '~/builder/projection'
import {
  acquireLocalForgeLockLease,
  appendLocalForgeManifestTimeline,
  appendLocalForgeTimelineEvents,
  createLocalForgeProducer,
  getActiveLocalForgeSessionId,
  isActiveLocalForgeRunStatus,
  LOCAL_FORGE_PROJECT_ID,
  LOCAL_FORGE_WORKFLOW_LOCK_NAME,
  normalizeLocalForgeEventStatus,
  persistLocalForgeManifestBundle,
  readLocalForgeSnapshot,
  readLocalForgeTimeline,
  updateActiveLocalForgeChatTitleFromPrompt,
  withLocalForgeLock,
  type LocalForgeSnapshot,
} from './local-store.server'
import { materializeLocalForgeManifest } from './local-materialize.server'
import {
  createMinimalLocalForgeSeedFiles,
  minimalLocalForgeSeedNeedsUpdate,
} from './local-template.server'
import {
  isSandboxForgeHarnessAvailable,
  runSandboxForgeHarness,
} from './sandbox-harness.server'

const LOCAL_FORGE_CONTEXT_VERSION = 'forge-local-agent-2026-06-18'
const LOCAL_FORGE_BASELINE_LOCK_STALE_MS = 10 * 60_000
const LOCAL_FORGE_BASELINE_LOCK_WAIT_MS = 30_000
const LOCAL_FORGE_RUN_LOCK_STALE_MS = 10 * 60_000
const LOCAL_FORGE_RUN_LOCK_WAIT_MS = 100
const LOCAL_FORGE_APP_SOURCE_PREFIXES = ['src/', 'public/']
const LOCAL_FORGE_EDITABLE_ROOT_FILE_PATHS = new Set<string>([
  'AGENTS.md',
  'README.md',
  'app.config.ts',
  'components.json',
  'index.html',
  'netlify.toml',
  'package.json',
  'postcss.config.cjs',
  'postcss.config.js',
  'postcss.config.mjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'tsconfig.json',
  'tsr.config.json',
  'vercel.json',
  'vite.config.ts',
  'wrangler.json',
  'wrangler.jsonc',
  'wrangler.toml',
])
export const LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS = new Set([
  'package.json',
  'src/routes/__root.tsx',
  'src/router.tsx',
])
const LOCAL_FORGE_VALIDATION_TIMEOUT_MS = 300_000
const LOCAL_FORGE_VALIDATION_MAX_OUTPUT_CHARS = 40_000
const ROUTE_TREE_GENERATOR_SCRIPT = [
  "import { Generator, getConfig } from '@tanstack/router-generator'",
  'const root = process.cwd()',
  "const config = getConfig({ target: 'react', routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts', disableLogging: true }, root)",
  'await new Generator({ config, root }).run()',
].join('; ')

const TANSTACK_CONTEXT = [
  'Build TanStack Start apps first, using TanStack Router file routes and explicit server/client boundaries.',
  'Use route loaders, search params, server functions, and typed route APIs before inventing framework glue.',
  'Prefer TanStack Query for async server state, TanStack Form for complex forms, TanStack Table for dense tables, TanStack Store for shared client state, TanStack DB for local-first sync, TanStack Virtual for large lists, TanStack Pacer for queues/rate control, TanStack Hotkeys for keyboard workflows, TanStack Devtools for inspection, and TanStack AI for model/tool orchestration.',
  'Keep the generated app specific to the user brief. Do not ship a generic starter dashboard or a page that describes a plan instead of implementing the requested app.',
  'Default deployability to Cloudflare Workers. Keep framework files compatible with the generated TanStack Start scaffold.',
]

const localForgeDefinition = {
  featureOptions: {},
  features: [],
  framework: 'react',
  name: 'forge-local-app',
  packageManager: 'pnpm',
  tailwind: true,
} satisfies ProjectDefinition

type ForgeWorkspaceFile = {
  contents: string
  path: string
  source: BuilderFileSource
}

type ForgeRunContext = {
  assistantMessageId: string
  clientRequestId: string
  inputEventId: string
  messageId: string
  runId: string
  startedAt: number
}

type ForgeAgentState = {
  changeCount: number
  planReceived: boolean
  summary: string
  summaryReceived: boolean
  title: string
  streamedAssistantMessage: boolean
  validated: boolean
  validatedChangeCount: number | undefined
  validatedWithWorkspaceCommands: boolean
  validationProblems: Array<string>
}

export type LocalForgeAgentCompletionState = Pick<
  ForgeAgentState,
  | 'changeCount'
  | 'planReceived'
  | 'summaryReceived'
  | 'validated'
  | 'validatedChangeCount'
  | 'validatedWithWorkspaceCommands'
  | 'validationProblems'
>

type ForgeValidationCommandResult = {
  commandLine: string
  exitCode: number | null
  stderr: string
  stdout: string
}

type PreparedForgeAgentRun = {
  initialSnapshot: LocalForgeSnapshot
  prompt: string
  runContext: ForgeRunContext
}

type ForgeAgentHarnessName = 'claude-code' | 'codex'

export type ForgeAgentHarnessRunInput = {
  initialSnapshot: LocalForgeSnapshot
  prompt: string
  runContext: ForgeRunContext
  state: ForgeAgentState
  toolEvents: Set<string>
  workspace: Map<string, ForgeWorkspaceFile>
}

type ForgeAgentHarness = {
  label: string
  name: ForgeAgentHarnessName
  run: (input: ForgeAgentHarnessRunInput) => Promise<void>
}

export interface LocalForgeWorkspaceDeleteResult {
  found: boolean
  ok: boolean
  path: string
  problems: Array<string>
}

export async function ensureLocalForgeBaseline() {
  const existing = await readLocalForgeSnapshot()

  if (!localForgeSnapshotNeedsBaselineUpdate(existing)) {
    return existing
  }

  if (localForgeSnapshotHasActiveRun(existing)) {
    return existing
  }

  return withLocalForgeLock({
    name: 'baseline',
    staleMs: LOCAL_FORGE_BASELINE_LOCK_STALE_MS,
    task: async () =>
      ensureLocalForgeBaselineLocked(await readLocalForgeSnapshot()),
    waitMs: LOCAL_FORGE_BASELINE_LOCK_WAIT_MS,
  })
}

async function ensureLocalForgeBaselineLocked(existing: LocalForgeSnapshot) {
  if (localForgeSnapshotHasActiveRun(existing)) {
    return existing
  }

  if (existing.currentManifest) {
    return ensureLocalForgePackageManifest(
      await ensureLocalForgeSeedTemplate(existing),
    )
  }

  const compile = await compileHandler(localForgeDefinition)
  const files = addLocalForgePackageSupport(
    createMinimalLocalForgeSeedFiles({
      ...compile.files,
      'AGENTS.md': buildForgeAgentsFile('Initial local Forge workspace'),
      'src/generated/forge-context.ts': buildForgeContextFile(
        'Initial local Forge workspace',
      ),
    }),
  )
  const bundle = await createManifestBundle({
    createdAt: new Date().toISOString(),
    files,
    fileSources: Object.fromEntries(
      Object.keys(files).map((filePath) => [
        filePath,
        'builder-definition' satisfies BuilderFileSource,
      ]),
    ),
    parentManifestVersionId: undefined,
    runId: undefined,
    seedCompile: compile,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'local-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  return readLocalForgeSnapshot()
}

function localForgeSnapshotNeedsBaselineUpdate(snapshot: LocalForgeSnapshot) {
  if (!snapshot.currentManifest) {
    return true
  }

  const files = addLocalForgePackageSupport(snapshot.files)

  return (
    files['package.json'] !== snapshot.files['package.json'] ||
    (localForgeSnapshotCanRefreshSeedTemplate(snapshot) &&
      minimalLocalForgeSeedNeedsUpdate(snapshot.files))
  )
}

function localForgeSnapshotHasActiveRun(snapshot: LocalForgeSnapshot) {
  const status = snapshot.latestRun?.status

  return status ? isActiveLocalForgeRunStatus(status) : false
}

async function ensureLocalForgePackageManifest(existing: LocalForgeSnapshot) {
  if (!existing.currentManifest) {
    return existing
  }

  const files = addLocalForgePackageSupport(existing.files)

  if (files['package.json'] === existing.files['package.json']) {
    return existing
  }

  const seedCompile = await compileHandler(localForgeDefinition)
  const bundle = await createManifestBundle({
    createdAt: new Date().toISOString(),
    files,
    fileSources: Object.fromEntries(
      Object.entries(existing.currentManifest.files).map(([filePath, file]) => [
        filePath,
        file.source,
      ]),
    ),
    parentManifestVersionId: existing.currentManifest.manifestVersionId,
    runId: undefined,
    seedCompile,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'local-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  return readLocalForgeSnapshot()
}

async function ensureLocalForgeSeedTemplate(existing: LocalForgeSnapshot) {
  if (
    !existing.currentManifest ||
    !localForgeSnapshotCanRefreshSeedTemplate(existing) ||
    !minimalLocalForgeSeedNeedsUpdate(existing.files)
  ) {
    return existing
  }

  const seedCompile = await compileHandler(localForgeDefinition)
  const files = addLocalForgePackageSupport(
    createMinimalLocalForgeSeedFiles({
      ...seedCompile.files,
      'AGENTS.md': buildForgeAgentsFile('Initial local Forge workspace'),
      'src/generated/forge-context.ts': buildForgeContextFile(
        'Initial local Forge workspace',
      ),
    }),
  )
  const bundle = await createManifestBundle({
    createdAt: new Date().toISOString(),
    files,
    fileSources: Object.fromEntries(
      Object.keys(files).map((filePath) => [
        filePath,
        'builder-definition' satisfies BuilderFileSource,
      ]),
    ),
    parentManifestVersionId: existing.currentManifest.manifestVersionId,
    runId: undefined,
    seedCompile,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'local-runtime',
    producerKind: 'system',
    runId: undefined,
  })

  return readLocalForgeSnapshot()
}

function localForgeSnapshotCanRefreshSeedTemplate(
  snapshot: LocalForgeSnapshot,
) {
  const files = snapshot.currentManifest?.files

  if (!files) {
    return false
  }

  return Object.values(files).every(
    (file) => file.source === 'builder-definition' || file.source === 'system',
  )
}

export async function runLocalForgeAgent({
  clientRequestId = `local-request-${crypto.randomUUID()}`,
  prompt,
}: {
  clientRequestId?: string
  prompt: string
}): Promise<LocalForgeSnapshot> {
  try {
    return await withLocalForgeLock({
      name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
      staleMs: LOCAL_FORGE_RUN_LOCK_STALE_MS,
      task: async () =>
        (await readExistingClientRequestSnapshot(clientRequestId)) ??
        runLocalForgeAgentLocked({ clientRequestId, prompt }),
      waitMs: LOCAL_FORGE_RUN_LOCK_WAIT_MS,
    })
  } catch (error) {
    if (isLocalForgeWorkflowLockError(error)) {
      throw new Error('A local Forge workflow is already active.')
    }

    throw error
  }
}

export async function startLocalForgeAgentRun({
  clientRequestId,
  prompt,
}: {
  clientRequestId: string
  prompt: string
}): Promise<LocalForgeSnapshot> {
  const existingSnapshot =
    await readExistingClientRequestSnapshot(clientRequestId)

  if (existingSnapshot) {
    return existingSnapshot
  }

  let lease: Awaited<ReturnType<typeof acquireLocalForgeLockLease>> | undefined

  try {
    lease = await acquireLocalForgeLockLease({
      name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
      staleMs: LOCAL_FORGE_RUN_LOCK_STALE_MS,
      waitMs: LOCAL_FORGE_RUN_LOCK_WAIT_MS,
    })

    const duplicateSnapshot =
      await readExistingClientRequestSnapshot(clientRequestId)

    if (duplicateSnapshot) {
      await lease.release()
      lease = undefined
      return duplicateSnapshot
    }

    await updateActiveLocalForgeChatTitleFromPrompt(prompt)

    const preparedRun = await prepareLocalForgeAgentRun({
      clientRequestId,
      prompt,
    })
    const startedSnapshot = await readLocalForgeSnapshot()

    void drainLocalForgeAgentRun(preparedRun)
      .catch(() => {
        // The run failure is already persisted into the Forge timeline.
      })
      .finally(() => {
        void lease?.release().catch((error) => {
          console.error('Local Forge run lock release failed', error)
        })
      })

    return startedSnapshot
  } catch (error) {
    if (lease) {
      await lease.release()
    }

    if (isLocalForgeWorkflowLockError(error)) {
      const duplicateSnapshot =
        await readExistingClientRequestSnapshot(clientRequestId)

      if (duplicateSnapshot) {
        return duplicateSnapshot
      }

      throw new Error('A local Forge workflow is already active.')
    }

    throw error
  }
}

function isLocalForgeWorkflowLockError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(`${LOCAL_FORGE_WORKFLOW_LOCK_NAME}.lock`)
  )
}

async function runLocalForgeAgentLocked({
  clientRequestId,
  prompt,
}: {
  clientRequestId: string
  prompt: string
}): Promise<LocalForgeSnapshot> {
  await drainLocalForgeAgentRun(
    await prepareLocalForgeAgentRun({
      clientRequestId,
      prompt,
    }),
  )

  return readLocalForgeSnapshot()
}

async function prepareLocalForgeAgentRun({
  clientRequestId,
  prompt,
}: {
  clientRequestId: string
  prompt: string
}): Promise<PreparedForgeAgentRun> {
  await ensureLocalForgeBaseline()

  const initialSnapshot = await recoverOrRejectActiveRun(
    await readLocalForgeSnapshot(),
  )
  const runContext = await appendRunStart({
    clientRequestId,
    prompt,
  })

  return {
    initialSnapshot,
    prompt,
    runContext,
  }
}

async function readExistingClientRequestSnapshot(clientRequestId: string) {
  const timeline = await readLocalForgeTimeline()

  for (const event of timeline) {
    if (
      event.type === 'session.input.received' &&
      event.payload.clientRequestId === clientRequestId
    ) {
      return readLocalForgeSnapshot()
    }
  }

  return undefined
}

async function drainLocalForgeAgentRun({
  initialSnapshot,
  prompt,
  runContext,
}: PreparedForgeAgentRun) {
  const harness = getLocalForgeHarness()
  const state: ForgeAgentState = {
    changeCount: 0,
    planReceived: false,
    summary: '',
    summaryReceived: false,
    title: 'Untitled app',
    streamedAssistantMessage: false,
    validated: false,
    validatedChangeCount: undefined,
    validatedWithWorkspaceCommands: false,
    validationProblems: [],
  }

  if (!harness) {
    const error = getLocalForgeHarnessUnavailableMessage()
    await failRun({ error, runContext })
    throw new Error(error)
  }

  const seedCompile = await compileHandler(localForgeDefinition)
  const workspace = createLocalForgeWorkspaceFromSnapshot(initialSnapshot)
  const toolEvents = new Set<string>()

  try {
    await appendAgentEvent({
      detail: `FORGE_AGENT_HARNESS=${harness.name}`,
      message: `${harness.label} harness started`,
      name: 'agent.harness.started',
      runContext,
      status: 'running',
    })

    await harness.run({
      initialSnapshot,
      prompt,
      runContext,
      state,
      toolEvents,
      workspace,
    })

    await appendAgentEvent({
      message: `${harness.label} harness finished`,
      name: 'agent.harness.finished',
      runContext,
      status: 'finished',
    })

    if (
      !state.validatedWithWorkspaceCommands ||
      state.validatedChangeCount !== state.changeCount
    ) {
      state.validationProblems = uniqueStrings([
        ...state.validationProblems,
        ...(await validateWorkspace({
          includeWorkspaceCommands: true,
          prompt,
          workspace,
        })),
      ])
      state.validatedChangeCount = state.changeCount
      state.validatedWithWorkspaceCommands = true
    } else {
      state.validationProblems = uniqueStrings(state.validationProblems)
    }
    assertCompletedRun(state)

    const finalFiles = addLocalForgePackageSupport(workspaceToFiles(workspace))
    const finalCompile = mergeCompileWithFiles(seedCompile, finalFiles)
    const bundle = await createManifestBundle({
      createdAt: new Date().toISOString(),
      files: finalFiles,
      fileSources: Object.fromEntries(
        Array.from(workspace.values()).map((file) => [file.path, file.source]),
      ),
      parentManifestVersionId: initialSnapshot.manifestVersionId,
      runId: runContext.runId,
      seedCompile: finalCompile,
    })

    await persistLocalForgeManifestBundle(bundle)
    const materialized = await materializeLocalForgeManifest({
      commitSystemSnapshotTimeline: false,
      manifest: bundle.manifest,
      runId: runContext.runId,
    })
    await appendLocalForgeManifestTimeline({
      bundle: {
        blobs: {},
        manifest: materialized.manifest,
      },
      createdAt: materialized.manifest.createdAt,
      producerId: 'local-agent',
      producerKind: 'agent',
      runId: runContext.runId,
    })
    if (!state.streamedAssistantMessage) {
      await appendAssistantMessage({
        runContext,
        text: state.summary,
      })
    }
    await appendRunFinished({
      runContext,
      status: 'finished',
    })

    return readLocalForgeSnapshot()
  } catch (error) {
    const message = readError(error)
    await failRun({
      error: message,
      runContext,
    })
    throw error
  }
}

function getLocalForgeHarness(): ForgeAgentHarness | null {
  const kind = getRequestedLocalForgeHarnessName()
  if (!isSandboxForgeHarnessAvailable(kind)) return null
  return {
    label: kind === 'claude-code' ? 'Claude Code (sandbox)' : 'Codex (sandbox)',
    name: kind,
    run: (input) => runSandboxForgeHarness({ ...input, kind }),
  }
}

function getRequestedLocalForgeHarnessName(): ForgeAgentHarnessName {
  return resolveLocalForgeAgentHarnessName(process.env.FORGE_AGENT_HARNESS)
}

export function resolveLocalForgeAgentHarnessName(
  requestedHarness: string | undefined,
): ForgeAgentHarnessName {
  const normalized = requestedHarness?.trim().toLowerCase()
  if (normalized === 'claude-code' || normalized === 'claude')
    return 'claude-code'
  return 'codex'
}

function getLocalForgeHarnessUnavailableMessage() {
  return getRequestedLocalForgeHarnessName() === 'claude-code'
    ? 'Forge needs ANTHROPIC_API_KEY and the `claude` CLI available to use FORGE_AGENT_HARNESS=claude-code.'
    : 'Forge needs OPENAI_API_KEY and the `codex` CLI available to run the default sandbox harness.'
}

async function recoverOrRejectActiveRun(snapshot: LocalForgeSnapshot) {
  const latestRun = snapshot.latestRun

  if (!latestRun || !isActiveLocalForgeRunStatus(latestRun.status)) {
    return snapshot
  }

  const startedAtMs = latestRun.startedAt
    ? Date.parse(latestRun.startedAt)
    : undefined

  if (
    startedAtMs !== undefined &&
    Number.isFinite(startedAtMs) &&
    Date.now() - startedAtMs > LOCAL_FORGE_RUN_LOCK_STALE_MS
  ) {
    await appendStaleActiveRunFailure({
      runId: latestRun.id,
      startedAt: latestRun.startedAt,
    })

    return readLocalForgeSnapshot()
  }

  throw new Error(`Forge run ${latestRun.id} is already ${latestRun.status}.`)
}

async function appendStaleActiveRunFailure({
  runId,
  startedAt,
}: {
  runId: string
  startedAt?: string
}) {
  const existing = await readLocalForgeTimeline()
  const createdAt = new Date().toISOString()
  const error = startedAt
    ? `Recovered stale local Forge run that started at ${startedAt}.`
    : 'Recovered stale local Forge run.'

  await appendLocalForgeTimelineEvents([
    {
      createdAt,
      eventId: `local-stale-run-workflow-${crypto.randomUUID()}`,
      projectId: LOCAL_FORGE_PROJECT_ID,
      producer: createLocalForgeProducer({
        index: existing.length,
        kind: 'system',
        producerId: 'local-runtime',
      }),
      runId,
      schemaVersion: 1,
      sessionId: getActiveLocalForgeSessionId(),
      type: 'workflow.event.recorded',
      payload: {
        detail: error,
        id: `local-stale-run-row-${crypto.randomUUID()}`,
        message: 'Stale run recovered',
        name: 'run.recovered.failed',
        runId,
        status: 'failed',
      },
    },
    {
      createdAt,
      eventId: `local-stale-run-terminal-${crypto.randomUUID()}`,
      projectId: LOCAL_FORGE_PROJECT_ID,
      producer: createLocalForgeProducer({
        index: existing.length + 1,
        kind: 'system',
        producerId: 'local-runtime',
      }),
      runId,
      schemaVersion: 1,
      sessionId: getActiveLocalForgeSessionId(),
      type: 'run.failed',
      payload: {
        error,
        runId,
        status: 'failed',
      },
    },
  ])
}

async function appendRunStart({
  clientRequestId,
  prompt,
}: {
  clientRequestId: string
  prompt: string
}): Promise<ForgeRunContext> {
  const runId = `local-run-${crypto.randomUUID()}`
  const messageId = `local-message-${crypto.randomUUID()}`
  const assistantMessageId = `local-assistant-${crypto.randomUUID()}`
  const inputEventId = `local-input-${crypto.randomUUID()}`
  const startedAt = Date.now()
  const createdAt = new Date(startedAt).toISOString()
  const existing = await readLocalForgeTimeline()
  const runContext = {
    assistantMessageId,
    clientRequestId,
    inputEventId,
    messageId,
    runId,
    startedAt,
  }

  await appendLocalForgeTimelineEvents([
    {
      createdAt,
      eventId: inputEventId,
      projectId: LOCAL_FORGE_PROJECT_ID,
      producer: createLocalForgeProducer({
        index: existing.length,
        kind: 'ui',
        producerId: 'forge-ui',
      }),
      schemaVersion: 1,
      sessionId: getActiveLocalForgeSessionId(),
      type: 'session.input.received',
      payload: {
        clientRequestId,
        messageId,
        text: prompt,
      },
    },
    {
      createdAt,
      eventId: `local-run-queued-${crypto.randomUUID()}`,
      projectId: LOCAL_FORGE_PROJECT_ID,
      producer: createLocalForgeProducer({
        index: existing.length + 1,
        kind: 'system',
        producerId: 'local-runtime',
      }),
      runId,
      schemaVersion: 1,
      sessionId: getActiveLocalForgeSessionId(),
      type: 'run.queued',
      payload: {
        inputEventId,
        runId,
      },
    },
    {
      createdAt,
      eventId: `local-run-started-${crypto.randomUUID()}`,
      projectId: LOCAL_FORGE_PROJECT_ID,
      producer: createLocalForgeProducer({
        index: existing.length + 2,
        kind: 'system',
        producerId: 'local-runtime',
      }),
      runId,
      schemaVersion: 1,
      sessionId: getActiveLocalForgeSessionId(),
      type: 'run.started',
      payload: {
        inputEventId,
        runId,
      },
    },
  ])

  return runContext
}

export async function appendAgentEvent({
  detail,
  message,
  name,
  path,
  runContext,
  status,
  toolCallId,
}: {
  detail?: string
  message?: string
  name: string
  path?: string
  runContext: ForgeRunContext
  status?: BuilderRunStatus
  toolCallId?: string
}) {
  const existing = await readLocalForgeTimeline()
  const createdAt = new Date().toISOString()
  const event: LocalBuilderTimelineEvent = {
    createdAt,
    eventId: `local-agent-event-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'agent',
      producerId: 'local-agent',
    }),
    runId: runContext.runId,
    schemaVersion: 1,
    sessionId: getActiveLocalForgeSessionId(),
    type: 'agent.event.recorded',
    payload: {
      detail,
      elapsedMs: Date.now() - runContext.startedAt,
      id: `local-agent-row-${crypto.randomUUID()}`,
      message,
      name,
      path,
      runId: runContext.runId,
      status: normalizeLocalForgeEventStatus({ name, status }),
      toolCallId,
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

export async function appendAssistantMessage({
  runContext,
  text,
}: {
  runContext: ForgeRunContext
  text: string
}) {
  await appendAssistantMessageStarted({
    messageId: runContext.assistantMessageId,
    runContext,
  })
  await appendAssistantMessageDelta({
    delta: text,
    messageId: runContext.assistantMessageId,
    runContext,
  })
  await appendAssistantMessageCompleted({
    messageId: runContext.assistantMessageId,
    runContext,
    text,
  })
}

async function appendAssistantMessageStarted({
  messageId,
  runContext,
}: {
  messageId: string
  runContext: ForgeRunContext
}) {
  const existing = await readLocalForgeTimeline()
  const event: LocalBuilderTimelineEvent = {
    createdAt: new Date().toISOString(),
    eventId: `local-assistant-message-started-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'agent',
      producerId: 'local-agent',
    }),
    runId: runContext.runId,
    schemaVersion: 1,
    sessionId: getActiveLocalForgeSessionId(),
    type: 'assistant.message.started',
    payload: {
      messageId,
      runId: runContext.runId,
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

async function appendAssistantMessageDelta({
  delta,
  messageId,
  runContext,
}: {
  delta: string
  messageId: string
  runContext: ForgeRunContext
}) {
  if (!delta) {
    return
  }

  const existing = await readLocalForgeTimeline()
  const event: LocalBuilderTimelineEvent = {
    createdAt: new Date().toISOString(),
    eventId: `local-assistant-message-delta-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'agent',
      producerId: 'local-agent',
    }),
    runId: runContext.runId,
    schemaVersion: 1,
    sessionId: getActiveLocalForgeSessionId(),
    type: 'assistant.message.delta',
    payload: {
      delta,
      messageId,
      runId: runContext.runId,
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

async function appendAssistantMessageCompleted({
  messageId,
  runContext,
  text,
}: {
  messageId: string
  runContext: ForgeRunContext
  text: string
}) {
  const existing = await readLocalForgeTimeline()
  const event: LocalBuilderTimelineEvent = {
    createdAt: new Date().toISOString(),
    eventId: `local-assistant-message-completed-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'agent',
      producerId: 'local-agent',
    }),
    runId: runContext.runId,
    schemaVersion: 1,
    sessionId: getActiveLocalForgeSessionId(),
    type: 'assistant.message.completed',
    payload: {
      messageId,
      runId: runContext.runId,
      text,
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

async function appendRunFinished({
  error,
  runContext,
  status,
}: {
  error?: string
  runContext: ForgeRunContext
  status: Extract<BuilderRunStatus, 'finished' | 'failed' | 'cancelled'>
}) {
  const existing = await readLocalForgeTimeline()
  const event: LocalBuilderTimelineEvent = {
    createdAt: new Date().toISOString(),
    eventId: `local-run-terminal-${crypto.randomUUID()}`,
    projectId: LOCAL_FORGE_PROJECT_ID,
    producer: createLocalForgeProducer({
      index: existing.length,
      kind: 'system',
      producerId: 'local-runtime',
    }),
    runId: runContext.runId,
    schemaVersion: 1,
    sessionId: getActiveLocalForgeSessionId(),
    type: status === 'failed' ? 'run.failed' : 'run.finished',
    payload: {
      error,
      runId: runContext.runId,
      status,
    },
  }

  await appendLocalForgeTimelineEvents([event])
}

async function failRun({
  error,
  runContext,
}: {
  error: string
  runContext: ForgeRunContext
}) {
  await appendAgentEvent({
    detail: error,
    message: 'Run failed',
    name: 'run.failed',
    runContext,
    status: 'failed',
  })
  await appendRunFinished({
    error,
    runContext,
    status: 'failed',
  })
}

async function createManifestBundle({
  createdAt,
  files,
  fileSources,
  parentManifestVersionId,
  runId,
  seedCompile,
}: {
  createdAt: string
  files: Record<string, string>
  fileSources: Record<string, BuilderFileSource>
  parentManifestVersionId: string | undefined
  runId: string | undefined
  seedCompile: CompileResponse
}) {
  const compile = mergeCompileWithFiles(seedCompile, files)

  return createLocalBuilderManifestBundleFromFiles({
    compile,
    createdAt,
    createdByRunId: runId,
    definition: localForgeDefinition,
    fileSource: 'builder-definition',
    fileSources,
    files,
    parentManifestVersionId,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: getActiveLocalForgeSessionId(),
  })
}

export function createLocalForgeWorkspaceFromSnapshot(
  snapshot: LocalForgeSnapshot,
) {
  return new Map(
    Object.entries(snapshot.files).map(([filePath, contents]) => [
      filePath,
      {
        contents,
        path: filePath,
        source:
          snapshot.currentManifest?.files[filePath]?.source ??
          'builder-definition',
      } satisfies ForgeWorkspaceFile,
    ]),
  )
}

function workspaceToFiles(workspace: Map<string, ForgeWorkspaceFile>) {
  return Object.fromEntries(
    Array.from(workspace.values())
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((file) => [file.path, file.contents]),
  )
}

export function deleteLocalForgeWorkspaceFile({
  path,
  workspace,
}: {
  path: string
  workspace: {
    delete: (path: string) => boolean
  }
}): LocalForgeWorkspaceDeleteResult {
  const problem = validateDeletedPath(path)

  if (problem) {
    return {
      found: false,
      ok: false,
      path,
      problems: [problem],
    }
  }

  return {
    found: workspace.delete(path),
    ok: true,
    path,
    problems: [],
  }
}

function validateDeletedPath(filePath: string) {
  if (LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS.has(filePath)) {
    return `${filePath} is required workspace scaffolding and cannot be deleted by Forge`
  }

  return validateGeneratedPath(filePath)
}

function mergeCompileWithFiles(
  compile: CompileResponse,
  files: Record<string, string>,
): CompileResponse {
  return {
    ...compile,
    files,
    packages: readPackagesFromFiles(files, compile.packages),
  }
}

function addLocalForgePackageSupport(files: Record<string, string>) {
  const packageJson = files['package.json']

  if (!packageJson) {
    return files
  }

  try {
    const parsed = JSON.parse(packageJson)

    if (!isRecord(parsed)) {
      return files
    }

    const dependencies = readStringRecord(parsed.dependencies, {})
    const devDependencies = {
      ...readStringRecord(parsed.devDependencies, {}),
      '@tanstack/router-generator': 'latest',
    }
    const scripts = readStringRecord(parsed.scripts, {})
    const nextPackageJson = {
      ...omitPackageManagerRuntimeConfig(parsed),
      dependencies,
      devDependencies,
      scripts,
    }

    return {
      ...files,
      'package.json': `${JSON.stringify(nextPackageJson, null, 2)}\n`,
    }
  } catch {
    return files
  }
}

function omitPackageManagerRuntimeConfig(packageJson: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(packageJson).filter(([key]) => key !== 'pnpm'),
  )
}

function readPackagesFromFiles(
  files: Record<string, string>,
  fallback: CompileResponse['packages'],
): CompileResponse['packages'] {
  const packageJson = files['package.json']

  if (!packageJson) {
    return fallback
  }

  try {
    const parsed = JSON.parse(packageJson)

    if (!isRecord(parsed)) {
      return fallback
    }

    return {
      dependencies: readStringRecord(
        parsed.dependencies,
        fallback.dependencies,
      ),
      devDependencies: readStringRecord(
        parsed.devDependencies,
        fallback.devDependencies,
      ),
      scripts: readStringRecord(parsed.scripts, fallback.scripts),
    }
  } catch {
    return fallback
  }
}

async function validateWorkspace({
  includeWorkspaceCommands = false,
  prompt,
  workspace,
}: {
  includeWorkspaceCommands?: boolean
  prompt: string
  workspace: Map<string, ForgeWorkspaceFile>
}) {
  const problems = Array<string>()
  const indexRoute = workspace.get('src/routes/index.tsx')

  if (!indexRoute?.contents.trim()) {
    problems.push('src/routes/index.tsx is required')
  }

  if (
    workspace.has('src/router.tsx') &&
    !workspace.has('src/routes/__root.tsx')
  ) {
    problems.push(
      'src/routes/__root.tsx is required for TanStack Router route tree generation',
    )
  }

  if (
    indexRoute &&
    !indexRoute.contents.includes("createFileRoute('/')") &&
    !indexRoute.contents.includes('createFileRoute("/")')
  ) {
    problems.push("src/routes/index.tsx must export createFileRoute('/')")
  }

  for (const file of workspace.values()) {
    if (file.source !== 'agent') {
      continue
    }

    const pathProblem = validateGeneratedPath(file.path)
    if (pathProblem) {
      problems.push(pathProblem)
    }

    const syntaxProblem = await validateSourceSyntax(file)
    if (syntaxProblem) {
      problems.push(syntaxProblem)
    }

    problems.push(...validateSourceConventions(file))
    problems.push(...validateReactStateConventions(file))
    problems.push(...validateRelativeImports({ file, workspace }))
  }

  if (indexRoute && isTodoPrompt(prompt)) {
    const lowerContent = Array.from(workspace.values())
      .filter((file) => isJavaScriptModulePath(file.path))
      .map((file) => file.contents)
      .join('\n')
      .toLowerCase()
    const todoRequirements = [
      ['add', 'todo prompt requires adding todos'],
      ['toggle', 'todo prompt requires toggling todos'],
      ['delete', 'todo prompt requires deleting todos'],
      ['active', 'todo prompt requires an active filter/count'],
      ['completed', 'todo prompt requires completed state/filter'],
      ['all', 'todo prompt requires an all filter'],
    ] as const

    for (const [needle, problem] of todoRequirements) {
      if (!lowerContent.includes(needle)) {
        problems.push(problem)
      }
    }
  }

  if (includeWorkspaceCommands && problems.length === 0) {
    // Workspace commands are diagnostics. Source safety and syntax problems are
    // the manifest gate; TypeScript/build failures should still persist.
    await validateWorkspaceCommands(workspace)
  }

  return problems
}

async function validateWorkspaceCommands(
  workspace: Map<string, ForgeWorkspaceFile>,
) {
  const workspaceDir = await mkdtemp(
    path.join(os.tmpdir(), 'tanstack-forge-validate-'),
  )

  try {
    const files = addLocalForgePackageSupport(workspaceToFiles(workspace))

    await writeValidationWorkspaceFiles({
      files,
      workspaceDir,
    })

    const commands: Array<{ args: Array<string>; command: string }> = [
      {
        args: ['install'],
        command: 'pnpm',
      },
    ]

    if (shouldGenerateTanStackRouteTreeForFiles(files)) {
      commands.push({
        args: [
          'exec',
          'node',
          '--input-type=module',
          '-e',
          ROUTE_TREE_GENERATOR_SCRIPT,
        ],
        command: 'pnpm',
      })
    }

    commands.push({
      args: ['exec', 'tsc', '--noEmit'],
      command: 'pnpm',
    })

    for (const command of commands) {
      const result = await runValidationCommand({
        ...command,
        cwd: workspaceDir,
      })

      if (result.exitCode !== 0) {
        return [
          `${result.commandLine} failed: ${summarizeValidationCommandResult(
            result,
          )}`,
        ]
      }
    }

    return []
  } catch (error) {
    return [readError(error)]
  } finally {
    await rm(workspaceDir, {
      force: true,
      recursive: true,
    })
  }
}

async function writeValidationWorkspaceFiles({
  files,
  workspaceDir,
}: {
  files: Record<string, string>
  workspaceDir: string
}) {
  for (const [filePath, contents] of Object.entries(files)) {
    const outputPath = path.join(
      workspaceDir,
      toSafeValidationWorkspacePath(filePath),
    )

    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, contents, 'utf8')
  }

  await writeFile(
    path.join(workspaceDir, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - .',
      'onlyBuiltDependencies:',
      '  - esbuild',
      '  - lightningcss',
      '',
    ].join('\n'),
    'utf8',
  )
}

function shouldGenerateTanStackRouteTreeForFiles(
  files: Record<string, string>,
) {
  return Boolean(files['src/router.tsx'] && files['src/routes/__root.tsx'])
}

function runValidationCommand({
  args,
  command,
  cwd,
}: {
  args: Array<string>
  command: string
  cwd: string
}): Promise<ForgeValidationCommandResult> {
  const commandLine = [command, ...args].join(' ')

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(
        new Error(
          `${commandLine} timed out after ${LOCAL_FORGE_VALIDATION_TIMEOUT_MS}ms.`,
        ),
      )
    }, LOCAL_FORGE_VALIDATION_TIMEOUT_MS)

    function handleStdoutData(chunk: Buffer) {
      stdout = appendLimitedText(
        stdout,
        chunk.toString('utf8'),
        LOCAL_FORGE_VALIDATION_MAX_OUTPUT_CHARS,
      )
    }

    function handleStderrData(chunk: Buffer) {
      stderr = appendLimitedText(
        stderr,
        chunk.toString('utf8'),
        LOCAL_FORGE_VALIDATION_MAX_OUTPUT_CHARS,
      )
    }

    function cleanup() {
      clearTimeout(timeout)
      child.stdout.off('data', handleStdoutData)
      child.stderr.off('data', handleStderrData)
    }

    function finish(error: Error | null, exitCode: number | null = null) {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (error) {
        reject(error)
        return
      }

      resolve({
        commandLine,
        exitCode,
        stderr,
        stdout,
      })
    }

    child.stdout.on('data', handleStdoutData)
    child.stderr.on('data', handleStderrData)
    child.once('error', finish)
    child.once('close', finish.bind(null, null))
  })
}

function summarizeValidationCommandResult(
  result: ForgeValidationCommandResult,
) {
  const output = [result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .trim()
  const summary = output || `exit ${result.exitCode}`

  return limitText(summary, 2000)
}

function toSafeValidationWorkspacePath(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${filePath} is not a safe validation workspace path.`)
  }

  return filePath
}

async function validateSourceSyntax(file: ForgeWorkspaceFile) {
  if (!isJavaScriptModulePath(file.path)) {
    return null
  }

  try {
    await transform(file.contents, {
      format: 'esm',
      loader: file.path.endsWith('x') ? 'tsx' : 'ts',
      sourcemap: false,
    })
    return null
  } catch (error) {
    return `${file.path} does not parse: ${readError(error)}`
  }
}

function validateSourceConventions(file: ForgeWorkspaceFile) {
  const problems = Array<string>()

  if (
    file.path.endsWith('.tsx') &&
    importsDefaultReact(file.contents) &&
    !usesReactBinding(file.contents)
  ) {
    problems.push(
      `${file.path} imports default React without using it; JSX does not need a React value import`,
    )
  }

  return problems
}

function validateReactStateConventions(file: ForgeWorkspaceFile) {
  const problems = Array<string>()

  if (
    file.path.endsWith('.tsx') &&
    /\b(?:React\.)?useState\s*\(\s*\[\s*\]\s*\)/.test(file.contents)
  ) {
    problems.push(
      `${file.path} uses useState([]); define the item type and call useState<Item[]>([])`,
    )
  }

  return problems
}

function importsDefaultReact(contents: string) {
  return /import\s+React(?:\s*,|\s+from\s+['"]react['"])/.test(contents)
}

function usesReactBinding(contents: string) {
  const withoutReactImports = contents
    .split('\n')
    .filter(
      (line) =>
        !/^\s*import\s+React(?:\s*,|\s+from\s+['"]react['"])/.test(line),
    )
    .join('\n')

  return /\bReact[.<]/.test(withoutReactImports)
}

function validateRelativeImports({
  file,
  workspace,
}: {
  file: ForgeWorkspaceFile
  workspace: Map<string, ForgeWorkspaceFile>
}) {
  if (!isJavaScriptModulePath(file.path)) {
    return []
  }

  const problems = Array<string>()
  const importPattern =
    /(?:import\s+(?:type\s+)?[^'"]*from\s+|import\s*)['"]([^'"]+)['"]/g
  let match = importPattern.exec(file.contents)

  while (match) {
    const importPath = match[1]

    if (importPath?.startsWith('.')) {
      const resolved = resolveWorkspaceImportPath({
        fromPath: file.path,
        importPath,
        workspace,
      })

      if (!resolved) {
        problems.push(`${file.path} imports missing file ${importPath}`)
      }
    }

    match = importPattern.exec(file.contents)
  }

  return problems
}

function resolveWorkspaceImportPath({
  fromPath,
  importPath,
  workspace,
}: {
  fromPath: string
  importPath: string
  workspace: Map<string, ForgeWorkspaceFile>
}) {
  const baseParts = fromPath.split('/').slice(0, -1)
  const importParts = importPath.split('/')
  const resolvedParts = Array<string>()

  for (const part of [...baseParts, ...importParts]) {
    if (!part || part === '.') {
      continue
    }

    if (part === '..') {
      resolvedParts.pop()
      continue
    }

    resolvedParts.push(part)
  }

  const basePath = resolvedParts.join('/')
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ]

  return candidates.find((candidate) => workspace.has(candidate))
}

function isJavaScriptModulePath(filePath: string) {
  return (
    filePath.endsWith('.ts') ||
    filePath.endsWith('.tsx') ||
    filePath.endsWith('.js') ||
    filePath.endsWith('.jsx')
  )
}

function isTodoPrompt(prompt: string) {
  return /\b(todo|to-do|task list|tasks)\b/i.test(prompt)
}

export function getLocalForgeAgentCompletionProblems(
  state: LocalForgeAgentCompletionState,
) {
  const problems = Array<string>()

  if (!state.planReceived) {
    problems.push('agent did not call planRun')
  }

  if (state.changeCount === 0) {
    problems.push('agent did not change any files')
  }

  if (!state.validated) {
    problems.push('agent did not call validateFiles')
  }

  if (
    state.validated &&
    state.validatedChangeCount !== undefined &&
    state.validatedChangeCount !== state.changeCount
  ) {
    problems.push('agent changed files after validateFiles')
  }

  if (state.validated && !state.validatedWithWorkspaceCommands) {
    problems.push('agent did not run workspace command validation')
  }

  if (!state.summaryReceived) {
    problems.push('agent did not call setSummary')
  }

  if (state.validationProblems.length > 0) {
    problems.push(...state.validationProblems)
  }

  return problems
}

function assertCompletedRun(state: ForgeAgentState) {
  const problems = getLocalForgeAgentCompletionProblems(state)

  if (problems.length > 0) {
    throw new Error(`Forge agent run incomplete: ${problems.join('; ')}`)
  }
}

function validateGeneratedPath(filePath: string) {
  const safetyProblem = validateWorkspaceFilePathSafety(filePath)

  if (safetyProblem) {
    return safetyProblem
  }

  if (isEditableRootWorkspacePath(filePath)) {
    return null
  }

  if (isPackageManagerLockfile(filePath)) {
    return `${filePath} is package manager state and must not be edited by Forge`
  }

  if (
    !LOCAL_FORGE_APP_SOURCE_PREFIXES.some((prefix) =>
      filePath.startsWith(prefix),
    )
  ) {
    return `${filePath} must be under src/ or public/`
  }

  if (filePath.split('/').some((part) => part.startsWith('.'))) {
    return `${filePath} must not contain hidden path segments`
  }

  if (filePath.endsWith('.gen.ts') || filePath.endsWith('.gen.tsx')) {
    return `${filePath} must not be generated by Forge`
  }

  return null
}

function isEditableRootWorkspacePath(filePath: string) {
  return (
    !filePath.includes('/') &&
    (LOCAL_FORGE_EDITABLE_ROOT_FILE_PATHS.has(filePath) ||
      filePath.endsWith('.md'))
  )
}

function isPackageManagerLockfile(filePath: string) {
  return (
    filePath === 'bun.lock' ||
    filePath === 'bun.lockb' ||
    filePath === 'package-lock.json' ||
    filePath === 'pnpm-lock.yaml' ||
    filePath === 'yarn.lock'
  )
}

function validateWorkspaceFilePathSafety(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    return `${filePath} is not a safe path`
  }

  return null
}

function buildForgeAgentsFile(prompt: string) {
  return [
    '# AGENTS.md',
    '',
    `Generated by: TanStack Forge (${LOCAL_FORGE_CONTEXT_VERSION})`,
    '',
    '## Original Brief',
    '',
    prompt,
    '',
    '## TanStack Context',
    '',
    ...TANSTACK_CONTEXT.map((line) => `- ${line}`),
    '',
    '## Rules',
    '',
    '- Build TanStack Start apps with TanStack Router file routes.',
    '- Keep generated files small, specific, typed, and deployable.',
    '- Read package skills from node_modules when available before guessing APIs.',
    '',
  ].join('\n')
}

function buildForgeContextFile(prompt: string) {
  return [
    'export const forgeContext = {',
    `  contextVersion: ${JSON.stringify(LOCAL_FORGE_CONTEXT_VERSION)},`,
    `  originalPrompt: ${JSON.stringify(prompt)},`,
    `  tanStackContext: ${JSON.stringify(TANSTACK_CONTEXT)},`,
    '}',
    '',
  ].join('\n')
}

function readStringRecord(
  value: unknown,
  fallback: Record<string, string>,
): Record<string, string> {
  if (!isRecord(value)) {
    return fallback
  }

  const result: Record<string, string> = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') {
      result[key] = item
    }
  }

  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : 'Forge agent failed'
}

function uniqueStrings(values: Array<string>) {
  return Array.from(new Set(values.filter(Boolean)))
}

function limitText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function appendLimitedText(current: string, next: string, maxLength: number) {
  const combined = `${current}${next}`

  if (combined.length <= maxLength) {
    return combined
  }

  return combined.slice(combined.length - maxLength)
}
