import type { SkillSummary } from '../core/skills'
import { resultText } from './kody'
import { searchKodySkillSuggestions } from './kody-skill-catalog'
import {
  kodySkillMatches,
  kodySkillQuery,
  type KodySkillMatch,
} from './kody-skill-search'

type Snapshot = {
  status: 'ready' | 'stale' | 'missing'
  items: SkillSummary[]
}

function exactMatches(matches: KodySkillMatch[], skills: SkillSummary[]) {
  const byOrigin = new Map(
    skills.flatMap((skill) =>
      skill.kodyOrigin
        ? [
            [
              JSON.stringify([
                skill.kodyOrigin.packageId,
                skill.kodyOrigin.skillId,
              ]),
              skill,
            ] as const,
          ]
        : [],
    ),
  )
  const found = new Map<string, SkillSummary>()
  for (const match of matches) {
    const skill = byOrigin.get(JSON.stringify([match.packageId, match.id]))
    if (skill) found.set(skill.id, skill)
  }
  return [...found.values()]
}

function matchedSkills(
  retrievers: KodySkillMatch[],
  skills: SkillSummary[],
  query: string,
) {
  const fromRetriever = exactMatches(retrievers, skills)
  const fromQuery = searchKodySkillSuggestions(
    skills,
    kodySkillQuery(query),
    21,
  )
  const unique = new Map(
    [...fromRetriever, ...fromQuery].map((skill) => [skill.id, skill]),
  )
  return {
    items: [...unique.values()].slice(0, 20).map((skill) => ({
      skillId: skill.id,
      version: skill.version,
      name: skill.name,
      description: skill.description,
      nextTool: 'read_skill' as const,
    })),
    more: unique.size > 20,
    unmatchedRetrieverCount: retrievers.length - fromRetriever.length,
  }
}

/** Search synced skills alongside Kody results, preserving Kody's own evidence. */
export async function kodySearchWithSyncedSkills(
  raw: unknown,
  query: string | undefined,
  loadCached: () => Promise<Snapshot>,
  loadFresh: () => Promise<SkillSummary[]>,
) {
  const search = resultText(raw)
  let retrievers: KodySkillMatch[] = []
  try {
    retrievers = [
      ...new Map(
        kodySkillMatches(raw).map((match) => [
          JSON.stringify([match.packageId, match.id]),
          match,
        ]),
      ).values(),
    ]
  } catch {
    // A Kody search response can omit retriever metadata. The local catalog
    // still searches the same user query without treating the omission as no match.
  }
  if (!query?.trim() && !retrievers.length)
    return { search, syncedSkills: { status: 'not_searched' as const } }
  try {
    const cached = await loadCached().catch(
      (): Snapshot => ({
        status: 'missing',
        items: [],
      }),
    )
    let skills = cached.status === 'ready' ? cached.items : []
    if (
      cached.status !== 'ready' ||
      exactMatches(retrievers, skills).length < retrievers.length
    )
      skills = await loadFresh()
    return {
      search,
      syncedSkills: {
        status: 'ready' as const,
        ...matchedSkills(retrievers, skills, query ?? ''),
      },
    }
  } catch {
    return {
      search,
      syncedSkills: {
        status: 'unavailable' as const,
        reason: 'Exact synced skill versions could not be checked right now.',
      },
    }
  }
}
