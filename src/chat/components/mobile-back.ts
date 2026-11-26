import { useEffect, useRef } from 'react'

const handlers = new Set<() => void>()
export function useMobileBack(enabled: boolean, back: () => void) {
  const latest = useRef(back)
  latest.current = back
  useEffect(() => {
    if (!enabled) return
    const handler = () => latest.current()
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }, [enabled])
}
export function mobileBackHandler() {
  return [...handlers].at(-1)
}
