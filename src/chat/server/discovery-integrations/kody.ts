import { prepareKodyOperation } from './kody-contract'
import { enumerateKody } from './kody-inventory'
import { z } from 'zod'
import {
  discoveryPageSchema,
  UnsupportedDiscoveryShape,
  type DiscoveryIntegration,
  type DiscoveryPage,
} from './contract'

const rowSchema = z
  .object({
    type: z.enum([
      'domain',
      'capability',
      'package',
      'guide',
      'integration',
      'secret',
      'mcp-server',
    ]),
    id: z.string().min(1),
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    entityRef: z.string().min(1).optional(),
    usage: z.string().optional(),
    executeExample: z.string().optional(),
    inputTypeDefinition: z.string().optional(),
    outputTypeDefinition: z.string().optional(),
  })
  .passthrough()

export const kodyDiscovery: DiscoveryIntegration = {
  id: 'kody',
  prepare: prepareKodyOperation,
  enumerate: enumerateKody,
  version: 2,
  describe: (entity, call) => {
    if (!/^(capability|package):[^\s]{1,300}$/.test(entity))
      throw new Error('Unsupported contract reference.')
    return call('search', { entity })
  },
  initialArguments: (query) => ({ query }),
  supports: (entry) => entry.kind === 'tool' && entry.name === 'search',
  parse(raw) {
    const envelope = z
      .object({
        isError: z.boolean().optional(),
        structuredContent: z.object({ result: z.unknown() }),
      })
      .safeParse(raw)
    if (!envelope.success || envelope.data.isError)
      throw new UnsupportedDiscoveryShape()
    const result = envelope.data.structuredContent.result
    const packageIndex = z
      .object({
        kind: z.literal('entity'),
        type: z.literal('package'),
        detailMode: z.literal('index'),
        entityRef: z.string().min(1),
        title: z.string(),
        exports: z.array(
          z.object({ subpath: z.string().min(1), description: z.string() }),
        ),
      })
      .safeParse(result)
    if (packageIndex.success) {
      const row = packageIndex.data
      return discoveryPageSchema.parse({
        version: 1,
        coverage: 'partial',
        entries: row.exports.map((exp) => ({
          identity: row.entityRef + '#' + exp.subpath,
          kind: 'capability',
          name: row.title + ' ' + exp.subpath,
          description: exp.description,
          evidence: JSON.stringify(exp),
          invocation: '',
          next: { arguments: { entity: row.entityRef + '#' + exp.subpath } },
        })),
      })
    }
    const exported = z
      .object({
        kind: z.literal('entity'),
        type: z.literal('package'),
        detailMode: z.literal('export'),
        entityRef: z.string().min(1),
        importSpecifier: z.string().min(1),
        description: z.string().optional(),
        usage: z.string().optional(),
        executeExample: z.string().optional(),
        followUp: z.string().optional(),
        functions: z
          .array(
            z.object({
              name: z.string().min(1),
              description: z.string().optional(),
              typeDefinition: z.string().nullable().optional(),
            }),
          )
          .min(1),
        referencedTypes: z
          .array(z.object({ definition: z.string() }))
          .optional(),
      })
      .safeParse(result)
    if (exported.success) {
      const row = exported.data
      return discoveryPageSchema.parse({
        version: 1,
        coverage: 'partial',
        entries: row.functions.map((fn) => ({
          identity: JSON.stringify([row.importSpecifier, fn.name]),
          kind: 'capability',
          name: row.importSpecifier + '#' + fn.name,
          description: fn.description ?? row.description ?? '',
          evidence: JSON.stringify(result),
          invocation: [
            row.usage,
            row.executeExample,
            fn.typeDefinition,
            ...(row.referencedTypes ?? []).map((t) => t.definition),
            row.followUp,
          ]
            .filter(Boolean)
            .join('\n'),
        })),
      })
    }
    const listing = z
      .object({ matches: z.array(z.unknown()) })
      .safeParse(result)
    const entity = z.object({ kind: z.literal('entity') }).safeParse(result)
    if (!listing.success && !entity.success)
      throw new UnsupportedDiscoveryShape()
    const rows = listing.success ? listing.data.matches : [result]
    const entries: DiscoveryPage['entries'] = rows.map((rawRow) => {
      const parsed = rowSchema.safeParse(rawRow)
      if (!parsed.success) throw new UnsupportedDiscoveryShape()
      const row = parsed.data
      // Use returned refs verbatim. Deployed and public-doc ref syntax can differ.
      if (row.type !== 'domain' && !row.entityRef)
        throw new UnsupportedDiscoveryShape()
      const isDetail = !listing.success
      // Package exports and guide sections still need the interpretation fallback.
      if (isDetail && row.type !== 'capability')
        throw new UnsupportedDiscoveryShape()
      return {
        identity: row.entityRef ?? 'domain:' + row.id,
        kind:
          row.type === 'domain'
            ? 'group'
            : row.type === 'capability'
              ? 'capability'
              : 'documentation',
        name: row.title ?? row.name ?? row.id,
        description: row.description ?? '',
        evidence: JSON.stringify(rawRow),
        // This remains documentation. It is never an executable MCP tool contract.
        invocation:
          isDetail && row.type === 'capability'
            ? [
                row.usage,
                row.executeExample,
                row.inputTypeDefinition,
                row.outputTypeDefinition,
              ]
                .filter(Boolean)
                .join('\n')
            : '',
        ...(!isDetail
          ? {
              next: {
                arguments:
                  row.type === 'domain'
                    ? { domain: row.id }
                    : { entity: row.entityRef },
              },
            }
          : {}),
      }
    })
    return discoveryPageSchema.parse({
      version: 1,
      coverage: 'partial',
      entries,
    })
  },
}
