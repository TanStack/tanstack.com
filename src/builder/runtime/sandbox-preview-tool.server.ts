/**
 * A `chat()` server tool that exposes a dev server running inside a Forge
 * sandbox as a preview URL on OUR custom wildcard domain
 * (`https://<port>-<id>-<token>.forge.tanstack.com`), instead of the
 * `@tanstack/ai-sandbox-cloudflare` package's shipped `exposePreviewTool`
 * (`sandbox.tunnels.get(port)` → a Cloudflare quick tunnel,
 * `https://<name>.trycloudflare.com`).
 *
 * We deliberately do NOT use the package's quick-tunnel tool: Forge serves
 * previews from our own domain, so the port must be exposed via
 * `sandbox.exposePort(port, { hostname })` (Cloudflare's custom-domain
 * preview-URL feature), matching the same `previewHostname` the sandbox
 * provider itself is configured with in `sandbox-agent.server.ts`
 * (`cloudflareSandbox({ previewHostname: FORGE_SANDBOX_PREVIEW_HOSTNAME })`).
 *
 * Shaped identically to the package's `exposePreviewTool(input, env)`: a
 * factory that closes over the run's `input` (for `threadId`, to address the
 * same container the dev server runs in) and `env` (for the `Sandbox`
 * binding), returning a `ServerTool` built via
 * `toolDefinition(...).server(...)`. Build it inside the `tools` resolver
 * (`tools: (input, env) => [exposeForgePreview(input, env)]`).
 */
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { getSandbox } from '@cloudflare/sandbox'
import type { ForgeSandboxEnv } from './sandbox-agent.server'

/** Fallback custom domain used when `PREVIEW_HOSTNAME` is unset in `env`. */
const DEFAULT_FORGE_PREVIEW_HOSTNAME = 'forge.tanstack.com'

/**
 * The minimum shape `exposeForgePreview` needs: the run's `threadId` (to
 * address the same sandbox the dev server runs in) — the same field
 * `StartRunInput` carries in the shipped package's `exposePreviewTool`.
 */
export interface ExposeForgePreviewInput {
  threadId: string
}

/**
 * The env `exposeForgePreview` needs: the `Sandbox` binding (same as
 * {@link ForgeSandboxEnv}) plus an optional `PREVIEW_HOSTNAME` override for
 * the custom wildcard domain `exposePort` mints preview URLs under.
 */
export type ExposeForgePreviewEnv = ForgeSandboxEnv & {
  PREVIEW_HOSTNAME?: string
}

/**
 * Build the `exposeForgePreview` server tool for one run. Addresses the
 * run's sandbox by `threadId` (the same id `buildForgeSandbox` derives the
 * sandbox definition from) and exposes the given port on our custom wildcard
 * domain via `sandbox.exposePort(port, { hostname })` — NOT a quick tunnel.
 *
 * Closes over the run's `input` + `env`, so build it inside the `tools`
 * resolver (`tools: (input, env) => [exposeForgePreview(input, env)]`).
 */
export function exposeForgePreview(
  input: ExposeForgePreviewInput,
  env: ExposeForgePreviewEnv,
) {
  return toolDefinition({
    name: 'exposeForgePreview',
    description:
      'Expose a port a dev server is listening on inside the sandbox and return a public preview URL on our forge.tanstack.com domain to show the user. Call this AFTER the server is up.',
    inputSchema: z.object({
      port: z
        .number()
        .int()
        .min(1024)
        .max(65535)
        .describe('The port the dev server is listening on, e.g. 5173.'),
    }),
  }).server(async ({ port }) => {
    // `PREVIEW_HOSTNAME` is normally absent (`undefined`), in which case we
    // fall back to the literal Forge domain below. But if it IS present and
    // resolves to an empty/whitespace-only string — a misconfiguration, e.g.
    // an env var set to `''` — fail loudly instead of silently minting a
    // preview URL under an unintended hostname.
    if (
      env.PREVIEW_HOSTNAME !== undefined &&
      env.PREVIEW_HOSTNAME.trim().length === 0
    ) {
      throw new Error(
        'exposeForgePreview: PREVIEW_HOSTNAME is set but empty. Unset it entirely to use the forge.tanstack.com default, or provide a real hostname.',
      )
    }

    const hostname =
      env.PREVIEW_HOSTNAME?.trim() || DEFAULT_FORGE_PREVIEW_HOSTNAME

    const sandbox = getSandbox(env.Sandbox, input.threadId)

    const { url } = await sandbox.exposePort(port, { hostname })
    return { url }
  })
}
