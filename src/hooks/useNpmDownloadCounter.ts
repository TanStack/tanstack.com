import { useEffect, useRef, useCallback } from 'react'
import type { NpmStats } from '~/utils/stats.server'

/**
 * Hook to animate NPM download count using direct DOM updates.
 * Uses setInterval to minimize overhead - updates only when count changes.
 */
export function useNpmDownloadCounter(npmData: NpmStats): React.RefCallback<HTMLElement> {
  const baseCount = npmData.totalDownloads ?? 0
  const ratePerDay = npmData.ratePerDay ?? 0
  const updatedAt = npmData.updatedAt ?? Date.now()

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const elementRef = useRef<HTMLElement | null>(null)
  const lastCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!ratePerDay || ratePerDay === 0 || !elementRef.current) {
      return
    }

    const msPerDay = 24 * 60 * 60 * 1000
    const ratePerMs = ratePerDay / msPerDay

    // Calculate how often we need to update based on rate
    // At minimum, update when count would change by 1
    const msPerIncrement = 1 / ratePerMs
    // Clamp between 50ms and 1000ms
    const intervalMs = Math.max(50, Math.min(1000, msPerIncrement))

    const tick = () => {
      if (!elementRef.current) return
      const elapsedMs = Date.now() - updatedAt
      const count = Math.round(baseCount + ratePerMs * elapsedMs)

      if (count !== lastCountRef.current) {
        lastCountRef.current = count
        elementRef.current.textContent = count.toLocaleString()
      }
    }

    intervalRef.current = setInterval(tick, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [baseCount, ratePerDay, updatedAt])

  const refCallback = useCallback((node: HTMLElement | null) => {
    elementRef.current = node
    if (node) {
      const msPerDay = 24 * 60 * 60 * 1000
      const ratePerMs = ratePerDay / msPerDay
      const elapsedMs = Date.now() - updatedAt
      const count = Math.round(baseCount + ratePerMs * elapsedMs)
      lastCountRef.current = count
      node.textContent = count.toLocaleString()
    }
  }, [baseCount, ratePerDay, updatedAt])

  return refCallback
}
