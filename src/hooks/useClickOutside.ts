import * as React from 'react'

type UseClickOutsideOptions = {
  /** Whether the click-outside detection is active */
  enabled: boolean
  /** Callback when a click outside is detected */
  onClickOutside: () => void
  /** Whether to also close on Escape key press (default: true) */
  closeOnEscape?: boolean
  /** Additional refs to consider as "inside" */
  additionalRefs?: React.RefObject<HTMLElement | null>[]
}

/**
 * Hook to detect clicks outside of a referenced element.
 * Returns a ref to attach to the element you want to detect clicks outside of.
 *
 * @example
 * ```tsx
 * const menuRef = useClickOutside({
 *   enabled: isMenuOpen,
 *   onClickOutside: () => setIsMenuOpen(false),
 * })
 *
 * return <div ref={menuRef}>Menu content</div>
 * ```
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>({
  enabled,
  onClickOutside,
  closeOnEscape = true,
  additionalRefs = [],
}: UseClickOutsideOptions): React.RefObject<T | null> {
  const ref = React.useRef<T>(null)
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (!enabled) return

    const isInsideRefs = (target: Node) => {
      if (ref.current?.contains(target)) return true
      for (const additionalRef of additionalRefs) {
        if (additionalRef.current?.contains(target)) return true
      }
      return false
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        // Track touch start position to detect scrolls vs taps
        touchStartRef.current = { x: event.clientX, y: event.clientY }
        return
      }

      // Mouse/pen: handle immediately
      if (!isInsideRefs(event.target as Node)) {
        onClickOutside()
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return

      const start = touchStartRef.current
      touchStartRef.current = null

      if (!start) return

      // If finger moved more than 10px, it's a scroll not a tap
      const dx = Math.abs(event.clientX - start.x)
      const dy = Math.abs(event.clientY - start.y)
      if (dx > 10 || dy > 10) return

      if (!isInsideRefs(event.target as Node)) {
        onClickOutside()
      }
    }

    const handlePointerCancel = () => {
      touchStartRef.current = null
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClickOutside()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerCancel)
    if (closeOnEscape) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerCancel)
      if (closeOnEscape) {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [enabled, onClickOutside, closeOnEscape, additionalRefs])

  return ref
}
