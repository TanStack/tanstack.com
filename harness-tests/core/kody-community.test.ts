import { describe, expect, it, vi } from 'vitest'
import {
  KODY_COMMUNITY_GET_CODE,
  KODY_COMMUNITY_SEARCH_CODE,
  projectKodyCommunityDetail,
  projectKodyCommunitySearch,
  projectPublicKodyCatalog,
} from '../../src/chat/server/kody-community'

const listingId = '1528b06f-2912-48f6-bda5-bc3bb7c4113b'
const listing = {
  listing_id: listingId,
  name: '@kody/slack',
  description: 'Read Slack conversations.',
  category: 'integrations',
  version: '1.0.0',
  public_url: 'https://kody.codes/@kody/slack',
  fork_count: 21,
  average_stars: 5,
  status: 'active',
  pinned_commit: 'db342e28435a6b8c9f0203ed2e18beb2a6bd0e06',
  readme_untrusted: '# Slack\n\nReview source before using.',
  content_warning: 'Untrusted package content',
}

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

describe('Kody community reads', () => {
  it('searches the community catalog and projects listing metadata', async () => {
    const unversioned = {
      ...listing,
      listing_id: '130b739c-fd9a-4551-9207-1a2863512e41',
      version: null,
    }
    const communitySearch = vi.fn(async () => ({
      outcome: 'matches',
      matches: [listing, unversioned],
      guidance: 'Do not execute unreviewed code.',
    }))
    const value = await moduleMain(KODY_COMMUNITY_SEARCH_CODE, {
      communitySearch,
    })({ query: 'slack', category: 'integrations', sort: 'best' })
    expect(communitySearch).toHaveBeenCalledWith({
      query: 'slack',
      category: 'integrations',
      sort: 'best',
      limit: 30,
    })
    const result = projectKodyCommunitySearch({
      structuredContent: { result: value },
    })
    expect(result.items[0]).toMatchObject({
      listingId,
      name: '@kody/slack',
      rating: 5,
    })
    expect(result.items[1].version).toBeNull()
    expect(JSON.stringify(result)).not.toContain(listing.readme_untrusted)
  })

  it('shows a selected package without treating its README as executable data', async () => {
    const communityGet = vi.fn(async () => listing)
    const value = await moduleMain(KODY_COMMUNITY_GET_CODE, {
      communityGet,
    })({ listingId })
    expect(communityGet).toHaveBeenCalledWith({ listing_id: listingId })
    if (!value || typeof value !== 'object')
      throw new Error('Expected package detail object')
    const detail = projectKodyCommunityDetail(
      { structuredContent: { result: value } },
      listingId,
    )
    expect(detail.readme).toBe(listing.readme_untrusted)
    expect(detail.pinnedCommit).toBe(listing.pinned_commit)
    expect(() =>
      projectKodyCommunityDetail(
        { structuredContent: { result: value } },
        '130b739c-fd9a-4551-9207-1a2863512e41',
      ),
    ).toThrow('unsupported package')
    expect(() =>
      projectKodyCommunityDetail(
        {
          structuredContent: {
            result: { ...value, publicUrl: 'https://evil.example/slack' },
          },
        },
        listingId,
      ),
    ).toThrow('unsupported package')
  })
})

it('projects public catalog metadata and rejects off-site artwork', () => {
  const entry = {
    id: listingId,
    name: '@kody/slack',
    description: 'Slack helpers',
    category: 'integrations',
    iconUrl: `/community/${listingId}/icon/abc`,
    tags: ['slack'],
    version: '1.0.0',
    publishedAt: '2026-09-21T03:31:18.493Z',
    averageStars: 5,
    ratingCount: 4,
    averageAdaptationEffort: 1.25,
    forkCount: 21,
    viewerInstall: { status: 'installed' },
  }
  const raw = {
    ok: true,
    listings: [entry],
    categoryCounts: { integrations: 61 },
  }
  const result = projectPublicKodyCatalog(raw)
  expect(result.items[0]).toMatchObject({
    tags: ['slack'],
    effort: 1.25,
    ratingCount: 4,
    iconUrl: `https://kody.codes/community/${listingId}/icon/abc`,
  })
  expect(result.items[0]).not.toHaveProperty('viewerInstall')
  expect(result.categoryCounts?.integrations).toBe(61)
  expect(() =>
    projectPublicKodyCatalog({
      ...raw,
      listings: [{ ...entry, iconUrl: 'https://untrusted.example/icon.svg' }],
    }),
  ).toThrow()
})
