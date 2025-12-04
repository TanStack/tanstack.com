import { useMemo, useState, useEffect } from 'react'
import type { NpmStats } from '~/utils/stats.server'

/**
 * Hook to animate NPM download counter based on growth rate and elapsed time
 * Interpolates downloads from the last known value using week-over-week growth rate
 */
export function useNpmDownloadCounter(npmData: NpmStats): {
  count: number
  intervalMs: number
} {
  const baseCount = npmData.totalDownloads ?? 0
  const ratePerDay = npmData.ratePerDay ?? 0
  const updatedAt = npmData.updatedAt ?? Date.now()

  const [animatedCount, setAnimatedCount] = useState(baseCount)

  useEffect(() => {
    // If no growth rate, just show the base count
    if (!ratePerDay || ratePerDay === 0) {
      setAnimatedCount(baseCount)
      return
    }

    // Convert rate per day to rate per millisecond
    const msPerDay = 24 * 60 * 60 * 1000
    const ratePerMs = ratePerDay / msPerDay

    // Calculate animation interval based on rate
    // Faster growth = more frequent updates for smoother animation
    const dailyRate = Math.abs(ratePerDay)
    let intervalMs: number

    if (dailyRate > 100000) {
      // Very high rate: update every 100ms
      intervalMs = 100
    } else if (dailyRate > 10000) {
      // High rate: update every 200ms
      intervalMs = 200
    } else if (dailyRate > 1000) {
      // Medium rate: update every 500ms
      intervalMs = 500
    } else {
      // Low rate: update every 1000ms
      intervalMs = 1000
    }

    // Set up interval to update the count
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsedMs = now - updatedAt
      const additionalDownloads = ratePerMs * elapsedMs
      const newCount = baseCount + additionalDownloads

      setAnimatedCount(Math.round(newCount))
    }, intervalMs)

    // Also update immediately
    const now = Date.now()
    const elapsedMs = now - updatedAt
    const additionalDownloads = ratePerMs * elapsedMs
    setAnimatedCount(Math.round(baseCount + additionalDownloads))

    return () => clearInterval(interval)
  }, [baseCount, ratePerDay, updatedAt])

  return useMemo(
    () => ({
      count: animatedCount,
      intervalMs: 1000, // This is just for compatibility, actual interval is managed internally
    }),
    [animatedCount]
  )
}

