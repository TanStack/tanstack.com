import { kodyDiscovery } from './kody'
import type { DiscoveryIntegration } from './contract'

const integrations: Record<string, DiscoveryIntegration> = {
  kody: kodyDiscovery,
}
/** Pairing is explicit connection configuration, never guessed from tool names. */
export function discoveryIntegration(id: string | undefined) {
  return id ? integrations[id] : undefined
}
