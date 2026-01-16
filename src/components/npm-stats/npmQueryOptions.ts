import * as d3 from 'd3'
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { PackageGroup, TimeRange, NpmQueryData } from './NPMStatsChart'

/**
 * Shared TanStack Query options for fetching NPM download statistics.
 * Used by both the main /stats/npm page and library-specific NPM stats pages.
 */
export function npmQueryOptions({
  packageGroups,
  range,
}: {
  packageGroups: PackageGroup[]
  range: TimeRange
}) {
  const now = d3.utcDay(new Date())
  // Set to start of today to avoid timezone issues
  now.setHours(0, 0, 0, 0)
  const endDate = now

  // NPM download statistics only go back to January 10, 2015
  const NPM_STATS_START_DATE = d3.utcDay(new Date('2015-01-10'))

  const startDate = (() => {
    switch (range) {
      case '7-days':
        return d3.utcDay.offset(now, -7)
      case '30-days':
        return d3.utcDay.offset(now, -30)
      case '90-days':
        return d3.utcDay.offset(now, -90)
      case '180-days':
        return d3.utcDay.offset(now, -180)
      case '365-days':
        return d3.utcDay.offset(now, -365)
      case '730-days':
        return d3.utcDay.offset(now, -730)
      case '1825-days':
        return d3.utcDay.offset(now, -1825)
      case 'all-time':
        // Use NPM's stats start date - the API will return empty data for dates before packages existed
        return NPM_STATS_START_DATE
    }
  })()

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  return queryOptions({
    queryKey: [
      'npm-stats',
      packageGroups.map((pg) => ({
        packages: pg.packages.map((p) => ({ name: p.name })),
      })),
      range,
    ],
    queryFn: async (): Promise<NpmQueryData> => {
      try {
        // Import the bulk server function for fetching all npm downloads at once
        const { fetchNpmDownloadsBulk } = await import('~/utils/stats.server')

        // Make a single bulk request for all packages
        const results = await fetchNpmDownloadsBulk({
          data: {
            packageGroups: packageGroups.map((pg) => ({
              packages: pg.packages.map((p) => ({
                name: p.name,
                hidden: p.hidden,
              })),
            })),
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          },
        })

        // Process results to match the expected format
        return results.map((result, groupIndex) => {
          let actualStartDate = startDate

          // Find the earliest non-zero download for this package group
          for (const pkg of result.packages) {
            const firstNonZero = pkg.downloads.find((d) => d.downloads > 0)
            if (firstNonZero) {
              const firstNonZeroDate = d3.utcDay(new Date(firstNonZero.day))
              if (firstNonZeroDate < actualStartDate) {
                actualStartDate = firstNonZeroDate
              }
            }
          }

          return {
            packages: result.packages.map((pkg) => ({
              ...packageGroups[groupIndex]?.packages.find(
                (p) => p.name === pkg.name,
              ),
              downloads: pkg.downloads,
            })),
            start: formatDate(actualStartDate),
            end: formatDate(endDate),
            error: result.error ?? undefined,
            actualStartDate,
          }
        })
      } catch (error) {
        console.error('Failed to fetch npm stats:', error)
        // Return error state for all package groups
        return packageGroups.map((packageGroup) => ({
          packages: packageGroup.packages.map((pkg) => ({
            ...pkg,
            downloads: [],
          })),
          start: formatDate(startDate),
          end: formatDate(endDate),
          error: 'Failed to fetch package data (see console for details)',
          actualStartDate: startDate,
        }))
      }
    },
    placeholderData: keepPreviousData,
  })
}
