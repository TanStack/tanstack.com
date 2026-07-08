import {
  chat,
  maxIterations,
  type ModelMessage,
  type StreamChunk,
} from '@tanstack/ai'
import { claudeCodeText } from '@tanstack/ai-claude-code'
import { codexText } from '@tanstack/ai-codex'
import {
  createSecrets,
  defineSandbox,
  defineWorkspace,
  withSandbox,
  type SandboxDefinition,
  type SandboxHooks,
} from '@tanstack/ai-sandbox'
import { cloudflareSandbox } from '@tanstack/ai-sandbox-cloudflare'
import type { Sandbox, SandboxEnv } from '@cloudflare/sandbox'
import type { BlobStorage } from '~/server/runtime/blob-storage.server'
import type { ForgeByokProvider } from './forge-byok.server'
import { forgePersistenceHooks } from './sandbox-r2-persistence.server'
import { exposeForgePreview } from './sandbox-preview-tool.server'

const FORGE_SANDBOX_PREVIEW_HOSTNAME = 'forge.tanstack.com'

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
        sandboxMode: 'danger-full-access',
      })
}

export type ForgeSandboxEnv = SandboxEnv<Sandbox>

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
}): SandboxDefinition {
  return defineSandbox({
    id: `forge-${projectId}-${threadId}`,
    hooks,
    lifecycle: {
      reuse: 'thread',
    },
    provider: cloudflareSandbox({
      binding: env.Sandbox,
      previewHostname: FORGE_SANDBOX_PREVIEW_HOSTNAME,
      transport: 'http',
    }),
    workspace: defineWorkspace({
      secrets: createSecrets({
        [FORGE_SANDBOX_SECRET_BY_PROVIDER[provider]]: byokKey,
      }),
      source: { type: 'none' },
    }),
  })
}

/** System prompt steering the Codex coding agent to stand up a dev server and hand back a preview URL. */
const FORGE_SANDBOX_AGENT_SYSTEM_PROMPT =
  'You are the TanStack Forge sandbox coding agent. Build the requested app in the sandbox workspace. Once it is ready, start the dev server bound to 0.0.0.0 on a port of your choosing, then call the exposeForgePreview tool with that port to get a public preview URL and share it with the user.'

/** Max Codex agent-loop iterations for one sandbox run before it is forced to stop. */
const FORGE_SANDBOX_AGENT_MAX_ITERATIONS = 30

/**
 * Drive one coding-agent run inside a Forge thread's Cloudflare sandbox.
 * Builds the sandbox via `buildForgeSandbox` (wiring R2 persistence hooks
 * through `forgePersistenceHooks`), then runs `chat()` with the provider's
 * sandbox-bound coding adapter (`codexText` for OpenAI, `claudeCodeText` for
 * Anthropic), the `withSandbox` middleware, and the `exposeForgePreview` tool
 * built fresh for this run.
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
  projectId,
  provider,
  runId,
  threadId,
}: {
  threadId: string
  projectId: string
  manifestVersionId?: string
  /** Live run identity the persistence hooks key activity-feed events under. */
  runId: string
  messages: Array<ModelMessage>
  byokKey: string
  provider: ForgeByokProvider
  env: ForgeSandboxEnv & {
    FORGE_RUNTIME?: BlobStorage
    PREVIEW_HOSTNAME?: string
  }
  onChunk: (chunk: StreamChunk) => void
  abortSignal?: AbortSignal
}): Promise<{ files: Record<string, string> }> {
  // Build the persistence hooks ONCE so the same instance drives the sandbox
  // lifecycle (onReady/onFile) AND exposes the final tree afterwards via
  // `collectWorkspaceFiles` — the handle it captures in `onReady` is what
  // `collectWorkspaceFiles` reads back out below.
  //
  // R2 manifest/blob lookups key off the durable `manifestVersionId`
  // (falling back to `projectId`); activity-feed events key off the ephemeral
  // `runId` so they group under the live run like the rest of its events.
  const hooks = forgePersistenceHooks({
    env,
    manifestVersionId: manifestVersionId ?? projectId,
    runId,
  })

  const sandbox = buildForgeSandbox({
    byokKey,
    env,
    hooks,
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

  const stream = chat({
    abortController,
    adapter: forgeSandboxAdapter(provider),
    agentLoopStrategy: maxIterations(FORGE_SANDBOX_AGENT_MAX_ITERATIONS),
    messages,
    middleware: [withSandbox(sandbox)],
    stream: true,
    systemPrompts: [FORGE_SANDBOX_AGENT_SYSTEM_PROMPT],
    tools: [exposeForgePreview({ threadId }, env)],
  })

  for await (const chunk of stream) {
    onChunk(chunk)
  }

  // Flush any debounced file mirrors (R2 writes + activity events) queued by
  // the final edits before they can be dropped when the isolate tears down.
  // `flush()` never rejects, but guard it anyway so a mirror failure can't
  // abort the scan-back.
  try {
    await hooks.flush()
  } catch (error) {
    console.error('[forge-sandbox] flush failed', error)
  }

  // Scan the sandbox's final `/workspace/app` tree back out so the caller can
  // repopulate the in-memory workspace Map the shared finalize persists from.
  // `collectWorkspaceFiles` already returns `{}` on any failure (e.g. an
  // aborted run whose sandbox was destroyed), but guard here too so this
  // function can never throw an unhandled rejection out of a failed run.
  try {
    return { files: await hooks.collectWorkspaceFiles() }
  } catch (error) {
    console.error('[forge-sandbox] collectWorkspaceFiles threw', error)
    return { files: {} }
  }
}
