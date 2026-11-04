import { z } from 'zod'
import { Validator } from '@cfworker/json-schema'
import type { CatalogEntry } from './mcp-catalog'
import {
  discoveryPageSchema,
  responseShape,
  UnsupportedDiscoveryShape,
  type DiscoveryIntegration,
  type DiscoveryDiagnostic,
} from './discovery-integrations/contract'

const callSchema = z.object({
  entryId: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
  purpose: z.string().min(1).max(1000),
})
export const interpretationSchema = z.object({
  message: z.string().max(2000),
  capabilities: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        description: z.string().min(1).max(2000),
        evidence: z.string().min(8).max(4000),
        invocation: z.string().max(6000),
      }),
    )
    .max(40),
  next: z.array(callSchema).max(3),
})
export type Interpretation = z.infer<typeof interpretationSchema>
export type DiscoveryCall = z.infer<typeof callSchema>
export interface DiscoveryObservation {
  entry: CatalogEntry
  call: DiscoveryCall
  response: string
}
export interface DiscoveryDependencies {
  choose(entries: CatalogEntry[], objective: string): Promise<string[]>
  interpret(
    entries: CatalogEntry[],
    observations: DiscoveryObservation[],
  ): Promise<Interpretation>
  invoke(entry: CatalogEntry, args: Record<string, unknown>): Promise<unknown>
  onDiagnostic?(diagnostic: DiscoveryDiagnostic): Promise<void>
  integrationFor?(entry: CatalogEntry): DiscoveryIntegration | undefined
  trustedServers: Set<string>
  signal: AbortSignal
}
export const discoveryLimits = {
  rounds: 3,
  calls: 6,
  parallel: 3,
  responseChars: 24000,
}

/** All automatically invoked entries must come from the authenticated MCP listing. */
export function discoveryReadable(entry: CatalogEntry, trusted: Set<string>) {
  if (!trusted.has(entry.serverId) || entry.discovered) return false
  if (entry.kind === 'prompt' || entry.kind === 'resource') return true
  return (
    entry.kind === 'tool' &&
    entry.annotations?.readOnlyHint === true &&
    entry.annotations?.destructiveHint === false
  )
}
export function discoveryArguments(entry: CatalogEntry, call: DiscoveryCall) {
  const args = z.record(z.string(), z.unknown()).parse(call.arguments)
  if (entry.kind === 'tool') {
    if (
      !entry.inputSchema ||
      !new Validator(entry.inputSchema).validate(args).valid
    )
      throw new Error(
        'Discovery arguments do not match the advertised input schema.',
      )
  } else if (entry.kind === 'prompt') {
    const parameters = z
      .array(z.object({ name: z.string(), required: z.boolean().optional() }))
      .parse(entry.arguments ?? [])
    if (
      Object.entries(args).some(
        ([key, value]) =>
          typeof value !== 'string' || !parameters.some((p) => p.name === key),
      ) ||
      parameters.some((p) => p.required && !(p.name in args))
    )
      throw new Error('Discovery arguments do not match the advertised prompt.')
  } else if (entry.kind !== 'resource' || Object.keys(args).length) {
    throw new Error('This entry cannot be read by automatic discovery.')
  }
  return args
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export function discoveredEntries(
  interpretation: Interpretation,
  observations: DiscoveryObservation[],
): CatalogEntry[] {
  return interpretation.capabilities.map((capability) => {
    const source = observations.find((o) =>
      o.response.includes(capability.evidence),
    )
    if (!source)
      throw new Error('A discovered capability lacks matching source evidence.')
    return {
      id: JSON.stringify([
        source.entry.serverId,
        'discovered',
        source.entry.id,
        capability.name,
      ]),
      serverId: source.entry.serverId,
      serverLabel: source.entry.serverLabel,
      kind: 'capability',
      name: capability.name,
      title: capability.name,
      description: capability.description,
      // This target identifies the discovery source, not a newly callable MCP tool.
      target: source.entry.target,
      discovered: {
        sourceId: source.entry.id,
        sourceArguments: source.call.arguments,
        evidence: capability.evidence,
        invocation: capability.invocation,
        verified: false,
      },
    }
  })
}
export async function discoverRecursively(
  entries: CatalogEntry[],
  objective: string,
  dependencies: DiscoveryDependencies,
) {
  const { signal } = dependencies
  signal.throwIfAborted()
  const available = entries.filter((e) =>
    discoveryReadable(e, dependencies.trustedServers),
  )
  const found = new Map(entries.map((e) => [e.id, e]))
  const visited = new Set<string>()
  const warnings: string[] = []
  const diagnostics: DiscoveryDiagnostic[] = []
  let calls = 0
  let reason = 'No relevant discovery entry was selected.'
  if (!available.length)
    return {
      candidates: [...found.values()],
      calls,
      reason,
      warnings,
      diagnostics,
    }
  const approved = new Set(await dependencies.choose(available, objective))
  const roots = available.filter((e) => approved.has(e.id))
  if (!roots.length)
    return {
      candidates: [...found.values()],
      calls,
      reason,
      warnings,
      diagnostics,
    }
  const initial = roots.flatMap((entry) => {
    const integration = dependencies.integrationFor?.(entry)
    if (!integration?.supports(entry) || !integration.initialArguments)
      return []
    return [
      {
        entryId: entry.id,
        arguments: integration.initialArguments(objective),
        purpose: 'Discover capability metadata for the original request.',
      },
    ]
  })
  let interpretation = interpretationSchema.parse(
    initial.length
      ? {
          message: 'Start with paired discovery entry points.',
          capabilities: [],
          next: initial.slice(0, discoveryLimits.parallel),
        }
      : await dependencies.interpret(roots, []),
  )
  for (let round = 0; round < discoveryLimits.rounds; round++) {
    signal.throwIfAborted()
    reason = interpretation.message
    if (!interpretation.next.length) break
    const plans = interpretation.next
      .flatMap((call) => {
        const entry = (round === 0 ? roots : available).find(
          (e) => e.id === call.entryId,
        )
        if (!entry) {
          warnings.push(
            'An unlisted or unapproved discovery target was rejected.',
          )
          return []
        }
        try {
          const args = discoveryArguments(entry, call)
          const key = stable([entry.id, args])
          if (visited.has(key)) return []
          visited.add(key)
          return [{ entry, call, args }]
        } catch {
          warnings.push('A discovery call failed input validation.')
          return []
        }
      })
      .slice(
        0,
        Math.min(discoveryLimits.parallel, discoveryLimits.calls - calls),
      )
    if (!plans.length) {
      reason = 'Discovery stopped because no new valid calls remained.'
      break
    }
    // Jev evaluates the concrete purpose and arguments before any read runs.
    const proposals = plans.map((p, i) => ({
      ...p.entry,
      id: 'planned_' + i,
      description: JSON.stringify({
        description: p.entry.description,
        purpose: p.call.purpose,
        arguments: p.args,
      }),
    }))
    const chosen = new Set(await dependencies.choose(proposals, objective))
    const batch = plans.filter((_, i) => chosen.has('planned_' + i))
    if (!batch.length) {
      reason = 'Jev did not approve further discovery.'
      break
    }
    calls += batch.length
    const results = await Promise.allSettled(
      batch.map(async ({ entry, call, args }) => {
        signal.throwIfAborted()
        const raw = await dependencies.invoke(entry, args)
        const envelope = z
          .object({
            isError: z.boolean().optional(),
            content: z.array(z.unknown()).optional(),
            structuredContent: z.unknown().optional(),
          })
          .passthrough()
          .safeParse(raw)
        const links: CatalogEntry[] = []
        if (envelope.success && !envelope.data.isError) {
          for (const block of envelope.data.content ?? []) {
            const link = z
              .object({
                type: z.literal('resource_link'),
                uri: z.string().min(1),
                name: z.string(),
                description: z.string().optional(),
              })
              .safeParse(block)
            if (link.success)
              links.push({
                id: JSON.stringify([entry.serverId, 'resource', link.data.uri]),
                serverId: entry.serverId,
                serverLabel: entry.serverLabel,
                kind: 'resource',
                name: link.data.name,
                title: link.data.name,
                description: link.data.description ?? '',
                target: { method: 'resources/read', uri: link.data.uri },
              })
          }
        }
        const response =
          envelope.success &&
          (envelope.data.content ||
            envelope.data.structuredContent !== undefined)
            ? JSON.stringify({
                isError: envelope.data.isError,
                structuredContent: envelope.data.structuredContent,
              }) +
              '\n' +
              (envelope.data.content ?? [])
                .map((block) => {
                  const text = z
                    .object({ type: z.literal('text'), text: z.string() })
                    .safeParse(block)
                  return text.success ? text.data.text : JSON.stringify(block)
                })
                .join('\n')
            : JSON.stringify(raw)
        if (response.length > discoveryLimits.responseChars)
          warnings.push(
            'A discovery response exceeded the interpretation budget and was truncated.',
          )
        return {
          entry,
          call,
          raw,
          response: response.slice(0, discoveryLimits.responseChars),
          links,
          isError: envelope.success && envelope.data.isError === true,
        }
      }),
    )
    signal.throwIfAborted()
    const fresh: Array<
      DiscoveryObservation & { raw: unknown; isError: boolean }
    > = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        fresh.push(result.value)
        for (const link of result.value.links) {
          if (!found.has(link.id)) available.push(link)
          found.set(link.id, link)
        }
      } else
        warnings.push('A discovery call failed. Other branches were preserved.')
    }
    if (!fresh.length) {
      reason = 'No discovery call returned a usable response.'
      break
    }
    const fallback: DiscoveryObservation[] = []
    const continuations: Array<{ entry: CatalogEntry; call: DiscoveryCall }> =
      []
    for (const observation of fresh) {
      const integration = dependencies.integrationFor?.(observation.entry)
      if (!integration?.supports(observation.entry) || observation.isError) {
        fallback.push(observation)
        continue
      }
      try {
        const page = discoveryPageSchema.parse(
          integration.parse(observation.raw),
        )
        for (const item of page.entries) {
          const id = JSON.stringify([
            observation.entry.serverId,
            integration.id,
            integration.version,
            item.identity,
          ])
          const candidate: CatalogEntry = {
            id,
            serverId: observation.entry.serverId,
            serverLabel: observation.entry.serverLabel,
            kind: 'capability',
            name: item.name,
            title: item.name,
            description: item.kind + ': ' + item.description,
            target: observation.entry.target,
            discovered: {
              integration: {
                id: integration.id,
                version: integration.version,
                identity: item.identity,
                kind: item.kind,
              },
              sourceId: observation.entry.id,
              sourceArguments: observation.call.arguments,
              evidence: item.evidence,
              invocation: item.invocation,
              verified: false,
            },
          }
          found.set(id, candidate)
          if (item.next)
            continuations.push({
              entry: candidate,
              call: {
                entryId: observation.entry.id,
                arguments: item.next.arguments,
                purpose: 'Inspect discovery metadata for ' + item.name,
              },
            })
        }
      } catch (error) {
        if (!(error instanceof UnsupportedDiscoveryShape)) throw error
        const diagnostic: DiscoveryDiagnostic = {
          code: 'UNSUPPORTED_DISCOVERY_SHAPE',
          integration: integration.id,
          version: integration.version,
          serverId: observation.entry.serverId,
          entryId: observation.entry.id,
          shape: responseShape(observation.raw),
        }
        diagnostics.push(diagnostic)
        await dependencies.onDiagnostic?.(diagnostic)
        warnings.push(
          'A paired discovery format was not recognized. The interpretation model handled this response instead.',
        )
        fallback.push(observation)
      }
    }
    // Unknown formats still use the model. Raw payloads stay out of its context.
    interpretation = fallback.length
      ? interpretationSchema.parse(
          await dependencies.interpret(
            available,
            fallback.map(({ entry, call, response }) => ({
              entry,
              call,
              response,
            })),
          ),
        )
      : {
          message:
            'Paired integrations decoded discovery metadata. Coverage is partial.',
          capabilities: [],
          next: [],
        }
    for (const entry of discoveredEntries(
      interpretation,
      fallback.filter((o) => !fresh.find((f) => f === o)?.isError),
    ))
      found.set(entry.id, entry)
    if (continuations.length) {
      const selected = new Set(
        await dependencies.choose(
          continuations.map((c) => c.entry),
          objective,
        ),
      )
      interpretation.next = [
        ...interpretation.next,
        ...continuations
          .filter((c) => selected.has(c.entry.id))
          .map((c) => c.call),
      ].slice(0, discoveryLimits.parallel)
    }
    reason = interpretation.message
    if (
      calls >= discoveryLimits.calls ||
      round === discoveryLimits.rounds - 1
    ) {
      if (interpretation.next.length)
        warnings.push(
          'Discovery reached its call or round limit. Coverage is incomplete.',
        )
      break
    }
  }
  return {
    candidates: [...found.values()],
    calls,
    reason,
    warnings,
    diagnostics,
  }
}
