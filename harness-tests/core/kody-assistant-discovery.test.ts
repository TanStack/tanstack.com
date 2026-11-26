import { describe, expect, it, vi } from 'vitest'
import { skillSummarySchema } from '../../src/chat/core/skills'
import type { ReferenceCatalog } from '../../src/chat/core/message-references'
import {
  discoverKodyAssistantCatalog,
  kodyAssistantDiscovery,
} from '../../src/chat/server/kody-assistant-discovery'

const actionCatalog: ReferenceCatalog = {
  items: [
    {
      kind: 'kody',
      entity: 'capability:metaMemorySearch',
      label: 'metaMemorySearch',
      detail: 'Action · meta',
    },
  ],
  more: false,
  kodyStatus: 'ready',
  kodyObjectsStatus: 'ready',
}
const skill = skillSummarySchema.parse({
  id: 'kody:550e8400-e29b-41d4-a716-446655440000',
  version: 3,
  revision: 3,
  name: 'test-audit',
  description: 'Review tests for value and gaps.',
  enabled: true,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  kodyOrigin: {
    packageId: '149fd608-2ec1-4da1-92fb-584466097f70',
    skillId: 'test-audit',
  },
})

describe('assistant Kody discovery', () => {
  it('returns synced skill versions beside account actions without treating skills as actions', async () => {
    const result = await kodyAssistantDiscovery(
      async () => actionCatalog,
      async () => [skill],
    )
    expect(result).toMatchObject({
      status: 'ready',
      skillsStatus: 'ready',
      entries: [{ entity: 'capability:metaMemorySearch' }],
      skills: [
        {
          skillId: 'kody:550e8400-e29b-41d4-a716-446655440000',
          version: 3,
          name: 'test-audit',
          nextTool: 'read_skill',
        },
      ],
    })
    expect(result.skills[0]).not.toHaveProperty('entity')
  })

  it('keeps the healthy source visible when the other source fails', async () => {
    const skillsOnly = await kodyAssistantDiscovery(
      async () => {
        throw new Error('Inventory unavailable')
      },
      async () => [skill],
    )
    expect(skillsOnly).toMatchObject({
      status: 'unavailable',
      skillsStatus: 'ready',
      entries: [],
      skills: [{ skillId: 'kody:550e8400-e29b-41d4-a716-446655440000' }],
    })

    const actionsOnly = await kodyAssistantDiscovery(
      async () => actionCatalog,
      async () => {
        throw new Error('Skill sync unavailable')
      },
    )
    expect(actionsOnly).toMatchObject({
      status: 'ready',
      skillsStatus: 'unavailable',
      entries: [{ entity: 'capability:metaMemorySearch' }],
      skills: [],
    })
  })

  it('uses a complete matching account cache without waiting for unrelated Kody refreshes', async () => {
    const loadSkills = vi.fn(async () => [skill])
    const loadReferences = vi.fn(async () => actionCatalog)
    const result = await discoverKodyAssistantCatalog({
      query: 'Do you have a test audit skill?',
      loadCachedSkills: async () => ({ status: 'ready', items: [skill] }),
      loadSkills,
      loadCachedReferences: async () => actionCatalog,
      loadReferences,
    })
    expect(result.skills[0]).toMatchObject({ name: 'test-audit' })
    expect(loadSkills).not.toHaveBeenCalled()
    expect(loadReferences).not.toHaveBeenCalled()
  })

  it('refreshes a stale matching skill before returning its version', async () => {
    const updated = { ...skill, version: 4 }
    const loadReferences = vi.fn(async () => actionCatalog)
    const result = await discoverKodyAssistantCatalog({
      query: 'test audit',
      loadCachedSkills: async () => ({ status: 'stale', items: [skill] }),
      loadSkills: async () => [updated],
      loadCachedReferences: async () => actionCatalog,
      loadReferences,
    })
    expect(result.skills[0].version).toBe(4)
    expect(loadReferences).not.toHaveBeenCalled()
  })

  it('refreshes every source when the complete cache has no match', async () => {
    const loadReferences = vi.fn(async () => actionCatalog)
    const result = await discoverKodyAssistantCatalog({
      query: 'test audit',
      loadCachedSkills: async () => ({ status: 'ready', items: [] }),
      loadSkills: async () => [skill],
      loadCachedReferences: async () => {
        throw new Error('Cached references should not be used')
      },
      loadReferences,
    })
    expect(result.skills[0].name).toBe('test-audit')
    expect(loadReferences).toHaveBeenCalledOnce()
  })
})
