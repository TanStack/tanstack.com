import { createServerFn } from '@tanstack/react-start'
import * as v from 'valibot'
import {
  getLibraryNpmStats as getLibraryNpmStatsServer,
  listGitHubStatsCache as listGitHubStatsCacheServer,
  listNpmOrgStatsCache as listNpmOrgStatsCacheServer,
  listNpmPackages as listNpmPackagesServer,
  refreshAllGitHubStats as refreshAllGitHubStatsServer,
  refreshAllNpmStats as refreshAllNpmStatsServer,
  refreshGitHubStats as refreshGitHubStatsServer,
  refreshNpmPackageStats as refreshNpmPackageStatsServer,
} from '~/utils/stats-admin.server'

export const listGitHubStatsCache = createServerFn({ method: 'POST' }).handler(
  async () => listGitHubStatsCacheServer(),
)

export const refreshGitHubStats = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      cacheKey: v.string(),
    }),
  )
  .handler(async ({ data }) => refreshGitHubStatsServer({ data }))

export const refreshAllGitHubStats = createServerFn({ method: 'POST' }).handler(
  async () => refreshAllGitHubStatsServer(),
)

export const listNpmPackages = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      libraryId: v.optional(v.string()),
      search: v.optional(v.string()),
    }),
  )
  .handler(async ({ data }) => listNpmPackagesServer({ data }))

export const refreshNpmPackageStats = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      packageName: v.string(),
    }),
  )
  .handler(async ({ data }) => refreshNpmPackageStatsServer({ data }))

export const listNpmOrgStatsCache = createServerFn({ method: 'POST' }).handler(
  async () => listNpmOrgStatsCacheServer(),
)

export const getLibraryNpmStats = createServerFn({ method: 'POST' }).handler(
  async () => getLibraryNpmStatsServer(),
)

export const refreshAllNpmStats = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      org: v.string(),
    }),
  )
  .handler(async ({ data }) => refreshAllNpmStatsServer({ data }))
