import { Validator } from '@cfworker/json-schema'
import { callKey } from '../core/assistant-task'
import { hash } from './crypto'

/** Host-only evidence from the same authorized lookup that supplied the page. */
export type StoredResultObserver = (evidence: {
  args: { sourceDigest: string; path: string; offset: number; query?: string }
  result: unknown
}) => Promise<void>
import type { CatalogEntry } from './mcp-catalog'
import type { TaskDependencies } from './system-one-loop'

/** The host supplies a task/account-scoped store. References never grant cross-scope access. */
export interface ResultStore {
  put(id: string, value: unknown): Promise<void>
  get(id: string): Promise<unknown | undefined>
}
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength
const pointerKey = (key: string) =>
  key.replaceAll('~', '~0').replaceAll('/', '~1')
type SearchMatch = {
  start: number
  end: number
  matchStart: number
  text: string
  context?: { start: number; end: number; value?: unknown; complete: boolean }
}
/** Extract only complete JSON objects from JSON we serialized ourselves. Never repair snippets. */
function attachJsonContexts(text: string, matches: SearchMatch[]) {
  const objects: number[] = []
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted && char === '\\') {
      index++
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === '{') objects.push(index)
    else if (char === '}') {
      const start = objects.pop()!
      const contained = matches.filter(
        (match) =>
          !match.context &&
          match.matchStart >= start &&
          match.matchStart <= index,
      )
      if (!contained.length) continue
      const end = index + 1
      const fragment = text.slice(start, end)
      const complete =
        fragment.length <= 2000 &&
        new TextEncoder().encode(fragment).byteLength <= 2000
      const context = {
        start,
        end,
        complete,
        ...(complete ? { value: JSON.parse(fragment) } : {}),
      }
      for (const match of contained) match.context = context
    }
  }
}
function atPointer(value: unknown, path: string): unknown {
  if (!path) return value
  if (!path.startsWith('/'))
    throw new Error('Use a JSON pointer from the stored result.')
  for (const encoded of path.slice(1).split('/')) {
    if (/~(?:[^01]|$)/.test(encoded)) throw new Error('Invalid JSON pointer.')
    const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~')
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
      throw new Error('Stored result path was not found.')
    value = (value as Record<string, unknown>)[key]
  }
  return value
}
function textViews(value: unknown) {
  const views: Array<{ path: string; characters: number }> = []
  let visited = 0,
    complete = true
  const walk = (item: unknown, path: string, depth: number) => {
    if (++visited > 5000 || depth > 32) {
      complete = false
      return
    }
    if (typeof item === 'string') views.push({ path, characters: item.length })
    else if (item && typeof item === 'object')
      for (const [key, child] of Object.entries(item)) {
        if (visited > 5000) {
          complete = false
          break
        }
        walk(child, path + '/' + pointerKey(key), depth + 1)
      }
  }
  walk(value, '', 0)
  views.sort(
    (a, b) => b.characters - a.characters || a.path.localeCompare(b.path),
  )
  const rootText =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  const largest = views[0]
  const largestText = largest ? (atPointer(value, largest.path) as string) : ''
  // A document-sized string is a useful default. Distributed records need the full structure.
  const structured =
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray(value.content) &&
    'structuredContent' in value &&
    value.structuredContent &&
    typeof value.structuredContent === 'object' &&
    !Array.isArray(value.structuredContent)
      ? value.structuredContent
      : undefined
  let duplicatedStructuredContent = false
  if (
    structured &&
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray(value.content) &&
    value.content.length === 1
  ) {
    const block = value.content[0]
    if (block?.type === 'text' && typeof block.text === 'string') {
      try {
        duplicatedStructuredContent =
          JSON.stringify(JSON.parse(block.text)) === JSON.stringify(structured)
      } catch {
        // Distinct prose may carry information absent from structured metadata.
      }
    }
  }
  const defaultPath = duplicatedStructuredContent
    ? '/structuredContent'
    : largest &&
        new TextEncoder().encode(largestText).byteLength * 2 >= bytes(value)
      ? largest.path
      : ''
  const leaves = views.filter((view) => view.path !== '')
  const leafLimit = structured ? 30 : 31
  return {
    defaultPath,
    views: [
      {
        path: '',
        characters: rootText.length,
        format: typeof value === 'string' ? 'text' : 'json',
      },
      ...(structured
        ? [
            {
              path: '/structuredContent',
              characters: JSON.stringify(structured, null, 2).length,
              format: 'json',
            },
          ]
        : []),
      ...leaves
        .slice(0, leafLimit)
        .map((view) => ({ ...view, format: 'text' })),
    ],
    complete: complete && leaves.length <= leafLimit,
  }
}
export class StoredResults {
  private store: ResultStore
  readonly inlineBytes: number
  private overflow: 'inline' | 'reject'
  constructor(
    store: ResultStore,
    inlineBytes = 12000,
    overflow: 'inline' | 'reject' = 'inline',
  ) {
    this.store = store
    this.inlineBytes = inlineBytes
    this.overflow = overflow
  }
  async has(id: string) {
    return (await this.store.get(id)) !== undefined
  }
  async retain(value: unknown) {
    const size = bytes(value)
    if (size <= this.inlineBytes) return value
    // Preserve the existing explicit loop budget failure if the host cannot archive this size.
    if (size > 4 * 1024 * 1024) {
      if (this.overflow === 'reject')
        throw new Error(
          'The tool result exceeds the 4 MiB storage limit. Request a smaller page or narrower result.',
        )
      return value
    }
    const id = 'result_' + crypto.randomUUID()
    await this.store.put(id, value)
    const { views, complete, defaultPath } = textViews(value)
    return {
      kind: 'stored-tool-result',
      resultId: id,
      bytes: size,
      contentInspected: false,
      initialOffset: 0,
      defaultPath,
      views,
      viewsComplete: complete,
      notice:
        'The full tool result was retrieved and preserved. Its contents are not shown here. Use search_stored_result or read_stored_result for content evidence. Storage alone does not answer a question about its contents.',
    }
  }
  private async view(id: string, path?: string) {
    const value = await this.store.get(id)
    if (value === undefined)
      throw new Error('Stored result is unavailable in this task.')
    const selectedPath = path ?? textViews(value).defaultPath
    const selected = atPointer(value, selectedPath)
    const text =
      typeof selected === 'string'
        ? selected
        : JSON.stringify(selected, null, 2)
    return { text, path: selectedPath, selected, source: value }
  }
  async read(
    id: string,
    path?: string,
    offset = 0,
    observe?: StoredResultObserver,
  ) {
    const {
      text,
      path: selectedPath,
      selected,
      source,
    } = await this.view(id, path)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length)
      throw new Error('Offset is outside the stored result.')
    const end = Math.min(text.length, offset + 6000)
    const result = {
      resultId: id,
      path: selectedPath,
      start: offset,
      end,
      totalCharacters: text.length,
      text: text.slice(offset, end),
      ...(offset === 0 && end === text.length && typeof selected !== 'string'
        ? { value: selected }
        : {}),
      complete: offset === 0 && end === text.length,
      nextOffset: end < text.length ? end : null,
    }
    if (observe) {
      const { resultId: _id, ...page } = result
      await observe({
        args: {
          sourceDigest: await hash(callKey(source)),
          path: selectedPath,
          offset,
        },
        result: page,
      })
    }
    return result
  }
  async search(
    id: string,
    query: string,
    path?: string,
    offset = 0,
    observe?: StoredResultObserver,
  ) {
    if (!query.trim() || query.length > 300)
      throw new Error(
        'Provide a nonempty search phrase of at most 300 characters.',
      )
    const {
      text,
      path: selectedPath,
      selected,
      source,
    } = await this.view(id, path)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length)
      throw new Error('Offset is outside the stored result.')
    // RegExp supplies original-string offsets even for Unicode case folding. User text is escaped.
    const pattern = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'giu',
    )
    pattern.lastIndex = offset
    const matches: SearchMatch[] = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      const start = Math.max(offset, match.index - 240)
      const end = Math.min(text.length, match.index + match[0].length + 360)
      matches.push({
        start,
        end,
        matchStart: match.index,
        text: text.slice(start, end),
      })
      // Advance by the match, not its excerpt, so nearby records remain visible.
      if (matches.length === 8) break
    }
    if (selected && typeof selected === 'object')
      attachJsonContexts(text, matches)
    const nextOffset =
      matches.length === 8 && pattern.lastIndex < text.length
        ? pattern.lastIndex
        : null
    const result = {
      resultId: id,
      path: selectedPath,
      query,
      searchedFrom: offset,
      matches,
      totalCharacters: text.length,
      complete: nextOffset === null,
      nextOffset,
    }
    if (observe) {
      const { resultId: _id, ...page } = result
      await observe({
        args: {
          sourceDigest: await hash(callKey(source)),
          path: selectedPath,
          offset,
          query,
        },
        result: page,
      })
    }
    return result
  }
}

const entries: CatalogEntry[] = ['read', 'search'].map((operation) => ({
  id: JSON.stringify(['gum', 'stored-result', operation]),
  serverId: 'gum-stored-results',
  serverLabel: 'Stored task results',
  kind: 'tool',
  name: operation + '_stored_result',
  title: operation === 'read' ? 'Read stored result' : 'Search stored result',
  description:
    operation === 'read'
      ? 'Read up to 6000 characters from a full tool result already stored in this task. Use its resultId and initialOffset for the first page, then nextOffset for each following page. Optional path selects a JSON pointer from its views; default is its defaultPath. An empty path reads the complete JSON structure. Does not fetch external data.'
      : 'Search a full tool result already stored in this task for an exact case-insensitive phrase. Returns up to eight matching excerpts with original offsets. Use its resultId. Optional path selects a JSON pointer; default is its defaultPath. An empty path searches the complete JSON structure. Optional offset continues a previous search. Does not fetch external data.',
  target: { method: 'tools/call', name: operation + '_stored_result' },
  inputSchema: {
    type: 'object',
    properties: {
      resultId: { type: 'string', pattern: '^result_[a-f0-9-]+$' },
      path: { type: 'string' },
      offset: {
        type: 'integer',
        minimum: 0,
        description:
          'Character position in the selected text view. Use initialOffset for the first read, or the last returned nextOffset to continue. Reusing the old position repeats the same content.',
      },
      ...(operation === 'search'
        ? { query: { type: 'string', minLength: 1, maxLength: 300 } }
        : {}),
    },
    required:
      operation === 'search' ? ['resultId', 'query'] : ['resultId', 'offset'],
    additionalProperties: false,
  },
}))

export function withStoredResults(
  catalog: CatalogEntry[],
  dependencies: TaskDependencies,
  archive: StoredResults,
) {
  if (catalog.some((entry) => entries.some((local) => local.id === entry.id)))
    throw new Error('Stored-result tool identity collision.')
  const grants = new Map<string, string>()
  const localEntry = (entry: CatalogEntry) => {
    const local = entries.find((candidate) => candidate.id === entry.id)
    if (
      local &&
      (local.serverId !== entry.serverId || local.name !== entry.name)
    )
      throw new Error('Stored-result tool identity mismatch.')
    return local
  }
  const validate = (entry: CatalogEntry, args: Record<string, unknown>) => {
    if (!new Validator(entry.inputSchema!).validate(args).valid)
      throw new Error('Invalid stored-result arguments.')
  }
  return {
    entries: [...catalog, ...entries],
    dependencies: {
      ...dependencies,
      select: async (state, candidates, signal) => {
        let available = false
        for (const observation of [
          ...state.observations,
          ...(state.context ?? []).flatMap((turn) => turn.observations),
        ]) {
          const value = observation.value
          if (
            value &&
            typeof value === 'object' &&
            'kind' in value &&
            value.kind === 'stored-tool-result' &&
            'resultId' in value &&
            typeof value.resultId === 'string' &&
            (await archive.has(value.resultId))
          ) {
            available = true
            break
          }
        }
        signal.throwIfAborted()
        return dependencies.select(
          state,
          available
            ? candidates
            : candidates.filter((entry) => !localEntry(entry)),
          signal,
        )
      },
      authorize: async (entry, args, signal) => {
        signal.throwIfAborted()
        const local = localEntry(entry)
        if (!local) return dependencies.authorize(entry, args, signal)
        validate(local, args)
        grants.set(local.id, JSON.stringify(args))
        return { allowed: true, effect: 'read' }
      },
      invoke: async (entry, args, signal) => {
        signal.throwIfAborted()
        const local = localEntry(entry)
        if (!local) {
          const result = await dependencies.invoke(entry, args, signal)
          return { ...result, value: await archive.retain(result.value) }
        }
        const grant = grants.get(local.id)
        grants.delete(local.id)
        if (grant !== JSON.stringify(args))
          throw new Error('No matching stored-result read grant.')
        validate(local, args)
        try {
          const value =
            local.name === 'read_stored_result'
              ? await archive.read(
                  args.resultId as string,
                  args.path as string | undefined,
                  args.offset as number | undefined,
                )
              : await archive.search(
                  args.resultId as string,
                  args.query as string,
                  args.path as string | undefined,
                  args.offset as number | undefined,
                )
          return { ok: true, value }
        } catch (error) {
          return {
            ok: false,
            value: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Stored result read failed.',
            },
          }
        }
      },
    } satisfies TaskDependencies,
  }
}
