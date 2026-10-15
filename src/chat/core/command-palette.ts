import { matchSorterWithRankInfo, rankings } from 'match-sorter'

export type PaletteKind =
  | 'action'
  | 'conversation'
  | 'thread'
  | 'message'
  | 'file'
  | 'setting'
export type PaletteFilter =
  | 'all'
  | 'action'
  | 'conversation'
  | 'message'
  | 'file'
  | 'setting'
export interface PaletteCandidate {
  id: string
  label: string
  kind: PaletteKind
  detail?: string
  keywords?: string[]
  aliases?: string[]
  context?: number
  recentAt?: number
  suggested?: boolean
  disabledReason?: string
}
export interface PaletteVisit {
  id: string
  query: string
  at: number
  count: number
}
const normalizeText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
export const normalizePaletteQuery = (value: string) =>
  normalizeText(value.slice(0, 200))

/** Match quality always precedes context and personal usage. No provider-specific scores. */
export function rankPalette<T extends PaletteCandidate>(
  items: readonly T[],
  query: string,
  options: {
    filter?: PaletteFilter
    visits?: readonly PaletteVisit[]
    now?: number
    limit?: number
    diversify?: boolean
  } = {},
) {
  const text = normalizePaletteQuery(query)
  const filter = options.filter ?? 'all'
  const seen = new Set<string>()
  const eligible = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return (
      filter === 'all' ||
      item.kind === filter ||
      (filter === 'conversation' && item.kind === 'thread')
    )
  })
  const now = options.now ?? Date.now()
  const history = (id: string) => {
    const visits = (options.visits ?? []).filter(
      (v) => v.id === id && v.at <= now,
    )
    const exact = visits
      .filter((v) => v.query === text)
      .reduce((score, v) => Math.max(score, Math.min(v.count, 5)), 0)
    const recent = Math.max(0, ...visits.map((v) => v.at))
    const usage = visits.reduce(
      (score, v) =>
        score +
        Math.min(v.count, 10) * Math.exp(-(now - v.at) / (14 * 86400000)),
      0,
    )
    return { exact, recent, usage: Math.min(usage, 20) }
  }
  const base: Array<{
    item: T
    history: ReturnType<typeof history>
    rank: number
    alias: boolean
    titleMatch: boolean
  }> = eligible.map((item) => ({
    item,
    history: history(item.id),
    rank: 0,
    alias: false,
    titleMatch: false,
  }))
  let matches = base
  if (text) {
    // Match each word independently, allowing reordered words and synonyms in different fields.
    const maps = text
      .split(' ')
      .slice(0, 12)
      .map(
        (token) =>
          new Map(
            matchSorterWithRankInfo(base, token, {
              keys: [
                {
                  key: (value) =>
                    value.item.kind === 'message'
                      ? ''
                      : normalizePaletteQuery(value.item.label),
                },
                {
                  key: (value) =>
                    value.item.kind === 'message'
                      ? normalizePaletteQuery(value.item.label)
                      : '',
                  threshold: rankings.CONTAINS,
                },
                {
                  key: (value) =>
                    (value.item.aliases ?? []).map(normalizePaletteQuery),
                  maxRanking: rankings.EQUAL,
                },
                {
                  key: (value) =>
                    (value.item.keywords ?? []).map((value) =>
                      normalizeText(value.slice(0, 100000)),
                    ),
                  threshold: rankings.CONTAINS,
                  maxRanking: rankings.CONTAINS,
                },
              ],
            }).map((value) => [value.item.item.id, value]),
          ),
      )
    matches = base.flatMap((value) => {
      const words = maps.map((map) => map.get(value.item.id))
      if (words.some((word) => !word)) return []
      const alias =
        value.item.aliases?.some((a) => normalizePaletteQuery(a) === text) ??
        false
      const title = normalizePaletteQuery(value.item.label)
      const exactTitle = title === text
      const ranks = words.map((word) => word!.rank)
      return [
        {
          ...value,
          alias,
          titleMatch: words.every(
            (word) => word!.keyIndex === 0 || word!.keyIndex === 1,
          ),
          rank: exactTitle
            ? 7
            : Math.min(...ranks) +
              ranks.reduce<number>((a, b) => a + b, 0) / ranks.length / 100,
        },
      ]
    })
  } else if (filter === 'all') {
    matches = base.filter(
      ({ item, history }) => item.suggested || history.recent || item.recentAt,
    )
  }
  matches.sort(
    (a, b) =>
      Number(b.alias) - Number(a.alias) ||
      b.rank - a.rank ||
      Number(b.titleMatch) - Number(a.titleMatch) ||
      (b.item.context ?? 0) - (a.item.context ?? 0) ||
      b.history.exact - a.history.exact ||
      b.history.usage - a.history.usage ||
      (b.history.recent || b.item.recentAt || 0) -
        (a.history.recent || a.item.recentAt || 0) ||
      a.item.label.localeCompare(b.item.label) ||
      a.item.id.localeCompare(b.item.id),
  )
  const counts = new Map<PaletteKind, number>()
  return matches
    .filter((value, index) => {
      const count = counts.get(value.item.kind) ?? 0
      counts.set(value.item.kind, count + 1)
      return (
        options.diversify === false ||
        filter !== 'all' ||
        index < 5 ||
        count < 8
      )
    })
    .slice(0, options.limit ?? 40)
    .map((value) => value.item)
}

/** Only explicit selections teach the ranker. Merely highlighting a row does not. */
export function recordPaletteVisit(
  visits: readonly PaletteVisit[],
  id: string,
  query: string,
  now: number,
): PaletteVisit[] {
  const normalized = normalizePaletteQuery(query)
  const previous = visits.find((v) => v.id === id && v.query === normalized)
  return [
    {
      id,
      query: normalized,
      at: now,
      count: Math.min((previous?.count ?? 0) + 1, 100),
    },
    ...visits.filter((v) => !(v.id === id && v.query === normalized)),
  ].slice(0, 100)
}

export function parsePaletteVisits(value: string | null): PaletteVisit[] {
  if (!value || value.length > 150000) return []
  try {
    const data: unknown = JSON.parse(value)
    if (!Array.isArray(data) || data.length > 100) return []
    return data.filter(
      (v): v is PaletteVisit =>
        !!v &&
        typeof v === 'object' &&
        typeof v.id === 'string' &&
        v.id.length <= 2000 &&
        typeof v.query === 'string' &&
        v.query.length <= 200 &&
        Number.isSafeInteger(v.at) &&
        v.at >= 0 &&
        Number.isSafeInteger(v.count) &&
        v.count > 0 &&
        v.count <= 100,
    )
  } catch {
    return []
  }
}
