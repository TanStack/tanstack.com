import { useEffect, useRef, useCallback } from 'react'
import type { NpmStats } from '~/utils/stats.server'

/**
 * Hook to animate NPM download count using direct DOM updates.
 * Uses requestAnimationFrame for smooth browser-scheduled updates.
 */
export function useNpmDownloadCounter(
  npmData: NpmStats,
): React.RefCallback<HTMLElement> {
  const baseCount = npmData.totalDownloads ?? 0
  const ratePerDay = npmData.ratePerDay ?? 0
  // eslint-disable-next-line react-hooks/purity
  const updatedAt = npmData.updatedAt ?? Date.now()

  const frameRef = useRef<number | undefined>(undefined)
  const elementRef = useRef<HTMLElement | null>(null)
  const lastCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!ratePerDay || ratePerDay === 0 || !elementRef.current) {
      return
    }

    const msPerDay = 24 * 60 * 60 * 1000
    const ratePerMs = ratePerDay / msPerDay

    const tick = () => {
      if (elementRef.current) {
        const elapsedMs = Date.now() - updatedAt
        const count = Math.round(baseCount + ratePerMs * elapsedMs)

        if (count !== lastCountRef.current) {
          lastCountRef.current = count
          elementRef.current.textContent = count.toLocaleString()
        }
      }

      frameRef.current = window.requestAnimationFrame(tick)
    }

    frameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [baseCount, ratePerDay, updatedAt])

  const refCallback = useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node
      if (node) {
        const msPerDay = 24 * 60 * 60 * 1000
        const ratePerMs = ratePerDay / msPerDay
        const elapsedMs = Date.now() - updatedAt
        const count = Math.round(baseCount + ratePerMs * elapsedMs)
        lastCountRef.current = count
        node.textContent = count.toLocaleString()
      }
    },
    [baseCount, ratePerDay, updatedAt],
  )

  return refCallback
}
