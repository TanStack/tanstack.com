import { useEffect, useRef, useCallback } from 'react'
import type { NpmStats } from '~/utils/stats.server'

/**
 * Hook to animate NPM download count using direct DOM updates.
 * Uses a low-frequency timer so idle pages do not render every frame.
 */
const downloadCounterUpdateMs = 1000

export function useNpmDownloadCounter(
  npmData: NpmStats,
): React.RefCallback<HTMLElement> {
  const baseCount = npmData.totalDownloads ?? 0
  const ratePerDay = npmData.ratePerDay ?? 0
  // eslint-disable-next-line react-hooks/purity
  const updatedAt = npmData.updatedAt ?? Date.now()

  const timeoutRef = useRef<number | undefined>(undefined)
  const elementRef = useRef<HTMLElement | null>(null)
  const lastCountRef = useRef<number | null>(null)

  const getCount = useCallback(() => {
    const msPerDay = 24 * 60 * 60 * 1000
    const ratePerMs = ratePerDay / msPerDay
    const elapsedMs = Date.now() - updatedAt

    return Math.round(baseCount + ratePerMs * elapsedMs)
  }, [baseCount, ratePerDay, updatedAt])

  useEffect(() => {
    if (!ratePerDay || ratePerDay === 0 || !elementRef.current) {
      return
    }

    const updateCount = () => {
      if (elementRef.current) {
        const count = getCount()

        if (count !== lastCountRef.current) {
          lastCountRef.current = count
          elementRef.current.textContent = count.toLocaleString()
        }
      }
    }

    const clearTimer = () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }

    const scheduleTick = () => {
      clearTimer()

      if (document.visibilityState === 'hidden') {
        return
      }

      timeoutRef.current = window.setTimeout(() => {
        updateCount()
        scheduleTick()
      }, downloadCounterUpdateMs)
    }

    const handleVisibilityChange = () => {
      updateCount()
      scheduleTick()
    }

    updateCount()
    scheduleTick()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [getCount, ratePerDay])

  const refCallback = useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node
      if (node) {
        const count = getCount()
        lastCountRef.current = count
        node.textContent = count.toLocaleString()
      }
    },
    [getCount],
  )

  return refCallback
}
