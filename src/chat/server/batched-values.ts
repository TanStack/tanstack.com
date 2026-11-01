import type { GroundedValue } from './value-candidates'

export class ValueDecisionBudgetError extends Error {}

export function valueChoices(values: GroundedValue[]) {
  return Object.fromEntries([
    [
      'unresolved',
      'No value in this batch is justified by the request and available evidence. Omit an optional field; ask for a missing required value.',
    ],
    ...values.map((value) => [
      value.id,
      JSON.stringify({
        value: value.value,
        source: value.source,
        otherSources: value.otherSources,
      }),
    ]),
  ])
}

/** Compares finalists together. Probabilities from separate batches are never compared. */
export async function chooseBatchedValue(options: {
  state: unknown
  values: GroundedValue[]
  signal: AbortSignal
  maxCandidates?: number
  maxBytes?: number
  maxCalls?: number
  choose: (
    values: GroundedValue[],
  ) => Promise<{ id: string; probability: number | null }>
}) {
  const maxCandidates = options.maxCandidates ?? 200
  const maxBytes = options.maxBytes ?? 48_000
  const maxCalls = options.maxCalls ?? 64
  if (
    ![maxCandidates, maxBytes, maxCalls].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    maxCandidates < 2
  )
    throw new Error('Invalid value decision limits.')
  if (
    new Set(options.values.map((v) => v.id)).size !== options.values.length ||
    options.values.some((v) => v.id === 'unresolved')
  )
    throw new Error('Invalid value identities.')
  const size = (values: GroundedValue[]) =>
    new TextEncoder().encode(
      JSON.stringify({ state: options.state, choices: valueChoices(values) }),
    ).byteLength + 2048
  if (size([]) > maxBytes)
    throw new ValueDecisionBudgetError(
      'Argument evidence alone exceeds the decision byte budget.',
    )
  let remaining = options.values
  let calls = 0
  let rounds = 0
  while (remaining.length) {
    options.signal.throwIfAborted()
    const batches: GroundedValue[][] = []
    let batch: GroundedValue[] = []
    for (const value of remaining) {
      if (size([value]) > maxBytes)
        throw new ValueDecisionBudgetError(
          'One argument value exceeds the decision byte budget. No value was truncated.',
        )
      if (
        batch.length &&
        (batch.length >= maxCandidates || size([...batch, value]) > maxBytes)
      ) {
        batches.push(batch)
        batch = []
      }
      batch.push(value)
    }
    if (batch.length) batches.push(batch)
    if (calls + batches.length > maxCalls)
      throw new ValueDecisionBudgetError(
        'Argument selection call budget exhausted.',
      )
    rounds++
    const survivors: GroundedValue[] = []
    for (const values of batches) {
      options.signal.throwIfAborted()
      const decision = await options.choose(values)
      calls++
      options.signal.throwIfAborted()
      const selected = values.find((v) => v.id === decision.id) ?? null
      if (decision.id !== 'unresolved' && !selected)
        throw new Error('Jev selected a value outside the supplied batch.')
      if (batches.length === 1)
        return { selected, probability: decision.probability, calls, rounds }
      if (selected) survivors.push(selected)
    }
    if (survivors.length >= remaining.length)
      throw new ValueDecisionBudgetError(
        'Argument batches cannot shrink within the byte budget.',
      )
    remaining = survivors
  }
  return { selected: null, probability: null, calls, rounds }
}
