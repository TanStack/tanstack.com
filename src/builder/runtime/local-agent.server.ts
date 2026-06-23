import { spawn } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  chat,
  maxIterations,
  toolDefinition,
  type JSONSchema,
  type ModelMessage,
  type ServerTool,
  type StreamChunk,
} from '@tanstack/ai'
import { anthropicText, createAnthropicChat } from '@tanstack/ai-anthropic'
import { createOpenaiChat, openaiText } from '@tanstack/ai-openai'
import { transform } from 'esbuild'
import { z } from 'zod'
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
import type { ForgeProviderCredential } from './forge-byok.server'
import { isIsolateRuntime } from '~/server/runtime/host.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'

const LOCAL_FORGE_CONTEXT_VERSION = 'forge-local-agent-2026-06-18'
const LOCAL_FORGE_MAX_ITERATIONS = 10
const LOCAL_FORGE_TIMEOUT_MS = 180_000
const LOCAL_FORGE_BASELINE_LOCK_STALE_MS = 10 * 60_000
const LOCAL_FORGE_BASELINE_LOCK_WAIT_MS = 30_000
const LOCAL_FORGE_RUN_LOCK_STALE_MS = 10 * 60_000
const LOCAL_FORGE_RUN_LOCK_WAIT_MS = 100
const LOCAL_FORGE_CODEX_TIMEOUT_MS = readPositiveIntegerEnv(
  'FORGE_CODEX_TIMEOUT_MS',
  1_800_000,
)
const LOCAL_FORGE_CODEX_MAX_EVENTS = 80
const LOCAL_FORGE_CODEX_MAX_OUTPUT_CHARS = 80_000
const LOCAL_FORGE_CLOUDFLARE_AI_MODEL =
  process.env.FORGE_CLOUDFLARE_AI_MODEL?.trim() || '@cf/openai/gpt-oss-120b'
const LOCAL_FORGE_CODEX_APP_CLI =
  '/Applications/Codex.app/Contents/Resources/codex'
const LOCAL_FORGE_CODEX_IGNORED_DIRECTORIES = new Set<string>([
  '.codex',
  '.git',
  '.tanstack',
  'dist',
  'node_modules',
])
const LOCAL_FORGE_CODEX_SCANNER_IGNORED_FILE_PATHS = new Set<string>([
  'pnpm-workspace.yaml',
  'src/routeTree.gen.ts',
])
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
const LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS = new Set([
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

type OpenAiForgeModel = Parameters<typeof openaiText>[0]
type AnthropicForgeModel = Parameters<typeof anthropicText>[0]

const supportedOpenAiForgeModels = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
] as const satisfies Array<OpenAiForgeModel>

const supportedAnthropicForgeModels = [
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-opus-4-5',
] as const satisfies Array<AnthropicForgeModel>

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
  providerCredential?: ForgeProviderCredential
  runContext: ForgeRunContext
}

type ForgeAgentHarnessName =
  | 'cloudflare-workers-ai'
  | 'codex-cli'
  | 'tanstack-ai'

type ForgeAgentHarnessRunInput = {
  initialSnapshot: LocalForgeSnapshot
  prompt: string
  providerCredential?: ForgeProviderCredential
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

type CodexCliCommandResult = {
  exitCode: number | null
  finalMessage: string
  stderr: string
  workspaceDir: string
}

type CodexCliWorkspaceScan = {
  changeCount: number
  changedPaths: Array<string>
  problems: Array<string>
  workspace: Map<string, ForgeWorkspaceFile>
}

type NormalizedCodexCliEvent = {
  assistantDelta?: string
  detail?: string
  message: string
  name: string
  path?: string
  status?: BuilderRunStatus
  toolCallId?: string
}

type CloudflareAiBinding = {
  run: (
    model: string,
    input: CloudflareAiTextGenerationInput,
  ) => Promise<unknown>
}

type CloudflareAiMessage = {
  content: string
  role: 'assistant' | 'system' | 'tool' | 'user'
}

type CloudflareAiToolDefinition = {
  description: string
  name: string
  parameters: JSONSchema
}

type CloudflareAiTextGenerationInput = {
  messages: Array<CloudflareAiMessage>
  tools: Array<CloudflareAiToolDefinition>
}

type CloudflareAiToolCall = {
  arguments: unknown
  id?: string
  name: string
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
  providerCredential,
}: {
  clientRequestId?: string
  prompt: string
  providerCredential?: ForgeProviderCredential
}): Promise<LocalForgeSnapshot> {
  try {
    return await withLocalForgeLock({
      name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
      staleMs: LOCAL_FORGE_RUN_LOCK_STALE_MS,
      task: async () =>
        (await readExistingClientRequestSnapshot(clientRequestId)) ??
        runLocalForgeAgentLocked({
          clientRequestId,
          prompt,
          providerCredential,
        }),
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
  providerCredential,
}: {
  clientRequestId: string
  prompt: string
  providerCredential?: ForgeProviderCredential
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
      providerCredential,
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
  providerCredential,
}: {
  clientRequestId: string
  prompt: string
  providerCredential?: ForgeProviderCredential
}): Promise<LocalForgeSnapshot> {
  await drainLocalForgeAgentRun(
    await prepareLocalForgeAgentRun({
      clientRequestId,
      prompt,
      providerCredential,
    }),
  )

  return readLocalForgeSnapshot()
}

async function prepareLocalForgeAgentRun({
  clientRequestId,
  prompt,
  providerCredential,
}: {
  clientRequestId: string
  prompt: string
  providerCredential?: ForgeProviderCredential
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
    providerCredential,
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
  providerCredential,
  runContext,
}: PreparedForgeAgentRun) {
  const harness = getLocalForgeHarness(providerCredential)
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
      providerCredential,
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
    const materialized = isIsolateRuntime()
      ? {
          manifest: bundle.manifest,
        }
      : await materializeLocalForgeManifest({
          commitSystemSnapshotTimeline: false,
          manifest: bundle.manifest,
          runId: runContext.runId,
        })

    if (isIsolateRuntime()) {
      await appendAgentEvent({
        detail:
          'Cloudflare isolate runtime cannot run local filesystem/process validation.',
        message: 'Workspace materialization skipped',
        name: 'agent.runtime.materialize.skipped',
        runContext,
        status: 'finished',
      })
    }

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

function getLocalForgeHarness(
  providerCredential?: ForgeProviderCredential,
): ForgeAgentHarness | null {
  const harnessName = getRequestedLocalForgeHarnessName()

  if (harnessName === 'codex-cli') {
    return {
      label: 'Codex CLI',
      name: 'codex-cli',
      run: runCodexCliForgeHarness,
    }
  }

  if (harnessName === 'cloudflare-workers-ai') {
    return {
      label: 'Cloudflare Workers AI',
      name: 'cloudflare-workers-ai',
      run: runCloudflareWorkersAiForgeHarness,
    }
  }

  const adapter = getLocalForgeAdapter(providerCredential)

  if (!adapter) {
    return null
  }

  return {
    label: 'TanStack AI',
    name: 'tanstack-ai',
    run: (input) =>
      runTanStackAiForgeHarness({
        ...input,
        adapter,
      }),
  }
}

function getRequestedLocalForgeHarnessName(): ForgeAgentHarnessName {
  return resolveLocalForgeAgentHarnessName(process.env.FORGE_AGENT_HARNESS)
}

export function resolveLocalForgeAgentHarnessName(
  requestedHarness: string | undefined,
): ForgeAgentHarnessName {
  const normalizedHarness = requestedHarness?.trim().toLowerCase()

  if (
    normalizedHarness === 'codex' ||
    normalizedHarness === 'codex-cli' ||
    normalizedHarness === 'local-codex'
  ) {
    return 'codex-cli'
  }

  if (
    normalizedHarness === 'cloudflare-workers-ai' ||
    normalizedHarness === 'cloudflare-ai' ||
    normalizedHarness === 'workers-ai'
  ) {
    return 'cloudflare-workers-ai'
  }

  return 'tanstack-ai'
}

function getLocalForgeHarnessUnavailableMessage() {
  const harnessName = getRequestedLocalForgeHarnessName()

  if (harnessName === 'codex-cli') {
    return 'Forge needs Codex CLI available locally to use FORGE_AGENT_HARNESS=codex-cli.'
  }

  if (harnessName === 'cloudflare-workers-ai') {
    return 'Forge needs a Cloudflare Workers AI binding to use FORGE_AGENT_HARNESS=cloudflare-workers-ai.'
  }

  return 'Forge needs OPENAI_API_KEY or ANTHROPIC_API_KEY to run the TanStack AI harness.'
}

async function runTanStackAiForgeHarness({
  adapter,
  initialSnapshot,
  prompt,
  runContext,
  state,
  toolEvents,
  workspace,
}: ForgeAgentHarnessRunInput & {
  adapter: NonNullable<ReturnType<typeof getLocalForgeAdapter>>
}) {
  await appendAgentEvent({
    message: 'TanStack AI model loop started',
    name: 'agent.model.started',
    runContext,
    status: 'running',
  })

  await runAbortableForgeTask({
    label: 'Forge TanStack AI agent run',
    task: async (abortController) => {
      const messageTextById = new Map<string, string>()
      const startedMessageIds = new Set<string>()
      const completedMessageIds = new Set<string>()
      const toolArgsById = new Map<string, string>()
      const toolNamesById = new Map<string, string>()
      const stream = chat({
        abortController,
        adapter,
        agentLoopStrategy: maxIterations(LOCAL_FORGE_MAX_ITERATIONS),
        messages: [
          {
            role: 'user',
            content: buildForgeAgentPrompt({
              currentFiles: Object.keys(initialSnapshot.files).sort(),
              prompt,
            }),
          },
        ] satisfies Array<ModelMessage>,
        stream: true,
        systemPrompts: [
          'You are the TanStack Forge local workspace agent. Use the provided tools to inspect and edit the actual workspace. Do not answer with code instead of writing files.',
        ],
        tools: createForgeTools({
          prompt,
          runContext,
          state,
          toolEvents,
          workspace,
        }),
      })

      for await (const chunk of stream) {
        await appendTanStackAiStreamChunk({
          chunk,
          completedMessageIds,
          messageTextById,
          runContext,
          startedMessageIds,
          state,
          toolArgsById,
          toolNamesById,
        })
      }
    },
    timeoutMs: LOCAL_FORGE_TIMEOUT_MS,
  })

  await appendAgentEvent({
    message: 'TanStack AI model loop finished',
    name: 'agent.model.finished',
    runContext,
    status: 'finished',
  })
}

async function runCloudflareWorkersAiForgeHarness({
  initialSnapshot,
  prompt,
  runContext,
  state,
  toolEvents,
  workspace,
}: ForgeAgentHarnessRunInput) {
  const ai = await getCloudflareAiBinding()

  if (!ai) {
    throw new Error(
      'Cloudflare Workers AI binding is not available to the Forge runtime.',
    )
  }

  await appendAgentEvent({
    detail: LOCAL_FORGE_CLOUDFLARE_AI_MODEL,
    message: 'Cloudflare Workers AI model loop started',
    name: 'agent.cloudflare-ai.started',
    runContext,
    status: 'running',
  })

  await runAbortableForgeTask({
    label: 'Forge Cloudflare Workers AI agent run',
    task: async () => {
      const tools = createForgeTools({
        prompt,
        runContext,
        state,
        toolEvents,
        workspace,
      })
      const cloudflareTools = tools.map(createCloudflareAiToolDefinition)
      const toolByName = new Map<string, ServerTool>()
      for (const tool of tools) {
        toolByName.set(tool.name, tool)
      }
      const messages: Array<CloudflareAiMessage> = [
        {
          role: 'user',
          content: [
            'You are the TanStack Forge Cloudflare Workers AI harness.',
            'Use the provided tools to inspect and edit the workspace.',
            'Do not answer with code instead of writing files.',
            buildForgeAgentPrompt({
              currentFiles: Object.keys(initialSnapshot.files).sort(),
              prompt,
            }),
          ].join('\n\n'),
        },
      ]

      for (let step = 0; step < LOCAL_FORGE_MAX_ITERATIONS; step++) {
        const response = await ai.run(LOCAL_FORGE_CLOUDFLARE_AI_MODEL, {
          messages,
          tools: cloudflareTools,
        })
        const text = readCloudflareAiText(response)
        const toolCalls = readCloudflareAiToolCalls(response)

        if (text) {
          messages.push({
            role: 'assistant',
            content: text,
          })
        }

        if (toolCalls.length === 0) {
          if (text) {
            await appendAssistantMessage({
              runContext,
              text,
            })
            state.streamedAssistantMessage = true
          }
          return
        }

        messages.push({
          role: 'assistant',
          content: JSON.stringify({ tool_calls: toolCalls }),
        })

        for (const toolCall of toolCalls) {
          const tool = toolByName.get(toolCall.name)
          const toolCallId =
            toolCall.id ?? `cloudflare-tool-${crypto.randomUUID()}`

          if (!tool) {
            const result = {
              error: `Unknown tool ${toolCall.name}`,
              ok: false,
            }
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
            })
            continue
          }

          if (!tool.execute) {
            const result = {
              error: `Tool ${tool.name} cannot execute on the server.`,
              ok: false,
            }
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
            })
            continue
          }

          const result = await tool.execute(toolCall.arguments, {
            emitCustomEvent: () => {},
            toolCallId,
          })

          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
          })
        }
      }

      throw new Error(
        `Cloudflare Workers AI exceeded ${LOCAL_FORGE_MAX_ITERATIONS} iterations before finishing.`,
      )
    },
    timeoutMs: LOCAL_FORGE_TIMEOUT_MS,
  })

  await appendAgentEvent({
    detail: LOCAL_FORGE_CLOUDFLARE_AI_MODEL,
    message: 'Cloudflare Workers AI model loop finished',
    name: 'agent.cloudflare-ai.finished',
    runContext,
    status: 'finished',
  })
}

async function getCloudflareAiBinding() {
  const hostEnv = await getHostRuntimeEnv()
  const ai = hostEnv?.AI

  return isCloudflareAiBinding(ai) ? ai : undefined
}

function isCloudflareAiBinding(value: unknown): value is CloudflareAiBinding {
  return isRecord(value) && typeof value.run === 'function'
}

function createCloudflareAiToolDefinition(
  tool: ServerTool,
): CloudflareAiToolDefinition {
  return {
    description: tool.description,
    name: tool.name,
    parameters: readCloudflareAiToolParameters(tool.inputSchema),
  }
}

function readCloudflareAiToolParameters(inputSchema: unknown): JSONSchema {
  if (isStandardJsonSchemaInput(inputSchema)) {
    return sanitizeCloudflareAiJsonSchema(
      inputSchema['~standard'].jsonSchema.input({
        target: 'draft-7',
      }),
      'Tool parameters',
    )
  }

  if (isJsonSchema(inputSchema)) {
    return sanitizeCloudflareAiJsonSchema(inputSchema, 'Tool parameters')
  }

  return {
    additionalProperties: false,
    properties: {},
    type: 'object',
  }
}

function isStandardJsonSchemaInput(value: unknown): value is {
  '~standard': {
    jsonSchema: {
      input: (options: { target: 'draft-7' }) => unknown
    }
    version: 1
  }
} {
  if (!isRecord(value)) {
    return false
  }

  const standard = value['~standard']

  if (!isRecord(standard) || standard.version !== 1) {
    return false
  }

  const jsonSchema = standard.jsonSchema

  return isRecord(jsonSchema) && typeof jsonSchema.input === 'function'
}

function isJsonSchema(value: unknown): value is JSONSchema {
  return isRecord(value)
}

function sanitizeCloudflareAiJsonSchema(
  schema: unknown,
  fallbackDescription: string,
): JSONSchema {
  if (!isRecord(schema)) {
    return {
      description: fallbackDescription,
      type: 'string',
    }
  }

  const unionSchemas = Array.isArray(schema.oneOf)
    ? schema.oneOf
    : Array.isArray(schema.anyOf)
      ? schema.anyOf
      : undefined
  const preferredUnionSchema = unionSchemas?.find(
    (item) => isRecord(item) && item.type !== 'null',
  )

  if (!schema.type && preferredUnionSchema) {
    return sanitizeCloudflareAiJsonSchema(
      preferredUnionSchema,
      fallbackDescription,
    )
  }

  const result: JSONSchema = {}

  if (typeof schema.type === 'string') {
    result.type = schema.type
  } else if (
    Array.isArray(schema.type) &&
    schema.type.every((item) => typeof item === 'string')
  ) {
    result.type = schema.type.find((item) => item !== 'null') ?? schema.type[0]
  }

  if (typeof schema.description === 'string') {
    result.description = schema.description
  } else {
    result.description = fallbackDescription
  }

  if (Array.isArray(schema.required)) {
    result.required = schema.required.filter(
      (item): item is string => typeof item === 'string',
    )
  }

  if (isRecord(schema.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        sanitizeCloudflareAiJsonSchema(value, `${key} parameter`),
      ]),
    )
  }

  if (isRecord(schema.items)) {
    result.items = sanitizeCloudflareAiJsonSchema(
      schema.items,
      `${fallbackDescription} item`,
    )
  }

  if (Array.isArray(schema.enum)) {
    result.enum = schema.enum
  }

  if (!result.type && result.properties) {
    result.type = 'object'
  } else if (!result.type) {
    result.type = 'string'
  }

  return result
}

function readCloudflareAiText(response: unknown) {
  if (!isRecord(response)) {
    return undefined
  }

  const responseText = response.response
  if (typeof responseText === 'string' && responseText.trim()) {
    return responseText
  }

  const text = response.text
  if (typeof text === 'string' && text.trim()) {
    return text
  }

  return undefined
}

function readCloudflareAiToolCalls(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.tool_calls)) {
    return []
  }

  return response.tool_calls.flatMap(readCloudflareAiToolCall)
}

function readCloudflareAiToolCall(value: unknown): Array<CloudflareAiToolCall> {
  if (!isRecord(value)) {
    return []
  }

  const name = value.name

  if (typeof name !== 'string' || !name) {
    return []
  }

  const id = typeof value.id === 'string' ? value.id : undefined
  const args =
    typeof value.arguments === 'string'
      ? parseJsonObject(value.arguments)
      : value.arguments

  return [
    {
      arguments: isRecord(args) ? args : {},
      id,
      name,
    },
  ]
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

async function appendTanStackAiStreamChunk({
  chunk,
  completedMessageIds,
  messageTextById,
  runContext,
  startedMessageIds,
  state,
  toolArgsById,
  toolNamesById,
}: {
  chunk: StreamChunk
  completedMessageIds: Set<string>
  messageTextById: Map<string, string>
  runContext: ForgeRunContext
  startedMessageIds: Set<string>
  state: ForgeAgentState
  toolArgsById: Map<string, string>
  toolNamesById: Map<string, string>
}) {
  switch (chunk.type) {
    case 'TEXT_MESSAGE_START': {
      if (chunk.role && chunk.role !== 'assistant') {
        return
      }

      await ensureAssistantMessageStarted({
        messageId: chunk.messageId,
        runContext,
        startedMessageIds,
      })
      break
    }

    case 'TEXT_MESSAGE_CONTENT': {
      await ensureAssistantMessageStarted({
        messageId: chunk.messageId,
        runContext,
        startedMessageIds,
      })
      messageTextById.set(
        chunk.messageId,
        `${messageTextById.get(chunk.messageId) ?? ''}${chunk.delta}`,
      )
      state.streamedAssistantMessage =
        state.streamedAssistantMessage || chunk.delta.trim().length > 0
      await appendAssistantMessageDelta({
        delta: chunk.delta,
        messageId: chunk.messageId,
        runContext,
      })
      break
    }

    case 'TEXT_MESSAGE_END': {
      if (completedMessageIds.has(chunk.messageId)) {
        return
      }

      completedMessageIds.add(chunk.messageId)
      await appendAssistantMessageCompleted({
        messageId: chunk.messageId,
        runContext,
        text: messageTextById.get(chunk.messageId) ?? '',
      })
      break
    }

    case 'TOOL_CALL_START': {
      toolNamesById.set(chunk.toolCallId, chunk.toolCallName)
      await appendAgentEvent({
        detail: 'Tool call started',
        message: `Started ${chunk.toolCallName}`,
        name: `agent.tool.${chunk.toolCallName}`,
        runContext,
        status: 'running',
        toolCallId: chunk.toolCallId,
      })
      break
    }

    case 'TOOL_CALL_ARGS': {
      toolArgsById.set(
        chunk.toolCallId,
        `${toolArgsById.get(chunk.toolCallId) ?? ''}${chunk.delta}`,
      )
      break
    }

    case 'TOOL_CALL_END': {
      const toolName =
        chunk.toolCallName ??
        chunk.toolName ??
        toolNamesById.get(chunk.toolCallId) ??
        'tool'
      const args = toolArgsById.get(chunk.toolCallId)

      if (!args) {
        return
      }

      await appendAgentEvent({
        detail: limitText(args, 1200),
        message: `${toolName} arguments ready`,
        name: `agent.tool.${toolName}`,
        runContext,
        status: 'running',
        toolCallId: chunk.toolCallId,
      })
      break
    }

    case 'RUN_ERROR':
      await appendAgentEvent({
        detail: chunk.message,
        message: 'Model stream failed',
        name: 'agent.model.error',
        runContext,
        status: 'failed',
      })
      break

    default:
      break
  }
}

async function ensureAssistantMessageStarted({
  messageId,
  runContext,
  startedMessageIds,
}: {
  messageId: string
  runContext: ForgeRunContext
  startedMessageIds: Set<string>
}) {
  if (startedMessageIds.has(messageId)) {
    return
  }

  startedMessageIds.add(messageId)
  await appendAssistantMessageStarted({
    messageId,
    runContext,
  })
}

async function runCodexCliForgeHarness({
  prompt,
  runContext,
  state,
  workspace,
}: ForgeAgentHarnessRunInput) {
  assertCodexCliHarnessAllowed()

  state.planReceived = true
  state.title = titleFromPrompt(prompt)

  const workspaceDir = getCodexCliWorkspaceDir(runContext.runId)
  const outputLastMessagePath = getCodexCliOutputMessagePath(runContext.runId)

  await prepareCodexCliWorkspace({
    workspace,
    workspaceDir,
  })

  await appendAgentEvent({
    detail: workspaceDir,
    message: 'Codex CLI workspace prepared',
    name: 'agent.codex.workspace.prepared',
    path: workspaceDir,
    runContext,
    status: 'finished',
  })
  await appendAgentEvent({
    detail:
      'Codex CLI will edit the materialized workspace; Forge will scan supported files back into the manifest.',
    message: state.title,
    name: 'agent.codex.plan',
    runContext,
    status: 'finished',
  })

  const result = await runCodexCliCommand({
    outputLastMessagePath,
    prompt: buildCodexCliHarnessPrompt({
      currentFiles: Array.from(workspace.keys()).sort(),
      prompt,
    }),
    runContext,
    state,
    workspaceDir,
  })

  if (result.exitCode !== 0) {
    throw new Error(
      `Codex CLI exited with ${result.exitCode ?? 'no exit code'}: ${
        result.stderr || 'no stderr'
      }`,
    )
  }

  const scan = await scanCodexCliWorkspace({
    originalWorkspace: workspace,
    workspaceDir,
  })

  workspace.clear()

  for (const [filePath, file] of scan.workspace) {
    workspace.set(filePath, file)
  }

  const summary = parseCodexCliSummary({
    fallbackTitle: state.title,
    finalMessage: result.finalMessage,
    prompt,
  })
  state.changeCount = scan.changeCount
  state.summary = summary.summary
  state.summaryReceived = true
  state.title = summary.title
  state.validatedChangeCount = scan.changeCount
  state.validatedWithWorkspaceCommands = false
  state.validationProblems = uniqueStrings([
    ...state.validationProblems,
    ...scan.problems,
  ])
  state.validated = true

  for (const filePath of scan.changedPaths.slice(0, 12)) {
    await appendAgentEvent({
      message: 'Codex CLI file change captured',
      name: 'agent.codex.file.changed',
      path: filePath,
      runContext,
      status: 'finished',
    })
  }

  if (scan.changedPaths.length > 12) {
    await appendAgentEvent({
      detail: `${scan.changedPaths.length - 12} additional files changed`,
      message: 'Additional Codex CLI file changes captured',
      name: 'agent.codex.file.changed',
      runContext,
      status: 'finished',
    })
  }

  await appendAgentEvent({
    detail: summary.summary,
    message: summary.title,
    name: 'agent.codex.summary',
    runContext,
    status: 'finished',
  })
}

function createForgeTools({
  prompt,
  runContext,
  state,
  toolEvents,
  workspace,
}: {
  prompt: string
  runContext: ForgeRunContext
  state: ForgeAgentState
  toolEvents: Set<string>
  workspace: Map<string, ForgeWorkspaceFile>
}) {
  const planRunTool = toolDefinition({
    description:
      'Declare the implementation plan before reading or writing files.',
    inputSchema: z.object({
      reason: z.string().trim().min(1).max(280),
      title: z.string().trim().min(1).max(80),
    }),
    name: 'planRun',
    outputSchema: z.object({
      ok: z.boolean(),
    }),
  }).server(async ({ reason, title }, context) => {
    toolEvents.add('planRun')
    state.planReceived = true
    state.title = title
    await appendAgentEvent({
      detail: reason,
      message: title,
      name: 'agent.tool.planRun',
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return { ok: true }
  })

  const listFilesTool = toolDefinition({
    description: 'List files in the current TanStack Start workspace.',
    inputSchema: z.object({}),
    name: 'listFiles',
    outputSchema: z.object({
      files: z.array(
        z.object({
          bytes: z.number(),
          path: z.string(),
          source: z.string(),
        }),
      ),
    }),
  }).server(async (_args, context) => {
    toolEvents.add('listFiles')
    const files = Array.from(workspace.values())
      .map((file) => ({
        bytes: textBytes(file.contents),
        path: file.path,
        source: file.source,
      }))
      .sort((left, right) => left.path.localeCompare(right.path))

    await appendAgentEvent({
      detail: `${files.length} files`,
      message: 'Workspace files listed',
      name: 'agent.tool.listFiles',
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return { files }
  })

  const readFileTool = toolDefinition({
    description: 'Read a workspace file by path.',
    inputSchema: z.object({
      path: z.string().trim().min(1).max(180),
    }),
    name: 'readFile',
    outputSchema: z.object({
      contents: z.string().optional(),
      found: z.boolean(),
      path: z.string(),
    }),
  }).server(async ({ path }, context) => {
    toolEvents.add('readFile')
    const file = workspace.get(path)

    await appendAgentEvent({
      detail: file ? `${textBytes(file.contents)} bytes` : 'missing',
      message: file ? 'File read' : 'File missing',
      name: 'agent.tool.readFile',
      path,
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return {
      contents: file?.contents,
      found: Boolean(file),
      path,
    }
  })

  const writeFileTool = toolDefinition({
    description:
      'Write a complete source file. Use this for every app implementation change.',
    inputSchema: z.object({
      contents: z.string().min(1).max(140_000),
      path: z.string().trim().min(1).max(180),
      purpose: z.string().trim().min(1).max(240).optional(),
    }),
    name: 'writeFile',
    outputSchema: z.object({
      bytes: z.number().optional(),
      ok: z.boolean(),
      path: z.string(),
      problems: z.array(z.string()),
    }),
  }).server(async ({ contents, path, purpose }, context) => {
    toolEvents.add('writeFile')
    const problem = validateGeneratedPath(path)

    if (problem) {
      await appendAgentEvent({
        detail: problem,
        message: 'File rejected',
        name: 'agent.tool.writeFile',
        path,
        runContext,
        status: 'failed',
        toolCallId: context?.toolCallId,
      })

      return {
        ok: false,
        path,
        problems: [problem],
      }
    }

    workspace.set(path, {
      contents,
      path,
      source: 'agent',
    })
    state.changeCount += 1

    await appendAgentEvent({
      detail: purpose,
      message: `Wrote ${textBytes(contents)} bytes`,
      name: 'agent.tool.writeFile',
      path,
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return {
      bytes: textBytes(contents),
      ok: true,
      path,
      problems: [],
    }
  })

  const deleteFileTool = toolDefinition({
    description:
      'Delete a workspace source file that is obsolete after the current change.',
    inputSchema: z.object({
      path: z.string().trim().min(1).max(180),
      reason: z.string().trim().min(1).max(240).optional(),
    }),
    name: 'deleteFile',
    outputSchema: z.object({
      found: z.boolean(),
      ok: z.boolean(),
      path: z.string(),
      problems: z.array(z.string()),
    }),
  }).server(async ({ path, reason }, context) => {
    toolEvents.add('deleteFile')
    const result = deleteLocalForgeWorkspaceFile({
      path,
      workspace,
    })

    if (!result.ok) {
      await appendAgentEvent({
        detail: result.problems.join('; '),
        message: 'File delete rejected',
        name: 'agent.tool.deleteFile',
        path,
        runContext,
        status: 'failed',
        toolCallId: context?.toolCallId,
      })

      return result
    }

    if (result.found) {
      state.changeCount += 1
    }

    await appendAgentEvent({
      detail: reason,
      message: result.found ? 'File deleted' : 'File already absent',
      name: 'agent.tool.deleteFile',
      path,
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return result
  })

  const validateFilesTool = toolDefinition({
    description:
      'Validate the current files before finishing. Call after all writes.',
    inputSchema: z.object({}),
    name: 'validateFiles',
    outputSchema: z.object({
      problems: z.array(z.string()),
    }),
  }).server(async (_args, context) => {
    toolEvents.add('validateFiles')
    const problems = await validateWorkspace({
      includeWorkspaceCommands: true,
      prompt,
      workspace,
    })
    state.validated = true
    state.validatedChangeCount = state.changeCount
    state.validatedWithWorkspaceCommands = true
    state.validationProblems = problems

    await appendAgentEvent({
      detail: problems.length > 0 ? problems.join('; ') : undefined,
      message:
        problems.length > 0
          ? `${problems.length} validation problem${problems.length === 1 ? '' : 's'}`
          : 'Validation passed',
      name: 'agent.tool.validateFiles',
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return { problems }
  })

  const setSummaryTool = toolDefinition({
    description:
      'Set the final app title and summary after files have been written and validated.',
    inputSchema: z.object({
      summary: z.string().trim().min(1).max(260),
      title: z.string().trim().min(1).max(80),
    }),
    name: 'setSummary',
    outputSchema: z.object({
      ok: z.boolean(),
    }),
  }).server(async ({ summary, title }, context) => {
    toolEvents.add('setSummary')
    state.summary = summary
    state.summaryReceived = true
    state.title = title

    await appendAgentEvent({
      detail: summary,
      message: title,
      name: 'agent.tool.setSummary',
      runContext,
      status: 'finished',
      toolCallId: context?.toolCallId,
    })

    return { ok: true }
  })

  return [
    planRunTool,
    listFilesTool,
    readFileTool,
    writeFileTool,
    deleteFileTool,
    validateFilesTool,
    setSummaryTool,
  ]
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

async function appendAgentEvent({
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

async function appendAssistantMessage({
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
  const normalizedImportPath = stripImportSpecifierSuffix(importPath)
  const baseParts = fromPath.split('/').slice(0, -1)
  const importParts = normalizedImportPath.split('/')
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

function stripImportSpecifierSuffix(importPath: string) {
  return importPath.split(/[?#]/, 1)[0] ?? importPath
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

function buildForgeAgentPrompt({
  currentFiles,
  prompt,
}: {
  currentFiles: Array<string>
  prompt: string
}) {
  return [
    'You are operating on a real TanStack Start workspace through typed tools.',
    '',
    'Required tool flow:',
    '1. Call planRun.',
    '2. Call listFiles.',
    '3. Read AGENTS.md, package.json, src/routes/index.tsx, and relevant files.',
    '4. Write complete changed files with writeFile. Delete obsolete source files with deleteFile. For a new app, at minimum write src/routes/index.tsx.',
    '5. Call validateFiles after the final write.',
    '6. Call setSummary with the actual app title and what you implemented.',
    '',
    'Hard rules:',
    '- Build the app the user asked for. Do not produce a generic dashboard or a page explaining a plan.',
    '- Do not return code in final prose instead of using writeFile.',
    '- If a source file is obsolete after the change, call deleteFile instead of leaving dead code in the workspace.',
    '- Use React, TypeScript, Tailwind classes, TanStack Router, and TanStack primitives where they fit.',
    '- Generated TypeScript must pass noUnusedLocals and noUnusedParameters. Do not import default React just for JSX.',
    '- For array state, define the item type and call useState<Item[]>(initialValue). Never rely on useState([]) inference.',
    "- src/routes/index.tsx must be a TanStack Router route exporting createFileRoute('/').",
    '- Keep src/routes/__root.tsx and src/router.tsx intact unless you are replacing them with valid TanStack Start equivalents.',
    '- If the prompt asks for todos, include add, toggle completion, all/active/completed filters, delete, and counts.',
    '- Only write or delete safe app source files under src/ or public/, root Markdown docs, or known root app config files.',
    '- Do not write lockfiles, generated route trees, node_modules, hidden files, or Forge runtime support files.',
    '',
    'Permanent TanStack context:',
    ...TANSTACK_CONTEXT.map((line) => `- ${line}`),
    '',
    'Current files:',
    ...currentFiles.map((file) => `- ${file}`),
    '',
    'Latest user brief:',
    prompt,
  ].join('\n')
}

function assertCodexCliHarnessAllowed() {
  if (!isCodexCliForgeHarnessAllowed()) {
    throw new Error(
      'FORGE_AGENT_HARNESS=codex-cli is local-only. Set FORGE_ENABLE_CODEX_CLI=true only in an explicitly sandboxed local runtime.',
    )
  }
}

export function isCodexCliForgeHarnessAllowed({
  enabled = process.env.FORGE_ENABLE_CODEX_CLI,
  nodeEnv = process.env.NODE_ENV,
}: {
  enabled?: string
  nodeEnv?: string
} = {}) {
  return nodeEnv !== 'production' || enabled === 'true'
}

function buildCodexCliHarnessPrompt({
  currentFiles,
  prompt,
}: {
  currentFiles: Array<string>
  prompt: string
}) {
  return [
    'You are the local TanStack Forge Codex CLI harness.',
    '',
    'You are editing a real materialized TanStack Start workspace on disk.',
    'Forge will scan your supported file changes back into its manifest when you finish.',
    '',
    'Required workflow:',
    '1. Inspect AGENTS.md, package.json, src/routes/index.tsx, and relevant source files.',
    '2. Modify complete files directly on disk.',
    '3. Keep changes inside safe app source files under src/ or public/, root Markdown docs, or known root app config files.',
    '4. Do not edit lockfiles, generated route trees, node_modules, hidden files, or Forge runtime support files.',
    '5. Keep src/routes/__root.tsx and src/router.tsx intact unless you are replacing them with valid TanStack Start equivalents.',
    '6. For array state, define the item type and call useState<Item[]>(initialValue). Never rely on useState([]) inference.',
    '7. Validate the edited app enough to be confident it runs.',
    '8. Make the app the user asked for; do not leave a planning page or generic starter dashboard.',
    '',
    'Final response format:',
    'Return JSON only, with this shape:',
    '{"title":"Short app title","summary":"One sentence summary of what changed"}',
    '',
    'Permanent TanStack context:',
    ...TANSTACK_CONTEXT.map((line) => `- ${line}`),
    '',
    'Current files:',
    ...currentFiles.map((file) => `- ${file}`),
    '',
    'Latest user brief:',
    prompt,
  ].join('\n')
}

function getCodexCliWorkspaceDir(runId: string) {
  return path.join(getCodexCliRuntimeDir(), 'workspaces', runId)
}

function getCodexCliOutputMessagePath(runId: string) {
  return path.join(getCodexCliRuntimeDir(), 'messages', `${runId}.txt`)
}

function getCodexCliRuntimeDir() {
  return path.join(
    os.tmpdir(),
    'tanstack-forge-runtime',
    Buffer.from(process.cwd()).toString('base64url'),
    getActiveLocalForgeSessionId(),
    'codex-cli',
  )
}

async function prepareCodexCliWorkspace({
  workspace,
  workspaceDir,
}: {
  workspace: Map<string, ForgeWorkspaceFile>
  workspaceDir: string
}) {
  await rm(workspaceDir, {
    force: true,
    recursive: true,
  })
  await mkdir(workspaceDir, { recursive: true })

  const files = addLocalForgePackageSupport(workspaceToFiles(workspace))

  for (const [filePath, contents] of Object.entries(files)) {
    await writeCodexCliWorkspaceFile({
      contents,
      filePath,
      workspaceDir,
    })
  }

  await writeCodexCliWorkspaceFile({
    contents: [
      'packages:',
      '  - .',
      'onlyBuiltDependencies:',
      '  - esbuild',
      '  - lightningcss',
      '',
    ].join('\n'),
    filePath: 'pnpm-workspace.yaml',
    workspaceDir,
  })
}

async function writeCodexCliWorkspaceFile({
  contents,
  filePath,
  workspaceDir,
}: {
  contents: string
  filePath: string
  workspaceDir: string
}) {
  const outputPath = path.join(
    workspaceDir,
    toSafeCodexCliWorkspacePath(filePath),
  )
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, contents, 'utf8')
}

async function runCodexCliCommand({
  outputLastMessagePath,
  prompt,
  runContext,
  state,
  workspaceDir,
}: {
  outputLastMessagePath: string
  prompt: string
  runContext: ForgeRunContext
  state: ForgeAgentState
  workspaceDir: string
}): Promise<CodexCliCommandResult> {
  const command = await resolveCodexCliCommand()
  const args = buildCodexCliArgs({
    outputLastMessagePath,
    workspaceDir,
  })

  await mkdir(path.dirname(outputLastMessagePath), { recursive: true })
  await appendAgentEvent({
    detail: [command, ...args.slice(0, -1)].join(' '),
    message: 'Codex CLI process started',
    name: 'agent.codex.process.started',
    path: workspaceDir,
    runContext,
    status: 'running',
  })

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceDir,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let emittedEventCount = 0
    let emittedAssistantDeltaChars = 0
    let eventQueue = Promise.resolve()
    let assistantMessageStarted = false
    let assistantMessageText = ''
    let stderr = ''
    let stdoutRemainder = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(
        new Error(
          `Codex CLI timed out after ${LOCAL_FORGE_CODEX_TIMEOUT_MS}ms.`,
        ),
      )
    }, LOCAL_FORGE_CODEX_TIMEOUT_MS)

    function enqueueEvent(event: NormalizedCodexCliEvent) {
      if (event.assistantDelta !== undefined) {
        if (emittedAssistantDeltaChars >= LOCAL_FORGE_CODEX_MAX_OUTPUT_CHARS) {
          return
        }

        const remaining =
          LOCAL_FORGE_CODEX_MAX_OUTPUT_CHARS - emittedAssistantDeltaChars
        event.assistantDelta = event.assistantDelta.slice(0, remaining)
        emittedAssistantDeltaChars += event.assistantDelta.length
      } else {
        if (emittedEventCount >= LOCAL_FORGE_CODEX_MAX_EVENTS) {
          return
        }

        emittedEventCount += 1
      }

      eventQueue = eventQueue
        .then(async () => {
          if (event.assistantDelta !== undefined) {
            if (!assistantMessageStarted) {
              assistantMessageStarted = true
              await appendAssistantMessageStarted({
                messageId: runContext.assistantMessageId,
                runContext,
              })
            }

            assistantMessageText += event.assistantDelta
            state.streamedAssistantMessage =
              state.streamedAssistantMessage ||
              event.assistantDelta.trim().length > 0
            await appendAssistantMessageDelta({
              delta: event.assistantDelta,
              messageId: runContext.assistantMessageId,
              runContext,
            })
            return
          }

          await appendAgentEvent({
            detail: event.detail,
            message: event.message,
            name: event.name,
            path: event.path,
            runContext,
            status: event.status,
            toolCallId: event.toolCallId,
          })
        })
        .catch((error) => {
          console.error('Failed to append Codex CLI event', error)
        })
    }

    function handleStdoutData(chunk: Buffer) {
      const lines = `${stdoutRemainder}${chunk.toString('utf8')}`.split(/\r?\n/)
      stdoutRemainder = lines.pop() ?? ''

      for (const line of lines) {
        const event = normalizeCodexCliJsonLine(line, workspaceDir)

        if (event) {
          enqueueEvent(event)
        }
      }
    }

    function handleStderrData(chunk: Buffer) {
      stderr = appendLimitedText(
        stderr,
        chunk.toString('utf8'),
        LOCAL_FORGE_CODEX_MAX_OUTPUT_CHARS,
      )
    }

    function handleChildError(error: Error) {
      finish(error)
    }

    function handleChildClose(exitCode: number | null) {
      const event = normalizeCodexCliJsonLine(stdoutRemainder, workspaceDir)

      if (event) {
        enqueueEvent(event)
      }

      finish(null, exitCode)
    }

    function cleanup() {
      clearTimeout(timeout)
      child.stdout.off('data', handleStdoutData)
      child.stderr.off('data', handleStderrData)
      child.off('error', handleChildError)
      child.off('close', handleChildClose)
    }

    function finish(error: Error | null, exitCode: number | null = null) {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      void eventQueue.then(async () => {
        if (error) {
          reject(error)
          return
        }

        if (assistantMessageStarted) {
          await appendAssistantMessageCompleted({
            messageId: runContext.assistantMessageId,
            runContext,
            text: assistantMessageText,
          })
        }

        resolve({
          exitCode,
          finalMessage: await readOptionalTextFile(outputLastMessagePath),
          stderr,
          workspaceDir,
        })
      })
    }

    child.stdout.on('data', handleStdoutData)
    child.stderr.on('data', handleStderrData)
    child.once('error', handleChildError)
    child.once('close', handleChildClose)
    child.stdin.end(prompt)
  })
}

function buildCodexCliArgs({
  outputLastMessagePath,
  workspaceDir,
}: {
  outputLastMessagePath: string
  workspaceDir: string
}) {
  const args = [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '-C',
    workspaceDir,
    '-s',
    process.env.FORGE_CODEX_SANDBOX?.trim() || 'workspace-write',
    '-o',
    outputLastMessagePath,
  ]
  const model = process.env.FORGE_CODEX_MODEL?.trim()
  const profile = process.env.FORGE_CODEX_PROFILE?.trim()

  if (model) {
    args.push('-m', model)
  }

  if (profile) {
    args.push('-p', profile)
  }

  args.push('-')

  return args
}

async function resolveCodexCliCommand() {
  const configuredPath =
    process.env.FORGE_CODEX_CLI_PATH?.trim() ||
    process.env.CODEX_CLI_PATH?.trim()

  if (configuredPath) {
    return configuredPath
  }

  if (await pathExists(LOCAL_FORGE_CODEX_APP_CLI)) {
    return LOCAL_FORGE_CODEX_APP_CLI
  }

  return 'codex'
}

async function scanCodexCliWorkspace({
  originalWorkspace,
  workspaceDir,
}: {
  originalWorkspace: Map<string, ForgeWorkspaceFile>
  workspaceDir: string
}): Promise<CodexCliWorkspaceScan> {
  const diskPaths = await listCodexCliWorkspaceFiles(workspaceDir)
  const diskPathSet = new Set(diskPaths)
  const changedPaths = Array<string>()
  const problems = Array<string>()
  const nextWorkspace = new Map<string, ForgeWorkspaceFile>()

  for (const [filePath, file] of originalWorkspace) {
    nextWorkspace.set(filePath, file)
  }

  for (const [filePath, originalFile] of originalWorkspace) {
    if (LOCAL_FORGE_CODEX_SCANNER_IGNORED_FILE_PATHS.has(filePath)) {
      continue
    }

    if (!diskPathSet.has(filePath)) {
      const problem = validateDeletedPath(filePath)

      if (problem === null) {
        nextWorkspace.delete(filePath)
        changedPaths.push(filePath)
      } else if (LOCAL_FORGE_PROTECTED_WORKSPACE_PATHS.has(filePath)) {
        problems.push(
          `Codex CLI deleted unsupported file ${filePath}: ${problem}`,
        )
      }

      continue
    }

    const contents = await readCodexCliWorkspaceTextFile({
      filePath,
      workspaceDir,
    })

    if (contents === originalFile.contents) {
      continue
    }

    const problem = validateGeneratedPath(filePath)

    if (problem) {
      problems.push(
        `Codex CLI changed unsupported file ${filePath}: ${problem}`,
      )
      continue
    }

    nextWorkspace.set(filePath, {
      contents,
      path: filePath,
      source: 'agent',
    })
    changedPaths.push(filePath)
  }

  for (const filePath of diskPaths) {
    if (LOCAL_FORGE_CODEX_SCANNER_IGNORED_FILE_PATHS.has(filePath)) {
      continue
    }

    if (originalWorkspace.has(filePath)) {
      continue
    }

    const problem = validateGeneratedPath(filePath)

    if (problem) {
      problems.push(`Codex CLI wrote unsupported file ${filePath}: ${problem}`)
      continue
    }

    nextWorkspace.set(filePath, {
      contents: await readCodexCliWorkspaceTextFile({
        filePath,
        workspaceDir,
      }),
      path: filePath,
      source: 'agent',
    })
    changedPaths.push(filePath)
  }

  return {
    changeCount: changedPaths.length,
    changedPaths,
    problems,
    workspace: nextWorkspace,
  }
}

async function listCodexCliWorkspaceFiles(
  workspaceDir: string,
  basePath = '',
): Promise<Array<string>> {
  const directory = basePath ? path.join(workspaceDir, basePath) : workspaceDir
  const entries = await readdir(directory, { withFileTypes: true })
  const files = Array<string>()

  for (const entry of entries) {
    const filePath = basePath ? `${basePath}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (!LOCAL_FORGE_CODEX_IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(
          ...(await listCodexCliWorkspaceFiles(workspaceDir, filePath)),
        )
      }

      continue
    }

    if (entry.isFile()) {
      files.push(filePath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

async function readCodexCliWorkspaceTextFile({
  filePath,
  workspaceDir,
}: {
  filePath: string
  workspaceDir: string
}) {
  return readFile(
    path.join(workspaceDir, toSafeCodexCliWorkspacePath(filePath)),
    'utf8',
  )
}

function parseCodexCliSummary({
  fallbackTitle,
  finalMessage,
  prompt,
}: {
  fallbackTitle: string
  finalMessage: string
  prompt: string
}) {
  const parsed = parseJsonObjectFromText(finalMessage)
  const title = readOptionalString(parsed?.title)
  const summary = readOptionalString(parsed?.summary)

  return {
    summary: limitText(
      summary ||
        firstNonEmptyLine(finalMessage) ||
        `Updated the Forge app for: ${limitText(prompt, 180)}`,
      260,
    ),
    title: limitText(title || fallbackTitle, 80),
  }
}

function parseJsonObjectFromText(text: string) {
  const trimmed = stripMarkdownFence(text.trim())
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start === -1 || end === -1 || end < start) {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1))
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function stripMarkdownFence(text: string) {
  if (!text.startsWith('```')) {
    return text
  }

  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function normalizeCodexCliJsonLine(line: string, workspaceDir?: string) {
  const trimmed = line.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)

    return normalizeCodexCliEvent(parsed, workspaceDir)
  } catch {
    return {
      detail: limitText(trimmed, 1000),
      message: 'Codex CLI output',
      name: 'agent.codex.output',
      status: 'running',
    } satisfies NormalizedCodexCliEvent
  }
}

function normalizeCodexCliEvent(
  value: unknown,
  workspaceDir?: string,
): NormalizedCodexCliEvent | null {
  if (!isRecord(value)) {
    return null
  }

  const type = readOptionalString(value.type) ?? 'event'
  const assistantDelta = readCodexCliAssistantDelta(value, type)

  if (assistantDelta !== undefined) {
    return {
      assistantDelta,
      message: 'Codex CLI assistant text',
      name: 'agent.codex.assistant.delta',
      status: 'running',
    }
  }

  if (shouldSkipCodexCliEvent(type)) {
    return null
  }

  const item = isRecord(value.item) ? value.item : undefined
  const itemEvent = normalizeCodexCliItemEvent({
    item,
    type,
    value,
    workspaceDir,
  })

  if (itemEvent) {
    return itemEvent
  }

  return {
    detail: summarizeCodexCliEvent(value),
    message: readCodexCliEventMessage(value, type),
    name: `agent.codex.${normalizeEventName(type)}`,
    path: readCodexCliEventPath(value, workspaceDir),
    status: statusFromCodexCliEventType(type),
  }
}

function shouldSkipCodexCliEvent(type: string) {
  return (
    /\b(reasoning|thought|chain_of_thought)\b/i.test(type) ||
    /^(thread|turn)\./i.test(type)
  )
}

function normalizeCodexCliItemEvent({
  item,
  type,
  value,
  workspaceDir,
}: {
  item: Record<string, unknown> | undefined
  type: string
  value: Record<string, unknown>
  workspaceDir?: string
}): NormalizedCodexCliEvent | null {
  if (!item) {
    return null
  }

  const itemType = readOptionalString(item.type)

  if (!itemType) {
    return null
  }

  const toolCallId = readOptionalString(item.id)

  if (itemType === 'agent_message') {
    return {
      detail: summarizeCodexCliEvent(value),
      message: 'Codex message',
      name: 'agent.codex.message',
      status: statusFromCodexCliItemEvent(type, item),
      toolCallId,
    }
  }

  if (itemType === 'command_execution') {
    return normalizeCodexCliCommandEvent({
      item,
      toolCallId,
      type,
    })
  }

  if (itemType === 'file_change') {
    return normalizeCodexCliFileChangeEvent({
      item,
      toolCallId,
      type,
      workspaceDir,
    })
  }

  if (itemType === 'error') {
    return {
      detail: summarizeCodexCliEvent(value),
      message:
        readOptionalString(item.message) ??
        readOptionalString(item.text) ??
        'Codex notice',
      name: 'agent.codex.notice',
      status: statusFromCodexCliItemEvent(type, item),
      toolCallId,
    }
  }

  return {
    detail: summarizeCodexCliEvent(value),
    message: readCodexCliEventMessage(value, type),
    name: `agent.codex.item.${normalizeEventName(itemType)}.${getCodexCliItemEventPhase(
      type,
      item,
    )}`,
    path: readCodexCliEventPath(value, workspaceDir),
    status: statusFromCodexCliItemEvent(type, item),
    toolCallId,
  }
}

function normalizeCodexCliCommandEvent({
  item,
  toolCallId,
  type,
}: {
  item: Record<string, unknown>
  toolCallId?: string
  type: string
}): NormalizedCodexCliEvent {
  const command =
    readOptionalString(item.command) ??
    readOptionalString(item.cmd) ??
    'command'
  const exitCode = readOptionalNumber(item.exit_code)
  const status =
    exitCode !== undefined && exitCode !== 0
      ? 'failed'
      : statusFromCodexCliItemEvent(type, item)
  const phase =
    status === 'failed'
      ? 'failed'
      : status === 'finished'
        ? 'completed'
        : 'started'

  return {
    detail: formatCodexCliCommandDetail({
      command,
      exitCode,
      output:
        readOptionalString(item.aggregated_output) ??
        readOptionalString(item.output),
    }),
    message: limitText(command, 220),
    name: `agent.codex.command.${phase}`,
    status,
    toolCallId,
  }
}

function normalizeCodexCliFileChangeEvent({
  item,
  toolCallId,
  type,
  workspaceDir,
}: {
  item: Record<string, unknown>
  toolCallId?: string
  type: string
  workspaceDir?: string
}): NormalizedCodexCliEvent {
  const changes = readCodexCliFileChanges(item, workspaceDir)
  const status = statusFromCodexCliItemEvent(type, item)
  const phase =
    status === 'failed'
      ? 'failed'
      : status === 'finished'
        ? 'completed'
        : 'started'
  const firstChange = changes[0]

  return {
    detail: formatCodexCliFileChangeDetail(changes),
    message: formatCodexCliFileChangeMessage(changes, status),
    name: `agent.codex.file.change.${phase}`,
    path: changes.length === 1 ? firstChange?.path : undefined,
    status,
    toolCallId,
  }
}

function readCodexCliAssistantDelta(
  value: Record<string, unknown>,
  type: string,
) {
  if (/\b(reasoning|thought|chain_of_thought|analysis)\b/i.test(type)) {
    return undefined
  }

  const item = isRecord(value.item) ? value.item : undefined
  const delta =
    readOptionalString(value.delta) ??
    readOptionalString(value.token) ??
    readOptionalString(item?.delta) ??
    readOptionalString(item?.token)

  if (!delta) {
    return undefined
  }

  if (/\b(delta|token|assistant|message|text|response)\b/i.test(type)) {
    return delta
  }

  return undefined
}

function readCodexCliEventMessage(
  value: Record<string, unknown>,
  type: string,
) {
  const item = isRecord(value.item) ? value.item : undefined
  const directMessage =
    readOptionalString(value.message) ??
    readOptionalString(value.msg) ??
    readOptionalString(value.title) ??
    readOptionalString(value.text)

  if (directMessage) {
    return limitText(directMessage, 160)
  }

  const command =
    readOptionalString(item?.command) ??
    readOptionalString(item?.cmd) ??
    readOptionalString(value.command)

  if (command) {
    return `Command: ${limitText(command, 140)}`
  }

  const itemType = readOptionalString(item?.type)

  if (itemType) {
    return `Codex CLI ${itemType}`
  }

  return `Codex CLI ${type}`
}

type CodexCliFileChange = {
  kind?: string
  path: string
}

function readCodexCliFileChanges(
  item: Record<string, unknown>,
  workspaceDir?: string,
) {
  const changes = Array<CodexCliFileChange>()

  if (!Array.isArray(item.changes)) {
    return changes
  }

  for (const change of item.changes) {
    if (!isRecord(change)) {
      continue
    }

    const filePath =
      readOptionalString(change.path) ?? readOptionalString(change.file)

    if (!filePath) {
      continue
    }

    changes.push({
      kind: readOptionalString(change.kind),
      path: toCodexCliWorkspaceRelativePath(filePath, workspaceDir),
    })
  }

  return changes
}

function formatCodexCliFileChangeMessage(
  changes: Array<CodexCliFileChange>,
  status: BuilderRunStatus,
) {
  const verb =
    status === 'failed'
      ? 'Failed editing'
      : status === 'finished'
        ? 'Edited'
        : 'Editing'

  if (changes.length === 0) {
    return `${verb} files`
  }

  if (changes.length === 1) {
    return `${verb} ${changes[0]?.path ?? 'file'}`
  }

  return `${verb} ${changes.length.toLocaleString()} files`
}

function formatCodexCliFileChangeDetail(changes: Array<CodexCliFileChange>) {
  if (changes.length === 0) {
    return undefined
  }

  return changes
    .map((change) => `${change.kind ?? 'change'} ${change.path}`)
    .join('\n')
}

function formatCodexCliCommandDetail({
  command,
  exitCode,
  output,
}: {
  command: string
  exitCode?: number
  output?: string
}) {
  const lines = [`$ ${command}`]

  if (exitCode !== undefined) {
    lines.push('', `Exit code: ${exitCode.toLocaleString()}`)
  }

  if (output) {
    lines.push('', limitText(output.trim(), 4000))
  }

  return limitText(lines.join('\n'), 5000)
}

function toCodexCliWorkspaceRelativePath(
  filePath: string,
  workspaceDir?: string,
) {
  if (!workspaceDir) {
    return filePath
  }

  const relativePath = path.relative(workspaceDir, filePath)

  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    return filePath
  }

  return relativePath
}

function readCodexCliEventPath(
  value: Record<string, unknown>,
  workspaceDir?: string,
) {
  const item = isRecord(value.item) ? value.item : undefined

  const filePath =
    readOptionalString(value.path) ??
    readOptionalString(value.file) ??
    readOptionalString(item?.path) ??
    readOptionalString(item?.file)

  return filePath
    ? toCodexCliWorkspaceRelativePath(filePath, workspaceDir)
    : undefined
}

function summarizeCodexCliEvent(value: Record<string, unknown>) {
  try {
    return limitText(JSON.stringify(value), 1000)
  } catch {
    return undefined
  }
}

function getCodexCliItemEventPhase(
  type: string,
  item: Record<string, unknown>,
) {
  const status = statusFromCodexCliItemEvent(type, item)

  if (status === 'failed') {
    return 'failed'
  }

  if (status === 'cancelled') {
    return 'cancelled'
  }

  if (status === 'finished') {
    return 'completed'
  }

  return 'started'
}

function statusFromCodexCliItemEvent(
  type: string,
  item: Record<string, unknown>,
): BuilderRunStatus {
  const itemStatus = readOptionalString(item.status)

  if (itemStatus) {
    return statusFromCodexCliStatus(itemStatus)
  }

  return statusFromCodexCliEventType(type)
}

function statusFromCodexCliEventType(type: string): BuilderRunStatus {
  if (/\b(failed|error)\b/i.test(type)) {
    return 'failed'
  }

  if (/\b(completed|finished|done)\b/i.test(type)) {
    return 'finished'
  }

  return 'running'
}

function statusFromCodexCliStatus(status: string): BuilderRunStatus {
  if (/\b(cancelled|canceled|interrupted)\b/i.test(status)) {
    return 'cancelled'
  }

  if (/\b(failed|error)\b/i.test(status)) {
    return 'failed'
  }

  if (/\b(completed|finished|done|success|succeeded)\b/i.test(status)) {
    return 'finished'
  }

  if (/\b(queued|pending)\b/i.test(status)) {
    return 'queued'
  }

  return 'running'
}

function normalizeEventName(type: string) {
  return type
    .replace(/[^a-zA-Z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase()
}

function titleFromPrompt(prompt: string) {
  return limitText(firstNonEmptyLine(prompt) || 'Forge app', 80)
}

function firstNonEmptyLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

function toSafeCodexCliWorkspacePath(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${filePath} is not a safe Codex CLI workspace path.`)
  }

  return filePath
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function readOptionalTextFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return ''
  }
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

function getLocalForgeAdapter(providerCredential?: ForgeProviderCredential) {
  if (providerCredential?.provider === 'openai') {
    return createOpenaiChat(
      getOpenAiForgeModel(providerCredential.model),
      providerCredential.apiKey,
    )
  }

  if (providerCredential?.provider === 'anthropic') {
    return createAnthropicChat(
      getAnthropicForgeModel(providerCredential.model),
      providerCredential.apiKey,
    )
  }

  if (process.env.OPENAI_API_KEY) {
    return openaiText(getOpenAiForgeModel())
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return anthropicText(getAnthropicForgeModel())
  }

  return null
}

function getOpenAiForgeModel(requestedModel = process.env.BUILDER_AI_MODEL) {
  const model = supportedOpenAiForgeModels.find(
    (supportedModel) => supportedModel === requestedModel,
  )

  return model ?? 'gpt-5'
}

function getAnthropicForgeModel(requestedModel = process.env.BUILDER_AI_MODEL) {
  const model = supportedAnthropicForgeModels.find(
    (supportedModel) => supportedModel === requestedModel,
  )

  return model ?? 'claude-sonnet-4-5'
}

async function runAbortableForgeTask<T>({
  label,
  task,
  timeoutMs,
}: {
  label: string
  task: (abortController: AbortController) => Promise<T> | T
  timeoutMs: number
}) {
  const abortController = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const taskPromise = Promise.resolve().then(() => task(abortController))
  void taskPromise.catch(() => {})

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort(`${label} timed out`)
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([taskPromise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
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

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : 'Forge agent failed'
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10)

  return Number.isFinite(value) && value > 0 ? value : fallback
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

function textBytes(content: string) {
  return new TextEncoder().encode(content).length
}
