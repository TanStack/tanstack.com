import {
  rankDiscoveredTools,
  rankingProfiles,
  selectDiscoveredTool,
  type RankingProfile,
  type ToolCandidate,
} from './tool-proposals'

export class RankingInputLimitError extends Error {
  constructor() {
    super('Ranking input exceeds the provider token limit.')
    this.name = 'RankingInputLimitError'
  }
}

/** The adapter currently wraps the HTTP response in an Error. Match only the documented 400 body. */
export function isJevInputLimitError(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    !error.message.startsWith('TypeSafe evaluate request failed: 400 ')
  )
    return false
  const start = error.message.indexOf('{')
  if (start < 0) return false
  try {
    const body = JSON.parse(error.message.slice(start))
    return body?.detail?.error_type === 'max_tokens_exceeded'
  } catch {
    return false
  }
}

export type RankingResult = Awaited<ReturnType<typeof rankDiscoveredTools>>
type Rank = (
  candidates: ToolCandidate[],
  signal: AbortSignal,
) => Promise<RankingResult>
export interface BatchLimits {
  maxCandidates: number
  maxEstimatedBytes: number
  concurrency: number
  maxCalls: number
}
export const defaultBatchLimits: BatchLimits = {
  maxCandidates: 32,
  maxEstimatedBytes: 48_000,
  concurrency: 2,
  maxCalls: 64,
}

/** Conservative byte estimate, not a token count or a provider limit guarantee. */
export function splitRankingBatches(
  request: string,
  candidates: ToolCandidate[],
  profile: RankingProfile,
  limits: BatchLimits,
) {
  for (const value of Object.values(limits))
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error('Invalid batch limits.')
  if (limits.maxCandidates < 2)
    throw new Error('Batches need room for at least two candidates.')
  const size = (text: string) => new TextEncoder().encode(text).byteLength
  const stateBytes = size(JSON.stringify({ request })) + 1024
  const primary = rankingProfiles[profile === 'dual' ? 'nextStep' : profile]
  const rubricBytes =
    size(JSON.stringify(primary)) +
    (profile === 'dual' ? size(JSON.stringify(rankingProfiles.relevance)) : 0)
  const batches: ToolCandidate[][] = []
  const seen = new Set<string>()
  let batch: ToolCandidate[] = []
  let bytes = stateBytes
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) throw new Error('Duplicate candidate identity.')
    seen.add(candidate.id)
    // Double serialization allowance covers escaping JSON inside instruction strings.
    const candidateBytes =
      size(
        JSON.stringify({
          server: candidate.serverLabel,
          kind: candidate.kind,
          name: candidate.name,
          title: candidate.title,
          description: candidate.description,
        }),
      ) * 2
    const estimated =
      rubricBytes * 2 + candidateBytes * (profile === 'dual' ? 2 : 1) + 512
    if (stateBytes + estimated > limits.maxEstimatedBytes)
      throw new Error(
        'One candidate exceeds the batch byte budget. No description was truncated.',
      )
    if (
      batch.length &&
      (batch.length >= limits.maxCandidates ||
        bytes + estimated > limits.maxEstimatedBytes)
    ) {
      batches.push(batch)
      batch = []
      bytes = stateBytes
    }
    batch.push(candidate)
    bytes += estimated
  }
  if (batch.length) batches.push(batch)
  return batches
}

export async function boundedMap<T, R>(
  items: T[],
  concurrency: number,
  signal: AbortSignal,
  operation: (item: T, index: number, signal: AbortSignal) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('Invalid concurrency.')
  const controller = new AbortController()
  const combined = AbortSignal.any([signal, controller.signal])
  const results: R[] = new Array(items.length)
  let cursor = 0
  let error: unknown
  let failed = false
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      try {
        while (cursor < items.length) {
          combined.throwIfAborted()
          const index = cursor++
          results[index] = await operation(items[index]!, index, combined)
        }
      } catch (cause) {
        if (!failed) {
          failed = true
          error = cause
          controller.abort(cause)
        }
      }
    }),
  )
  if (failed) throw error
  signal.throwIfAborted()
  return results
}

export interface BatchTrace {
  round: number
  batch: number
  durationMs: number
  result: RankingResult
}
const compare = (
  a: RankingResult['ranking'][number],
  b: RankingResult['ranking'][number],
) =>
  b.score - a.score ||
  (b.relevance?.score ?? 0) - (a.relevance?.score ?? 0) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Experimental strategies. No task action runs here and partial batches never count as a full result. */
export async function rankBatches(options: {
  request: string
  candidates: ToolCandidate[]
  profile?: RankingProfile
  strategy: 'merge' | 'halves'
  limits?: Partial<BatchLimits>
  signal: AbortSignal
  rank: Rank
}) {
  const limits = { ...defaultBatchLimits, ...options.limits }
  const trace: BatchTrace[] = []
  const rejectedBatches: Array<{
    round: number
    batch: number
    candidates: number
    durationMs: number
    reason: 'token-limit'
  }> = []
  const profile = options.profile ?? 'relevance'
  const byId = new Map(options.candidates.map((c) => [c.id, c]))
  let remaining = options.candidates
  let round = 0
  let calls = 0
  options.signal.throwIfAborted()
  while (true) {
    const batches = splitRankingBatches(
      options.request,
      remaining,
      profile,
      limits,
    )
    if (calls + batches.length > limits.maxCalls)
      throw new Error('Ranking call budget exhausted.')
    const results = await boundedMap(
      batches,
      limits.concurrency,
      options.signal,
      async (batch, index, signal) => {
        const runBatch = async (
          batch: ToolCandidate[],
        ): Promise<RankingResult['ranking']> => {
          signal.throwIfAborted()
          if (calls >= limits.maxCalls)
            throw new Error('Ranking call budget exhausted.')
          calls++
          const started = Date.now()
          let result: RankingResult
          try {
            result = await options.rank(batch, signal)
          } catch (error) {
            if (!(error instanceof RankingInputLimitError)) throw error
            rejectedBatches.push({
              round,
              batch: index,
              candidates: batch.length,
              durationMs: Date.now() - started,
              reason: 'token-limit',
            })
            if (batch.length <= 1) throw new RankingInputLimitError()
            const middle = Math.ceil(batch.length / 2)
            const left = await runBatch(batch.slice(0, middle))
            const right = await runBatch(batch.slice(middle))
            return [...left, ...right].sort(compare)
          }
          const expected = new Set(batch.map((c) => c.id))
          if (
            result.ranking.length !== expected.size ||
            new Set(result.ranking.map((r) => r.id)).size !== expected.size ||
            result.ranking.some(
              (r) => !expected.has(r.id) || !Number.isFinite(r.score),
            )
          )
            throw new Error(
              'Batch result does not cover exactly its candidates.',
            )
          trace.push({
            round,
            batch: index,
            durationMs: Date.now() - started,
            result,
          })
          return [...result.ranking].sort(compare)
        }
        return runBatch(batch)
      },
    )
    const ranking = results
      .flat()
      .sort(compare)
      .map((r, i) => ({ ...r, position: i + 1 }))
    if (options.strategy === 'merge' || batches.length <= 1) {
      return {
        selected: ranking[0] ? byId.get(ranking[0].id)! : null,
        ranking,
        calls,
        rounds: round + 1,
        rejectedBatches,
        trace: trace.sort((a, b) => a.round - b.round || a.batch - b.batch),
      }
    }
    const survivors = results.flatMap((rows) =>
      rows.slice(0, Math.ceil(rows.length / 2)),
    )
    if (survivors.length >= remaining.length)
      throw new Error('Batch limits prevent tournament progress.')
    remaining = survivors.map((r) => byId.get(r.id)!)
    round++
  }
}

export async function rankWithJevBatches(
  request: string,
  candidates: ToolCandidate[],
  env: { TYPESAFE_API_KEY: string },
  signal: AbortSignal,
  strategy: 'merge' | 'halves',
  profile: RankingProfile = 'relevance',
  limits?: Partial<BatchLimits>,
) {
  return rankBatches({
    request,
    candidates,
    profile,
    strategy,
    signal,
    limits,
    rank: async (batch, batchSignal) => {
      try {
        return await rankDiscoveredTools(
          request,
          batch,
          env,
          batchSignal,
          profile,
        )
      } catch (error) {
        if (isJevInputLimitError(error)) throw new RankingInputLimitError()
        throw error
      }
    },
  })
}

/** A genuinely shared finalist comparison, unlike another independent scoring pass. */
export async function chooseFinalists(
  request: string,
  candidates: ToolCandidate[],
  env: { TYPESAFE_API_KEY: string },
  signal: AbortSignal,
) {
  if (candidates.length > 32)
    throw new Error('Final comparison is limited to 32 candidates.')
  return selectDiscoveredTool(request, candidates, env, signal)
}
