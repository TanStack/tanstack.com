import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/db/client', () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error('Unconfigured database was accessed')
      },
    },
  ),
  isDatabaseConfigured: vi.fn(async () => false),
}))
import { isDatabaseConfigured } from '~/db/client'
import { getAuthService, getSessionService } from '~/auth/context.server'
import {
  getAllVerifiedPackages,
  getIntentRegistryStats,
  getLatestIntentVersionSkillSummaries,
  getPackageByName,
  searchSkills,
} from '~/utils/intent-db.server'
import { searchShowcasesCore } from '~/utils/showcase.server'

afterEach(() => vi.unstubAllEnvs())

describe('local services without credentials', () => {
  it('does not require a session secret for local anonymous browsing', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SESSION_SECRET', undefined)
    expect(getSessionService()).toBeDefined()
    expect(
      await getAuthService().getCurrentUser(
        new Request('http://localhost:3000'),
      ),
    ).toBeNull()
  })
  it('keeps public database lists usable without a database', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(await getAllVerifiedPackages()).toEqual([])
    expect(await getPackageByName('@tanstack/query')).toBeUndefined()
    expect(await getLatestIntentVersionSkillSummaries()).toEqual([])
    expect(await searchSkills('query')).toEqual([])
    expect(await getIntentRegistryStats()).toEqual({
      packageCount: 0,
      skillCount: 0,
      versionCount: 0,
    })
    expect(await searchShowcasesCore()).toEqual({
      showcases: [],
      pagination: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
    })
  })
  it('uses the database when it is supplied locally', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.mocked(isDatabaseConfigured).mockResolvedValueOnce(true)
    await expect(getAllVerifiedPackages()).rejects.toThrow(
      'Unconfigured database was accessed',
    )
  })
  it('does not hide a missing production database', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(getAllVerifiedPackages()).rejects.toThrow(
      'Unconfigured database was accessed',
    )
  })
})
