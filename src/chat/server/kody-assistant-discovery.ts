import type { ReferenceCatalog } from '../core/message-references'
import type { KodySkillSuggestion } from './kody-skill-catalog'
import { searchKodySkillSuggestions } from './kody-skill-catalog'

/** Keep action and skill discovery independent when one Kody source fails. */
export async function kodyAssistantDiscovery(
  loadReferences: () => Promise<ReferenceCatalog>,
  loadSkills: () => Promise<KodySkillSuggestion[]>,
) {
  const [references, skills] = await Promise.allSettled([
    loadReferences(),
    loadSkills(),
  ])
  const listed = references.status === 'fulfilled' ? references.value : null
  const skillItems = skills.status === 'fulfilled' ? skills.value : []
  return {
    status: listed?.kodyStatus ?? 'unavailable',
    accountObjectsStatus: listed?.kodyObjectsStatus ?? 'unavailable',
    entries: (listed?.items ?? []).map((item) =>
      item.kind === 'kody'
        ? {
            entity: item.entity,
            operation: item.operation,
            label: item.label,
            detail: item.detail,
          }
        : item,
    ),
    more: listed?.more ?? false,
    skillsStatus: skills.status === 'fulfilled' ? 'ready' : 'unavailable',
    skills: skillItems.slice(0, 20).map((skill) => ({
      skillId: skill.id,
      version: skill.version,
      name: skill.name,
      description: skill.description,
      nextTool: 'read_skill' as const,
    })),
    skillsMore: skillItems.length > 20,
  }
}

/** Read the matching source first, while leaving misses on the complete refresh path. */
export async function discoverKodyAssistantCatalog(input: {
  query: string
  loadCachedSkills: () => Promise<{
    status: 'ready' | 'stale' | 'missing'
    items: KodySkillSuggestion[]
  }>
  loadSkills: () => Promise<KodySkillSuggestion[]>
  loadCachedReferences: () => Promise<ReferenceCatalog>
  loadReferences: () => Promise<ReferenceCatalog>
}) {
  const match = (skills: KodySkillSuggestion[]) =>
    searchKodySkillSuggestions(skills, input.query, 21)
  if (input.query) {
    const cached = await input.loadCachedSkills().catch(() => null)
    const candidates = cached ? match(cached.items) : []
    if (candidates.length) {
      if (cached?.status === 'ready')
        return kodyAssistantDiscovery(
          input.loadCachedReferences,
          async () => candidates,
        )
      if (cached?.status === 'stale') {
        try {
          const refreshed = match(await input.loadSkills())
          if (refreshed.length)
            return kodyAssistantDiscovery(
              input.loadCachedReferences,
              async () => refreshed,
            )
        } catch {
          return kodyAssistantDiscovery(input.loadCachedReferences, () =>
            Promise.reject(new Error('Kody skills could not be refreshed.')),
          )
        }
      }
    }
  }
  return kodyAssistantDiscovery(input.loadReferences, async () =>
    match(await input.loadSkills()),
  )
}
