import { createHash } from 'node:crypto'
import {
  chat,
  maxIterations,
  type ChatMiddleware,
  type ModelMessage,
  type StreamChunk,
} from '@tanstack/ai'
import { claudeCodeText } from '@tanstack/ai-claude-code'
import { codexText, type CodexTextProviderOptions } from '@tanstack/ai-codex'
import {
  createSecrets,
  computeSandboxKey,
  defineSandbox,
  defineWorkspace,
  withSandbox,
  watchWorkspace,
  type SandboxDefinition,
  type SandboxHandle,
  type SandboxHooks,
  type SandboxWatchHandle,
} from '@tanstack/ai-sandbox'
import { cloudflareSandbox } from '@tanstack/ai-sandbox-cloudflare'
import { getSandbox, type Sandbox, type SandboxEnv } from '@cloudflare/sandbox'
import type { BlobStorage } from '~/server/runtime/blob-storage.server'
import type { ForgeByokProvider } from './forge-byok.server'
import { appendLocalForgeRuntimeEvent } from './local-store.server'
import { forgePersistenceHooks } from './sandbox-r2-persistence.server'
import {
  createForgeSandboxPreviewUrl,
  FORGE_SANDBOX_OPTIONS,
  FORGE_SANDBOX_PREVIEW_PORT,
  forgeSandboxPortIsListening,
  restartForgeSandboxPreviewDevServer,
  resolveForgeSandboxPreviewHmrOptions,
  type ForgeSandboxPreviewTunnelEnv,
} from './sandbox-preview.server'

const FORGE_SANDBOX_PREVIEW_HOSTNAME = 'forge.tanstack.com'
const FORGE_SANDBOX_PROVIDER_NAME = 'cloudflare'
const FORGE_SANDBOX_APP_DIR = '/workspace/app'
const FORGE_SANDBOX_AGENT_PREVIEW_WAIT_MS = 180_000
const FORGE_SANDBOX_AGENT_TUNNEL_WAIT_MS = 60_000
const FORGE_SANDBOX_FILE_WATCH_INTERVAL_MS = 1_500
const FORGE_SANDBOX_FILE_WATCH_IGNORES = [
  '.git',
  '.tanstack',
  'dist',
  'node_modules',
]

/**
 * The sandbox env var each BYOK provider's coding CLI reads its key from. The
 * baked container image (`docker/forge-sandbox/Dockerfile`) ships both CLIs;
 * the caller's key is injected under the matching name so only the selected
 * CLI can authenticate.
 */
const FORGE_SANDBOX_SECRET_BY_PROVIDER = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'CODEX_API_KEY',
} as const satisfies Record<ForgeByokProvider, string>

/**
 * Coding model each provider's sandbox agent runs. Like the Codex model, this
 * is pinned to the provider's strongest coding harness model and is
 * independent of the user's chat-model selection — the sandbox path drives a
 * CLI agent, not the picked chat model.
 */
const FORGE_SANDBOX_ANTHROPIC_MODEL = 'sonnet'
const FORGE_SANDBOX_OPENAI_MODEL = 'gpt-5.3-codex'

/**
 * The sandbox-resident coding agent adapter for a BYOK provider. Codex drives
 * the `codex` CLI, Claude Code drives the `claude` CLI — both spawn inside the
 * sandbox and stream their thread events back through `withSandbox`.
 */
function forgeSandboxAdapter(provider: ForgeByokProvider) {
  return provider === 'anthropic'
    ? claudeCodeText(FORGE_SANDBOX_ANTHROPIC_MODEL, {
        permissionMode: 'bypassPermissions',
      })
    : codexText(FORGE_SANDBOX_OPENAI_MODEL, {
        approvalPolicy: 'never',
        cwd: FORGE_SANDBOX_APP_DIR,
        modelReasoningEffort: 'medium',
        networkAccessEnabled: true,
        sandboxMode: 'danger-full-access',
      })
}

export type ForgeSandboxEnv = SandboxEnv<Sandbox>

export function getForgeSandboxId({
  projectId,
  threadId,
}: {
  projectId: string
  threadId: string
}) {
  const hash = createHash('sha256')
    .update(`${projectId}:${threadId}`)
    .digest('hex')
    .slice(0, 40)

  return `forge-${hash}`
}

export function getForgeSandboxProviderId({
  projectId,
  threadId,
}: {
  projectId: string
  threadId: string
}) {
  return computeSandboxKey({
    providerName: FORGE_SANDBOX_PROVIDER_NAME,
    sandboxId: getForgeSandboxId({ projectId, threadId }),
    threadId,
    workspace: createForgeWorkspaceDefinition(),
  })
}

function createForgeWorkspaceDefinition({
  byokKey,
  provider,
}: {
  byokKey?: string
  provider?: ForgeByokProvider
} = {}) {
  return defineWorkspace({
    ...(byokKey && provider
      ? {
          secrets: createSecrets({
            [FORGE_SANDBOX_SECRET_BY_PROVIDER[provider]]: byokKey,
          }),
        }
      : undefined),
    source: { type: 'none' },
  })
}

/**
 * Build the sandbox definition a Forge thread's chat run resolves into. One
 * sandbox is reused per thread (`lifecycle.reuse: 'thread'`); the workspace
 * clones nothing (`source: { type: 'none' }`) and injects the caller's BYOK
 * key under the selected provider's env var (`CODEX_API_KEY` for OpenAI,
 * `ANTHROPIC_API_KEY` for Anthropic) — the harness reads it from the sandbox
 * env, never from the SandboxStore or event log.
 */
export function buildForgeSandbox({
  byokKey,
  env,
  hooks,
  publicHost,
  projectId,
  provider,
  threadId,
}: {
  threadId: string
  projectId: string
  byokKey: string
  provider: ForgeByokProvider
  env: ForgeSandboxEnv
  hooks?: SandboxHooks
  publicHost?: string
}): SandboxDefinition {
  return defineSandbox({
    fileEvents: false,
    id: getForgeSandboxId({ projectId, threadId }),
    hooks,
    lifecycle: {
      reuse: 'thread',
    },
    provider: cloudflareSandbox({
      binding: env.Sandbox,
      previewHostname: publicHost ?? FORGE_SANDBOX_PREVIEW_HOSTNAME,
      transport: FORGE_SANDBOX_OPTIONS.transport,
    }),
    workspace: createForgeWorkspaceDefinition({ byokKey, provider }),
  })
}

/** System prompt steering the coding agent to edit the already-running preview workspace. */
const FORGE_SANDBOX_AGENT_SYSTEM_PROMPT = [
  'You are the TanStack Forge sandbox coding agent.',
  'Build the requested app in the TanStack Start workspace at /workspace/app.',
  'Inspect and edit files directly in that workspace and keep changes scoped to app source and config.',
  'Every successful run must leave a supported file diff under /workspace/app/src, /workspace/app/public, or an allowed root app config file.',
  'A final text response without editing files is a failed Forge run, even if you believe the app already matches the request.',
  'Forge starts and exposes a Vite dev server for the user before you edit; rely on that running server and do not start a second server or call preview/expose tools.',
  'Only restart the existing server on port 5173 when the requested change requires it.',
].join(' ')

/** Max coding-agent loop iterations for one sandbox run before it is forced to stop. */
const FORGE_SANDBOX_AGENT_MAX_ITERATIONS = 30

export interface ForgeSandboxAgentWorkspaceResult {
  deletedPaths: Array<string>
  files: Record<string, string>
  mode: 'full-scan' | 'incremental'
}

/**
 * Drive one coding-agent run inside a Forge thread's Cloudflare sandbox.
 * Builds the sandbox via `buildForgeSandbox` (wiring R2 persistence hooks
 * through `forgePersistenceHooks`), then runs `chat()` with the provider's
 * sandbox-bound coding adapter (`codexText` for OpenAI, `claudeCodeText` for
 * Anthropic) and the `withSandbox` middleware. Forge starts/exposes the
 * preview in `onReady`, before the coding agent edits files.
 *
 * `onChunk` receives each RAW `StreamChunk` from the stream unchanged — this
 * function performs no translation. A later task's SSE-proxy consumer is
 * responsible for running chunks through `translateChunk`
 * (`./sandbox-event-translation.server`).
 */
export async function runForgeSandboxAgent({
  abortSignal,
  byokKey,
  env,
  manifestVersionId,
  messages,
  onChunk,
  existingPreviewUrl,
  publicHost,
  projectId,
  provider,
  runId,
  threadId,
  codexSessionId,
}: {
  threadId: string
  projectId: string
  manifestVersionId?: string
  /** Live run identity the persistence hooks key activity-feed events under. */
  runId: string
  messages: Array<ModelMessage>
  byokKey: string
  provider: ForgeByokProvider
  env: ForgeSandboxEnv &
    ForgeSandboxPreviewTunnelEnv & {
      FORGE_RUNTIME?: BlobStorage
      PREVIEW_HOSTNAME?: string
    }
  existingPreviewUrl?: string
  onChunk: (chunk: StreamChunk) => void
  abortSignal?: AbortSignal
  publicHost?: string
  codexSessionId?: string
}): Promise<ForgeSandboxAgentWorkspaceResult> {
  const runStartedAt = Date.now()
  const phaseRecorder = createForgePhaseRecorder({ runId })
  // Build the persistence hooks ONCE so the same instance drives the sandbox
  // lifecycle (onReady/onFile), mirrors live file activity, and uses a final
  // tree scan as the authoritative manifest source after the agent exits.
  //
  // R2 manifest/blob lookups key off the durable `manifestVersionId`
  // (falling back to `projectId`); activity-feed events key off the ephemeral
  // `runId` so they group under the live run like the rest of its events.
  const providerSandboxId = getForgeSandboxProviderId({ projectId, threadId })
  const persistenceHooks = forgePersistenceHooks({
    env,
    manifestVersionId: manifestVersionId ?? projectId,
    runId,
    startedAt: runStartedAt,
  })
  let fileWatcher: SandboxWatchHandle | undefined
  const hooks = {
    ...persistenceHooks,
    onReady: async (handle: SandboxHandle) => {
      phaseRecorder.record({
        detail: providerSandboxId,
        message: 'Sandbox attach phase finished',
        name: 'workflow.phase.sandbox.attach.finished',
        startedAt: runStartedAt,
      })

      await persistenceHooks.onReady?.(handle)

      await fileWatcher?.stop().catch((error: unknown) => {
        console.error(
          '[forge-sandbox] previous app file watcher stop failed',
          error,
        )
      })

      fileWatcher = await watchWorkspace(handle, {
        ignore: FORGE_SANDBOX_FILE_WATCH_IGNORES,
        intervalMs: FORGE_SANDBOX_FILE_WATCH_INTERVAL_MS,
        onEvent: (event) => {
          void persistenceHooks.onFile?.(event)
        },
        root: FORGE_SANDBOX_APP_DIR,
      })

      await ensureForgeSandboxPreview({
        env,
        existingPreviewUrl,
        handle,
        publicHost,
        runId,
        sandboxId: providerSandboxId,
      })
    },
  } satisfies SandboxHooks

  const sandbox = buildForgeSandbox({
    byokKey,
    env,
    hooks,
    publicHost,
    projectId,
    provider,
    threadId,
  })

  // Mirror `runTanStackAiForgeHarness`: create an AbortController and forward
  // an external abort signal into it so `chat()` can be cancelled by the run's
  // timeout/cancellation.
  const abortController = new AbortController()

  if (abortSignal) {
    if (abortSignal.aborted) {
      abortController.abort(abortSignal.reason)
    } else {
      abortSignal.addEventListener(
        'abort',
        () => abortController.abort(abortSignal.reason),
        { once: true },
      )
    }
  }

  const modelOptions = {
    approvalPolicy: 'never',
    modelReasoningEffort: 'medium',
    sandboxMode: 'danger-full-access',
    workingDirectory: FORGE_SANDBOX_APP_DIR,
    ...(codexSessionId ? { sessionId: codexSessionId } : {}),
  } satisfies CodexTextProviderOptions

  const stream = chat({
    abortController,
    adapter: forgeSandboxAdapter(provider),
    agentLoopStrategy: maxIterations(FORGE_SANDBOX_AGENT_MAX_ITERATIONS),
    debug: createForgeTanStackAiDebugConfig({ runId }),
    messages,
    middleware: [
      createForgeFirstModelChunkMiddleware({
        onFirstModelChunk: (chunk) => {
          phaseRecorder.record({
            detail: chunk.type,
            message: 'First model chunk received',
            name: 'workflow.phase.first-model-token.finished',
            startedAt: runStartedAt,
          })
        },
      }),
      withSandbox(sandbox),
    ],
    modelOptions,
    runId,
    stream: true,
    systemPrompts: [FORGE_SANDBOX_AGENT_SYSTEM_PROMPT],
    threadId,
    tools: [],
  })

  try {
    for await (const chunk of stream) {
      onChunk(chunk)
    }
  } finally {
    await fileWatcher?.stop().catch((error: unknown) => {
      console.error('[forge-sandbox] app file watcher stop failed', error)
    })
    fileWatcher = undefined
  }

  // Flush any debounced file mirrors (R2 writes + activity events) queued by
  // the final edits before they can be dropped when the isolate tears down.
  // `flush()` never rejects, but guard it anyway so a mirror failure can't
  // abort the scan-back.
  const flushStartedAt = Date.now()

  try {
    await persistenceHooks.flush()
    phaseRecorder.record({
      detail: 'R2 mirrors and file activity drained',
      message: 'Final persistence flush finished',
      name: 'workflow.phase.final-flush.finished',
      startedAt: flushStartedAt,
    })
  } catch (error) {
    console.error('[forge-sandbox] flush failed', error)
    phaseRecorder.record({
      detail: error instanceof Error ? error.message : 'Unknown flush error',
      message: 'Final persistence flush failed',
      name: 'workflow.phase.final-flush.failed',
      startedAt: flushStartedAt,
      status: 'failed',
    })
  }

  await phaseRecorder.flush()

  const incrementalChanges = persistenceHooks.collectWorkspaceChanges()
  const scanStartedAt = Date.now()

  try {
    const files = await persistenceHooks.collectWorkspaceFiles()
    const fileCount = Object.keys(files).length

    if (fileCount > 0) {
      phaseRecorder.record({
        detail: `${fileCount} files; incremental events: ${
          Object.keys(incrementalChanges.files).length
        } changed, ${incrementalChanges.deletedPaths.length} deleted`,
        message: 'Final workspace scan finished',
        name: 'workflow.phase.final-scan.finished',
        startedAt: scanStartedAt,
      })
      await phaseRecorder.flush()

      return {
        deletedPaths: [],
        files,
        mode: 'full-scan',
      }
    }
  } catch (error) {
    console.error('[forge-sandbox] collectWorkspaceFiles threw', error)
  }

  return {
    ...incrementalChanges,
    mode: 'incremental',
  }
}

function createForgeFirstModelChunkMiddleware({
  onFirstModelChunk,
}: {
  onFirstModelChunk: (chunk: StreamChunk) => void
}): ChatMiddleware {
  let recorded = false

  return {
    name: 'forge-first-model-chunk-timing',
    onChunk(_ctx, chunk) {
      if (!recorded && isForgeModelChunk(chunk)) {
        recorded = true
        onFirstModelChunk(chunk)
      }
    },
  }
}

function isForgeModelChunk(chunk: StreamChunk) {
  return (
    chunk.type === 'TEXT_MESSAGE_START' ||
    chunk.type === 'TEXT_MESSAGE_CONTENT' ||
    chunk.type === 'REASONING_MESSAGE_START' ||
    chunk.type === 'REASONING_MESSAGE_CONTENT' ||
    chunk.type === 'TOOL_CALL_START' ||
    chunk.type === 'TOOL_CALL_ARGS'
  )
}

function createForgePhaseRecorder({ runId }: { runId: string }) {
  const pending = new Set<Promise<void>>()

  function record({
    detail,
    message,
    name,
    startedAt,
    status = 'finished',
  }: {
    detail?: string
    message: string
    name: string
    startedAt: number
    status?: 'failed' | 'finished'
  }) {
    const promise = appendLocalForgeRuntimeEvent({
      detail,
      message,
      name,
      producerId: 'forge-phase-timer',
      runId,
      startedAt,
      status,
    })
      .catch((error: unknown) => {
        console.error('[forge-sandbox] phase timing append failed', error)
      })
      .finally(() => {
        pending.delete(promise)
      })

    pending.add(promise)
  }

  return {
    async flush() {
      await Promise.allSettled(Array.from(pending))
    },
    record,
  }
}

function createForgeTanStackAiDebugConfig({ runId }: { runId: string }) {
  return {
    agentLoop: true,
    config: false,
    errors: true,
    middleware: false,
    output: false,
    provider: false,
    request: true,
    sandbox: true,
    tools: true,
    logger: {
      debug: (message: string, meta?: Record<string, unknown>) => {
        logForgeTanStackAiDebug('debug', runId, message, meta)
      },
      error: (message: string, meta?: Record<string, unknown>) => {
        logForgeTanStackAiDebug('error', runId, message, meta)
      },
      info: (message: string, meta?: Record<string, unknown>) => {
        logForgeTanStackAiDebug('info', runId, message, meta)
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        logForgeTanStackAiDebug('warn', runId, message, meta)
      },
    },
  }
}

function logForgeTanStackAiDebug(
  level: 'debug' | 'error' | 'info' | 'warn',
  runId: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const detail = meta ? { ...meta, runId } : { runId }

  console[level](`[forge-tanstack-ai] ${message}`, detail)
}

async function ensureForgeSandboxPreview({
  env,
  existingPreviewUrl,
  handle,
  publicHost,
  runId,
  sandboxId,
}: {
  env: ForgeSandboxEnv & ForgeSandboxPreviewTunnelEnv
  existingPreviewUrl?: string
  handle: SandboxHandle
  publicHost?: string
  runId: string
  sandboxId: string
}) {
  if (existingPreviewUrl) {
    return
  }

  const hmr = resolveForgeSandboxPreviewHmrOptions({ publicHost })
  const portListening = await forgeSandboxPreviewPortIsListening(handle)

  if (!portListening) {
    const previewStartedAt = Date.now()

    await appendLocalForgeRuntimeEvent({
      detail: sandboxId,
      message: 'Sandbox preview starting',
      name: 'workflow.preview.starting',
      producerId: 'forge-preview',
      runId,
      startedAt: previewStartedAt,
      status: 'running',
    })

    const started = await restartForgeSandboxPreviewDevServer(handle.process, {
      ...(hmr ? { hmr } : {}),
      waitTimeoutMs: FORGE_SANDBOX_AGENT_PREVIEW_WAIT_MS,
    })

    if (!started.ok) {
      await appendLocalForgeRuntimeEvent({
        detail:
          started.logTail ||
          `Forge sandbox preview dev server did not start within ${FORGE_SANDBOX_AGENT_PREVIEW_WAIT_MS}ms.`,
        message: 'Sandbox preview did not start in time',
        name: 'workflow.preview.start.failed',
        producerId: 'forge-preview',
        runId,
        startedAt: previewStartedAt,
        status: 'failed',
      })
      return
    }
  }

  const sandbox = getSandbox(env.Sandbox, sandboxId, FORGE_SANDBOX_OPTIONS)
  const tunnel = await createForgeSandboxPreviewUrlWithTimeout({
    env,
    publicHost,
    sandbox,
    sandboxId,
    timeoutMs: FORGE_SANDBOX_AGENT_TUNNEL_WAIT_MS,
  })

  if (tunnel.ok) {
    await appendLocalForgeRuntimeEvent({
      detail: tunnel.url,
      message: 'Sandbox preview ready',
      name: 'workflow.preview.ready',
      producerId: 'forge-preview',
      runId,
      status: 'finished',
    })
  } else {
    await appendLocalForgeRuntimeEvent({
      detail: tunnel.message,
      message: 'Sandbox preview tunnel deferred',
      name: 'workflow.preview.tunnel.deferred',
      producerId: 'forge-preview',
      runId,
      status: 'running',
    })
  }
}

async function createForgeSandboxPreviewUrlWithTimeout({
  env,
  publicHost,
  sandbox,
  sandboxId,
  timeoutMs,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  publicHost?: string
  sandbox: ReturnType<typeof getSandbox>
  sandboxId: string
  timeoutMs: number
}) {
  const tunnelPromise = createForgeSandboxPreviewUrl({
    env,
    publicHost,
    sandbox,
    sandboxId,
  })

  const timeoutPromise = new Promise<{ message: string; ok: false }>(
    (resolve) => {
      setTimeout(
        () =>
          resolve({
            message:
              'Cloudflare quick tunnel is still starting; the chat run will continue.',
            ok: false,
          }),
        timeoutMs,
      )
    },
  )

  return Promise.race([tunnelPromise, timeoutPromise])
}

async function forgeSandboxPreviewPortIsListening(handle: SandboxHandle) {
  return forgeSandboxPortIsListening({
    port: FORGE_SANDBOX_PREVIEW_PORT,
    sandbox: handle.process,
    timeoutMs: 750,
  })
}
