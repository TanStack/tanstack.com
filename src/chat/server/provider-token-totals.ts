import type {
  ProviderObservation,
  ProviderProtocol,
} from './provider-observation'

/** Preserve the provider field separately from a comparable whole-input count.
 * Legacy records without this version keep their original semantics. */
export function providerTokenTotals(
  protocol: ProviderProtocol,
  observation: ProviderObservation,
) {
  const rawInputTokens = observation.inputTokens
  const rawOutputTokens = observation.outputTokens
  let outputTokens = rawOutputTokens
  const cache = observation.cacheUsage
  let inputTokens = rawInputTokens
  let invalid = observation.usageInvalid
  if (protocol === 'anthropic') {
    const parts = [rawInputTokens, cache?.readTokens, cache?.writeTokens]
    inputTokens = parts.every((value) => value !== undefined)
      ? parts.reduce<number>((total, value) => total + value!, 0)
      : undefined
    if (
      cache?.write5mTokens !== undefined &&
      cache.write1hTokens !== undefined &&
      cache.writeTokens !== undefined &&
      cache.write5mTokens + cache.write1hTokens !== cache.writeTokens
    )
      invalid = true
  } else if (
    rawInputTokens !== undefined &&
    cache?.readTokens !== undefined &&
    cache.readTokens > rawInputTokens
  )
    invalid = true
  if (
    inputTokens !== undefined &&
    (!Number.isSafeInteger(inputTokens) || inputTokens < 0)
  )
    invalid = true
  if (protocol === 'gemini') {
    outputTokens =
      rawOutputTokens !== undefined && observation.thinkingTokens !== undefined
        ? rawOutputTokens + observation.thinkingTokens
        : rawInputTokens !== undefined &&
            observation.totalTokens !== undefined &&
            rawOutputTokens !== undefined
          ? observation.totalTokens - rawInputTokens
          : undefined
    if (
      outputTokens !== undefined &&
      (!Number.isSafeInteger(outputTokens) ||
        outputTokens < 0 ||
        (rawOutputTokens !== undefined && outputTokens < rawOutputTokens) ||
        (rawInputTokens !== undefined &&
          observation.totalTokens !== undefined &&
          rawInputTokens + outputTokens !== observation.totalTokens))
    )
      invalid = true
  }
  return {
    tokenAccounting: 'normalized-v1' as const,
    rawInputTokens,
    rawOutputTokens,
    outputTokens: invalid ? undefined : outputTokens,
    inputTokens: invalid ? undefined : inputTokens,
    ...(invalid ? { usageInvalid: true } : {}),
  }
}
