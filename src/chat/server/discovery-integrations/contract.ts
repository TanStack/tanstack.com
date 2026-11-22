import { z } from 'zod'
import type { CatalogEntry } from '../mcp-catalog'

/** TanChat's internal contract, not an MCP protocol extension. */
export const discoveryPageSchema = z.object({
  version: z.literal(1),
  coverage: z.enum(['partial', 'complete']),
  entries: z.array(
    z.object({
      identity: z.string().min(1),
      kind: z.enum(['group', 'capability', 'documentation']),
      name: z.string().min(1),
      description: z.string(),
      evidence: z.string().min(1),
      invocation: z.string(),
      next: z
        .object({ arguments: z.record(z.string(), z.unknown()) })
        .optional(),
    }),
  ),
})
export type DiscoveryPage = z.infer<typeof discoveryPageSchema>
export interface DiscoveryIntegration {
  id: string
  version: number
  supports(entry: CatalogEntry): boolean
  initialArguments?(objective: string): Record<string, unknown>
  enumerate?(context: InventoryContext): Promise<InventoryResult>
  describe?(
    entity: string,
    call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ): Promise<unknown>
  prepare?(
    entry: CatalogEntry,
    call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ): Promise<PreparedMcpOperation>
  parse(raw: unknown): DiscoveryPage
}
export interface DiscoveryDiagnostic {
  code: 'UNSUPPORTED_DISCOVERY_SHAPE'
  integration: string
  version: number
  serverId: string
  entryId: string
  shape: string
}
export class UnsupportedDiscoveryShape extends Error {
  constructor() {
    super('The paired discovery integration does not recognize this response.')
    this.name = 'UnsupportedDiscoveryShape'
  }
}
/** Types and array structure only. No values or server-controlled field names. */
export function responseShape(value: unknown, depth = 0): string {
  if (value === null) return 'null'
  if (depth >= 4) return Array.isArray(value) ? 'array' : typeof value
  if (Array.isArray(value))
    return (
      '[' +
      [...new Set(value.slice(0, 8).map((v) => responseShape(v, depth + 1)))]
        .sort()
        .join('|') +
      ']'
    )
  if (typeof value === 'object')
    return (
      '{' +
      Object.values(value)
        .slice(0, 30)
        .map((v) => responseShape(v, depth + 1))
        .sort()
        .join(',') +
      '}'
    )
  return typeof value
}

export interface InventoryResult {
  version: number
  entries: CatalogEntry[]
  complete: boolean
  warnings: string[]
  counts: Record<string, number>
}
export interface InventoryContext {
  entries: CatalogEntry[]
  call(entry: CatalogEntry, args: Record<string, unknown>): Promise<unknown>
}

export interface PreparedMcpOperation {
  entry: CatalogEntry
  toCall(args: Record<string, unknown>): {
    name: string
    arguments: Record<string, unknown>
  }
}
