import { z } from 'zod'
import type { TokenUsage } from '@tanstack/ai'
import type { CacheUsage, UsageStep } from '../core/usage'
export type Usage = Partial<TokenUsage> & {
  cacheUsage?: CacheUsage
  /** Anthropic creation replaces ordinary input billing. Other write contracts
   * need their own reviewed pricing semantics before they can be estimated. */
  cacheWriteTreatment?: 'replacement'
  /** Invalid or unsupported billing evidence. */
  cacheBillingUnpriced?: boolean
}
export type Rates = Record<
  string,
  {
    inputPerMillion: number
    outputPerMillion: number
    cacheReadPerMillion?: number
    cacheWritePerMillion?: number
    cacheWrite5mPerMillion?: number
    cacheWrite1hPerMillion?: number
    source: string
  }
>
export const defaultRates: Rates = {
  'included/@cf/zai-org/glm-5.3-flash': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.5,
    source:
      'Cloudflare published uncached rates, checked 2026-09-23: https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/',
  },
  'included/@cf/moonshotai/kimi-k2.6': {
    inputPerMillion: 0.95,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.16,
    source:
      'Cloudflare published input, cached input and output rates, checked 2026-09-23: https://developers.cloudflare.com/workers-ai/models/kimi-k2.6/',
  },
  'included/@cf/openai/gpt-oss-120b': {
    inputPerMillion: 0.35,
    outputPerMillion: 0.75,
    source:
      'Cloudflare published rates, checked 2026-09-22: https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/',
  },
  'typesafe/jev-latest': {
    inputPerMillion: 0.042,
    outputPerMillion: 0,
    source:
      'TypeSafe Jev 1.13 published rate, checked 2026-09-22: https://docs.typesafe.ai/models',
  },
  'typesafe/jev-1.13.0': {
    inputPerMillion: 0.042,
    outputPerMillion: 0,
    source:
      'TypeSafe Jev 1.13 published rate, checked 2026-09-22: https://docs.typesafe.ai/models',
  },
  'included/@cf/zai-org/glm-4.7-flash': {
    inputPerMillion: 0.0605,
    outputPerMillion: 0.4,
    source: 'Cloudflare published rates, checked 2026-09-21',
  },
}
export function configuredRates(raw?: string): Rates {
  const overrides = raw
    ? z
        .record(
          z.string(),
          z.object({
            inputPerMillion: z.number().finite().nonnegative(),
            outputPerMillion: z.number().finite().nonnegative(),
            cacheReadPerMillion: z.number().finite().nonnegative().optional(),
            cacheWritePerMillion: z.number().finite().nonnegative().optional(),
            cacheWrite5mPerMillion: z
              .number()
              .finite()
              .nonnegative()
              .optional(),
            cacheWrite1hPerMillion: z
              .number()
              .finite()
              .nonnegative()
              .optional(),
            source: z.string().min(1).max(300),
          }),
        )
        .parse(JSON.parse(raw))
    : {}
  return { ...defaultRates, ...overrides }
}
const valid = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0
function estimatedInputCost(usage: Usage, input: number, rate: Rates[string]) {
  const cache = usage.cacheUsage
  const read = cache?.readTokens ?? 0
  const write = cache?.writeTokens ?? 0
  if (!valid(read) || !valid(write) || read + write > input) return undefined
  const price = (count: number, unit: number | undefined) =>
    count === 0 ? 0 : valid(unit) ? count * unit : undefined
  const reads = price(read, rate.cacheReadPerMillion)
  if (reads === undefined) return undefined
  let writes = 0
  if (write > 0) {
    if (usage.cacheWriteTreatment !== 'replacement') return undefined
    const short = cache?.write5mTokens
    const long = cache?.write1hTokens
    if (short !== undefined && long !== undefined) {
      if (!valid(short) || !valid(long) || short + long !== write)
        return undefined
      const shortCost = price(
        short,
        rate.cacheWrite5mPerMillion ?? rate.cacheWritePerMillion,
      )
      const longCost = price(
        long,
        rate.cacheWrite1hPerMillion ?? rate.cacheWritePerMillion,
      )
      if (shortCost === undefined || longCost === undefined) return undefined
      writes = shortCost + longCost
    } else {
      const cost = price(write, rate.cacheWritePerMillion)
      if (cost === undefined) return undefined
      writes = cost
    }
  }
  return (input - read - write) * rate.inputPerMillion + reads + writes
}
export function usageFields(
  usage: Usage | undefined,
  provider: string,
  model: string | undefined,
  rates: Rates = {},
): Pick<UsageStep, 'inputTokens' | 'outputTokens' | 'totalTokens' | 'cost'> {
  const inputTokens = valid(usage?.promptTokens)
    ? usage.promptTokens
    : undefined
  const outputTokens = valid(usage?.completionTokens)
    ? usage.completionTokens
    : undefined
  const totalTokens = valid(usage?.totalTokens) ? usage.totalTokens : undefined
  const rate = rates[`${provider}/${model}`]
  const inputCost =
    usage && rate && inputTokens !== undefined
      ? estimatedInputCost(usage, inputTokens, rate)
      : undefined
  const cost: UsageStep['cost'] = valid(usage?.cost)
    ? { status: 'known', usd: usage.cost, source: 'Provider-reported' }
    : !usage?.cacheBillingUnpriced &&
        inputCost !== undefined &&
        outputTokens !== undefined &&
        rate &&
        valid(rate.inputPerMillion) &&
        valid(rate.outputPerMillion) &&
        rate.source
      ? {
          status: 'estimated',
          usd: (inputCost + outputTokens * rate.outputPerMillion) / 1e6,
          source: rate.source,
        }
      : { status: 'unavailable' }
  return { inputTokens, outputTokens, totalTokens, cost }
}
