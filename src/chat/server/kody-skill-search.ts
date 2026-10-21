import { z } from 'zod'

const matchSchema = z.object({
  type: z.literal('retriever_result'),
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  summary: z.string().max(1024),
  source: z.string().max(200),
  packageId: z.string().uuid(),
  kodyId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^:\s]+$/u),
  retrieverKey: z.string().min(1).max(200),
})
const retrieverSchema = z.object({
  id: z.string().min(1).max(200),
  packageId: z.string().uuid(),
  metadata: z.object({ skill_id: z.string().min(1).max(200) }),
})
export type KodySkillMatch = {
  id: string
  name: string
  description: string
  source: 'kody'
  packageId: string
  packageEntity: string
  retrieverKey: string
}

/** Kody retrievers describe external skills, but their text does not activate one. */
export function kodySkillMatches(response: unknown): KodySkillMatch[] {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          matches: z.array(z.unknown()).max(200),
          memories: z.object({
            retrieverResults: z.array(z.unknown()).max(200),
          }),
        }),
      }),
    })
    .parse(response)
  if (envelope.isError) throw new Error('Kody skill search failed.')
  const skillKeys = new Set(
    envelope.structuredContent.result.memories.retrieverResults.flatMap(
      (value) => {
        const parsed = retrieverSchema.safeParse(value)
        return parsed.success
          ? [JSON.stringify([parsed.data.packageId, parsed.data.id])]
          : []
      },
    ),
  )
  const matches: KodySkillMatch[] = []
  for (const value of envelope.structuredContent.result.matches) {
    const parsed = matchSchema.safeParse(value)
    if (
      !parsed.success ||
      !skillKeys.has(JSON.stringify([parsed.data.packageId, parsed.data.id]))
    )
      continue
    const { id, title, summary, packageId, kodyId, retrieverKey } = parsed.data
    matches.push({
      id,
      name: title,
      description: summary,
      source: 'kody',
      packageId,
      packageEntity: `package:${kodyId}`,
      retrieverKey,
    })
    if (matches.length === 20) break
  }
  return matches
}

export function kodySkillQuery(query: string) {
  return query
    .replace(/\bskills?\b/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

export async function searchKodySkillMatches(
  query: string,
  search: (query: string) => Promise<unknown>,
) {
  const compact = kodySkillQuery(query)
  const original = query.replace(/\s+/gu, ' ').trim()
  for (const candidate of new Set([compact, original].filter(Boolean))) {
    const matches = kodySkillMatches(await search(candidate))
    if (matches.length) return matches
  }
  return []
}
