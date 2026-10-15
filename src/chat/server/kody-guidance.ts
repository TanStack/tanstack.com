import type { KodyEnvironment } from './kody'
import { kodyConnection } from './kody'
import { withMcpClient } from './mcp'
import {
  assertKodyReferenceAccountUnchanged,
  kodyReferenceAccount,
  type KodyReferenceOptions,
  type KodyReferenceScope,
} from './kody-reference-access'

export function boundedKodyGuidance(value: string | undefined) {
  if (!value?.trim()) return undefined
  // Never inject half an instruction document or silently truncate its policy.
  if (new TextEncoder().encode(value).byteLength > 24000) return undefined
  return value.trim()
}

/** A fresh MCP handshake includes Kody's current built-ins and account overlay. */
export async function readKodyGuidance(
  env: KodyEnvironment,
  scope: KodyReferenceScope,
  options: KodyReferenceOptions,
  signal: AbortSignal,
) {
  const before = await kodyReferenceAccount(env, scope, options)
  if (!before.enabled) return undefined
  const guidance = await withMcpClient(
    await kodyConnection(env, scope.userId),
    async (client) => boundedKodyGuidance(client.getInstructions()),
    signal,
  )
  await assertKodyReferenceAccountUnchanged(env, scope, options, before)
  return guidance
}
