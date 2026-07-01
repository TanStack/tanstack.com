import {
  chat,
  maxIterations,
  type ModelMessage,
  type StreamChunk,
} from '@tanstack/ai'
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
import { forgePersistenceHooks } from './sandbox-r2-persistence.server'
import { exposeForgePreview } from './sandbox-preview-tool.server'

const FORGE_SANDBOX_PREVIEW_HOSTNAME = 'forge.tanstack.com'

export type ForgeSandboxEnv = SandboxEnv<Sandbox>

/**
 * Build the sandbox definition a Forge thread's chat run resolves into. One
 * sandbox is reused per thread (`lifecycle.reuse: 'thread'`); the workspace
 * clones nothing (`source: { type: 'none' }`) and injects the caller's BYOK
 * key as `CODEX_API_KEY` — the harness reads it from the sandbox env, never
 * from the SandboxStore or event log.
 */
export function buildForgeSandbox({
  byokKey,
  env,
  hooks,
  projectId,
  threadId,
}: {
  threadId: string
  projectId: string
  byokKey: string
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
      secrets: createSecrets({ CODEX_API_KEY: byokKey }),
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
 * Drive one Codex coding-agent run inside a Forge thread's Cloudflare
 * sandbox. Builds the sandbox via `buildForgeSandbox` (wiring R2
 * persistence hooks through `forgePersistenceHooks`), then runs `chat()`
 * with the sandbox-bound Codex adapter (`codexText`), the `withSandbox`
 * middleware, and the `exposeForgePreview` tool built fresh for this run.
 *
 * `onChunk` receives each RAW `StreamChunk` from the stream unchanged — this
 * function performs no translation. A later task's SSE-proxy consumer is
 * responsible for running chunks through `translateChunk`
 * (`./sandbox-event-translation.server`).
 */
export async function runForgeSandboxAgent({
  byokKey,
  env,
  manifestVersionId,
  messages,
  onChunk,
  projectId,
  threadId,
}: {
  threadId: string
  projectId: string
  manifestVersionId?: string
  messages: Array<ModelMessage>
  byokKey: string
  env: ForgeSandboxEnv & { FORGE_RUNTIME?: BlobStorage; PREVIEW_HOSTNAME?: string }
  onChunk: (chunk: StreamChunk) => void
}): Promise<void> {
  const sandbox = buildForgeSandbox({
    byokKey,
    env,
    hooks: forgePersistenceHooks({
      env,
      projectId: manifestVersionId ?? projectId,
    }),
    projectId,
    threadId,
  })

  const stream = chat({
    adapter: codexText('gpt-5.3-codex', { sandboxMode: 'danger-full-access' }),
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
}
