import { z } from 'zod'

export const getNpmStatsSchema = z.object({
  library: z
    .string()
    .optional()
    .describe(
      'Filter to specific TanStack library (e.g., "query", "router", "table"). Omit to get org-wide stats.',
    ),
})

export type GetNpmStatsInput = z.infer<typeof getNpmStatsSchema>

export async function getNpmStats(input: GetNpmStatsInput) {
  const {
    getCachedNpmOrgStats,
    getExpiredNpmOrgStats,
    getCachedLibraryStats,
    getAllCachedLibraryStats,
    getRegisteredPackages,
  } = await import('~/utils/stats-db.server')
  const { getBatchCachedNpmPackageStats } =
    await import('~/utils/stats-db.server')

  if (input.library) {
    // Get stats for specific library
    const libraryStats = await getCachedLibraryStats(input.library)

    if (!libraryStats) {
      throw new Error(
        `Library "${input.library}" not found. Use list_libraries to see available libraries.`,
      )
    }

    // Get package details for this library
    const packageNames = await getRegisteredPackages(input.library)
    const packageStats = await getBatchCachedNpmPackageStats(packageNames)

    const packages = packageNames.map((name) => {
      const stats = packageStats.get(name)
      return {
        name,
        downloads: stats?.downloads ?? 0,
        ratePerDay: stats?.ratePerDay ?? 0,
      }
    })

    // Sort by downloads descending
    packages.sort((a, b) => b.downloads - a.downloads)

    // Calculate aggregate rate
    const totalRatePerDay = packages.reduce((sum, p) => sum + p.ratePerDay, 0)

    return {
      library: input.library,
      totalDownloads: libraryStats.totalDownloads,
      ratePerDay: totalRatePerDay,
      packageCount: libraryStats.packageCount,
      packages,
    }
  }

  // Get org-wide stats
  let orgStats = await getCachedNpmOrgStats('tanstack')

  if (!orgStats) {
    // Try expired cache as fallback
    orgStats = await getExpiredNpmOrgStats('tanstack')
  }

  if (!orgStats) {
    throw new Error(
      'NPM stats not available. Stats are refreshed every 6 hours.',
    )
  }

  // Get library breakdown
  const libraryStats = await getAllCachedLibraryStats()

  const libraries = libraryStats
    .map((lib) => ({
      id: lib.libraryId,
      totalDownloads: lib.totalDownloads,
      packageCount: lib.packageCount,
    }))
    .sort((a, b) => b.totalDownloads - a.totalDownloads)

  return {
    org: 'tanstack',
    totalDownloads: orgStats.totalDownloads,
    ratePerDay: orgStats.ratePerDay ?? 0,
    updatedAt: orgStats.updatedAt
      ? new Date(orgStats.updatedAt).toISOString()
      : null,
    libraries,
  }
}
