import {
  createSecrets,
  defineSandbox,
  defineWorkspace,
  type SandboxDefinition,
  type SandboxHooks,
} from '@tanstack/ai-sandbox'
import { cloudflareSandbox } from '@tanstack/ai-sandbox-cloudflare'
import type { Sandbox, SandboxEnv } from '@cloudflare/sandbox'

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
