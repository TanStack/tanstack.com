import { Validator } from '@cfworker/json-schema'
import type { CatalogEntry } from './mcp-catalog'
import type { TaskDependencies, TaskState } from './system-one-loop'

export interface LocalReadTool {
  entry: CatalogEntry
  available?(state: TaskState): Promise<boolean>
  invoke(args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>
}

/** Host-owned read tools. These grants never authorize an external operation. */
export function withLocalReadTools(
  catalog: CatalogEntry[],
  dependencies: TaskDependencies,
  tools: LocalReadTool[],
) {
  const byId = new Map(tools.map((tool) => [tool.entry.id, tool]))
  if (byId.size !== tools.length || catalog.some((entry) => byId.has(entry.id)))
    throw new Error('Local tool identity collision.')
  const grants = new Map<string, string>()
  const local = (entry: CatalogEntry) => {
    const tool = byId.get(entry.id)
    if (
      tool &&
      (entry.serverId !== tool.entry.serverId || entry.name !== tool.entry.name)
    )
      throw new Error('Local tool identity mismatch.')
    return tool
  }
  const validate = (tool: LocalReadTool, args: Record<string, unknown>) => {
    if (
      !tool.entry.inputSchema ||
      !new Validator(tool.entry.inputSchema).validate(args).valid
    )
      throw new Error('Invalid local tool arguments.')
  }
  return {
    entries: [...catalog, ...tools.map((tool) => tool.entry)],
    dependencies: {
      ...dependencies,
      select: async (state, candidates, signal) => {
        const eligible: CatalogEntry[] = []
        for (const entry of candidates) {
          const tool = local(entry)
          if (!tool?.available || (await tool.available(state)))
            eligible.push(entry)
        }
        signal.throwIfAborted()
        return dependencies.select(state, eligible, signal)
      },
      authorize: async (entry, args, signal) => {
        signal.throwIfAborted()
        const tool = local(entry)
        if (!tool) return dependencies.authorize(entry, args, signal)
        validate(tool, args)
        grants.set(entry.id, JSON.stringify(args))
        return { allowed: true, effect: 'read' }
      },
      invoke: async (entry, args, signal) => {
        signal.throwIfAborted()
        const tool = local(entry)
        if (!tool) return dependencies.invoke(entry, args, signal)
        const grant = grants.get(entry.id)
        grants.delete(entry.id)
        if (grant !== JSON.stringify(args))
          throw new Error('No matching local read grant.')
        validate(tool, args)
        try {
          return { ok: true, value: await tool.invoke(args, signal) }
        } catch (error) {
          signal.throwIfAborted()
          return {
            ok: false,
            value: {
              error:
                error instanceof Error ? error.message : 'Local read failed.',
            },
          }
        }
      },
    } satisfies TaskDependencies,
  }
}
