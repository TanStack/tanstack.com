import { describe, expect, it, vi } from 'vitest'
import { skillSummarySchema } from '../../src/chat/core/skills'
import { kodySearchWithSyncedSkills } from '../../src/chat/server/kody-search-synced-skills'

const packageId = '149fd608-2ec1-4da1-92fb-584466097f70'
const skill = skillSummarySchema.parse({
  id: 'kody:550e8400-e29b-41d4-a716-446655440000',
  version: 3,
  revision: 3,
  name: 'test-audit',
  description: 'Review tests.',
  enabled: true,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  kodyOrigin: { packageId, skillId: 'test-audit' },
})
const raw = {
  content: [{ type: 'text', text: 'Kody found a test-audit skill.' }],
  structuredContent: {
    result: {
      matches: [
        {
          type: 'retriever_result',
          id: 'test-audit',
          title: 'test-audit',
          summary: 'Review tests.',
          source: 'skills registry',
          packageId,
          kodyId: 'skills',
          retrieverKey: 'skills',
        },
      ],
      memories: {
        retrieverResults: [
          { id: 'test-audit', packageId, metadata: { skill_id: 'test-audit' } },
        ],
      },
    },
  },
}

describe('Kody search with native skills', () => {
  it('adds the exact synced ID and version without another Kody read when the account cache is fresh', async () => {
    const loadFresh = vi.fn(async () => [skill])
    const result = await kodySearchWithSyncedSkills(
      raw,
      'test audit skill',
      async () => ({ status: 'ready', items: [skill] }),
      loadFresh,
    )
    expect(result).toMatchObject({
      search: 'Kody found a test-audit skill.',
      syncedSkills: {
        status: 'ready',
        items: [
          {
            skillId: skill.id,
            version: 3,
            nextTool: 'read_skill',
          },
        ],
        unmatchedRetrieverCount: 0,
      },
    })
    expect(loadFresh).not.toHaveBeenCalled()
  })

  it('refreshes a stale skill and binds by package and source ID, not display name', async () => {
    const result = await kodySearchWithSyncedSkills(
      raw,
      'test audit skill',
      async () => ({ status: 'stale', items: [skill] }),
      async () => [
        { ...skill, version: 4 },
        {
          ...skill,
          id: 'kody:550e8400-e29b-41d4-a716-446655440001',
          kodyOrigin: {
            packageId: '149fd608-2ec1-4da1-92fb-584466097f71',
            skillId: 'test-audit',
          },
        },
      ],
    )
    expect(result.syncedSkills).toMatchObject({ status: 'ready' })
    if (!('items' in result.syncedSkills)) throw new Error('Missing matches')
    expect(result.syncedSkills.items[0]).toMatchObject({
      skillId: skill.id,
      version: 4,
    })
    expect(result.syncedSkills.items[1]).toMatchObject({
      skillId: 'kody:550e8400-e29b-41d4-a716-446655440001',
      version: 3,
    })
  })

  it('refreshes a fresh cache when Kody finds a newly added skill that is not synced yet', async () => {
    const loadFresh = vi.fn(async () => [skill])
    const result = await kodySearchWithSyncedSkills(
      raw,
      'test audit skill',
      async () => ({ status: 'ready', items: [] }),
      loadFresh,
    )
    expect(result.syncedSkills).toMatchObject({
      status: 'ready',
      items: [{ skillId: skill.id }],
    })
    expect(loadFresh).toHaveBeenCalledOnce()
  })

  it('preserves Kody search evidence when skill sync fails', async () => {
    const result = await kodySearchWithSyncedSkills(
      raw,
      'test audit skill',
      async () => ({ status: 'missing', items: [] }),
      async () => {
        throw new Error('Unavailable')
      },
    )
    expect(result).toMatchObject({
      search: 'Kody found a test-audit skill.',
      syncedSkills: { status: 'unavailable' },
    })
  })

  it('does not load the skill catalog when Kody search has no retriever skill', async () => {
    const loadCached = vi.fn(async () => ({
      status: 'ready' as const,
      items: [skill],
    }))
    const result = await kodySearchWithSyncedSkills(
      { content: [{ type: 'text', text: 'Found a package.' }] },
      undefined,
      loadCached,
      async () => [skill],
    )
    expect(result).toEqual({
      search: 'Found a package.',
      syncedSkills: { status: 'not_searched' },
    })
    expect(loadCached).not.toHaveBeenCalled()
  })

  it('finds a synced skill by the same query when Kody returns only a package hit', async () => {
    const loadFresh = vi.fn(async () => [skill])
    const result = await kodySearchWithSyncedSkills(
      { content: [{ type: 'text', text: 'Found the skills package.' }] },
      'test audit skill',
      async () => ({ status: 'ready', items: [skill] }),
      loadFresh,
    )
    expect(result).toMatchObject({
      search: 'Found the skills package.',
      syncedSkills: {
        status: 'ready',
        items: [{ skillId: skill.id, version: 3 }],
      },
    })
    expect(loadFresh).not.toHaveBeenCalled()
  })
})
