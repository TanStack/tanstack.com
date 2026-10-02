import {
  toolDefinition,
  type ChatMiddleware,
  type ChatMiddlewareConfig,
} from '@tanstack/ai'
import { z } from 'zod'
import type { SkillSummary } from '../core/skills'

type Tool = ChatMiddlewareConfig['tools'][number]
export type ToolSummary = { name: string; description: string }
export type SkillDirectory = {
  status: 'ready' | 'unavailable'
  items: Array<Pick<SkillSummary, 'id' | 'name' | 'version' | 'description'>>
  limited: boolean
}

// These expose discovery, user interaction, and preserved evidence. Execution
// and domain-specific tools are loaded from the authorized inventory on demand.
const coreTools = new Set([
  'request_user_step',
  'list_skills',
  'read_skill',
  'read_stored_result',
  'search_stored_result',
  'kody_catalog',
  'kody_search',
  'list_connected_tools',
])
const shortDescription = (text: string, limit: number) =>
  text.length <= limit ? text : text.slice(0, limit - 1) + '…'

export function compactDirectory<T>(items: readonly T[], budget: number) {
  const selected: T[] = []
  let size = 2
  for (const item of items) {
    const next = JSON.stringify(item).length + (selected.length ? 1 : 0)
    if (size + next > budget) break
    selected.push(item)
    size += next
  }
  return { items: selected, limited: selected.length < items.length }
}

/** List authorized metadata only. Skill bodies still require read_skill. */
export async function readSkillDirectory(
  list: (
    cursor?: string,
  ) => Promise<{ items: SkillSummary[]; nextCursor?: string }>,
): Promise<SkillDirectory> {
  const items: SkillDirectory['items'] = []
  let cursor: string | undefined
  const seen = new Set<string>()
  try {
    do {
      const page = await list(cursor)
      items.push(
        ...page.items.map(({ id, name, version, description }) => ({
          id,
          name,
          version,
          description: shortDescription(description, 180),
        })),
      )
      const compact = compactDirectory(items, 8000)
      if (compact.limited) return { status: 'ready', ...compact }
      cursor = page.nextCursor
      if (cursor && seen.has(cursor))
        return { status: 'ready', items, limited: true }
      if (cursor) seen.add(cursor)
      // Bound database work as well as prompt size for unexpectedly empty pages.
      if (seen.size >= 8) return { status: 'ready', items, limited: true }
    } while (cursor)
    return { status: 'ready', items, limited: false }
  } catch {
    return { status: 'unavailable', items: [], limited: true }
  }
}

export function assistantToolDiscovery(options: {
  tools: Tool[]
  loadedNames?: readonly string[]
  onLoad(names: string[]): Promise<void>
}) {
  const inventory = new Map(options.tools.map((tool) => [tool.name, tool]))
  if (inventory.size !== options.tools.length)
    throw new Error('Duplicate assistant tool names.')
  const loaded = new Set(
    (options.loadedNames ?? []).filter((name) => inventory.has(name)),
  )
  const summaries = options.tools.map(({ name, description }) => ({
    name,
    description: description ?? '',
  }))
  const directory = compactDirectory(
    summaries
      .filter(({ name }) => !coreTools.has(name))
      .map(({ name, description }) => ({
        name,
        description: shortDescription(description, 180),
      })),
    12000,
  )
  const list = toolDefinition({
    name: 'list_available_tools',
    description:
      'Browse or search the native tool directory. Returns names and descriptions, not argument schemas. A blank query lists everything available to this task. Use load_tools with exact names before calling deferred tools. Kody and connected MCP catalogs expose additional capabilities.',
    inputSchema: z
      .object({
        query: z.string().max(200).default(''),
        offset: z.number().int().min(0).default(0),
      })
      .strict(),
  }).server(({ query = '', offset = 0 }) => {
    const terms = query
      .toLocaleLowerCase()
      .split(/[\s_]+/u)
      .filter(Boolean)
    const matches = summaries.filter((tool) =>
      terms.every((term) =>
        `${tool.name} ${tool.description}`.toLocaleLowerCase().includes(term),
      ),
    )
    return {
      items: matches.slice(offset, offset + 20),
      ...(offset + 20 < matches.length ? { nextOffset: offset + 20 } : {}),
    }
  })
  let loading = Promise.resolve()
  const load = toolDefinition({
    name: 'load_tools',
    description:
      'Make the named native tools and their full argument schemas available on the next model call. Choose exact names from the tool directory, and load related tools together. Tools remain loaded for this task. Loading does not execute them or grant access or approval. Wait for the next model call before using newly loaded tools.',
    inputSchema: z
      .object({ names: z.array(z.string().min(1).max(200)).min(1).max(12) })
      .strict(),
  }).server(async ({ names }) => {
    const missing = names.filter((name) => !inventory.has(name))
    if (missing.length)
      return {
        ok: false,
        error: 'Unknown or unavailable tools. Consult list_available_tools.',
        names: missing,
      }
    const operation = loading.then(async () => {
      const next = new Set([...loaded, ...names])
      // Save before exposing schemas so approvals/restarts retain the same task state.
      await options.onLoad([...next])
      for (const name of next) loaded.add(name)
      return {
        ok: true,
        loaded: [...new Set(names)],
        availableOnNextModelCall: true,
      }
    })
    loading = operation.then(
      () => {},
      () => {},
    )
    return operation
  })
  const tools = () => [
    list,
    load,
    ...options.tools.filter(
      (tool) => coreTools.has(tool.name) || loaded.has(tool.name),
    ),
  ]
  const middleware: ChatMiddleware = {
    name: 'gum-tool-discovery',
    onConfig: () => ({ tools: tools() }),
  }
  return { directory, tools, middleware }
}
