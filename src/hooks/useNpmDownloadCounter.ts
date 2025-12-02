import { useMemo } from 'react'
import type { NpmStats } from '~/utils/stats.server'

/**
 * Hook to calculate NPM download counter with interval
 * Replaces useNpmDownloadCounter from convex-oss-stats
 */
export function useNpmDownloadCounter(npmData: NpmStats): {
  count: number
  intervalMs: number
} {
  return useMemo(() => {
    const totalDownloads = npmData.totalDownloads ?? 0

    // Calculate interval based on download count
    // Higher counts = slower interval (less frequent updates)
    // Lower counts = faster interval (more frequent updates)
    let intervalMs = 1000 // Default 1 second

    if (totalDownloads > 100_000_000) {
      intervalMs = 5000 // 5 seconds for very high counts
    } else if (totalDownloads > 10_000_000) {
      intervalMs = 3000 // 3 seconds for high counts
    } else if (totalDownloads > 1_000_000) {
      intervalMs = 2000 // 2 seconds for medium counts
    } else {
      intervalMs = 1000 // 1 second for lower counts
    }

    return {
      count: totalDownloads,
      intervalMs,
    }
  }, [npmData.totalDownloads])
}

