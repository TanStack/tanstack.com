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

  React.useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is inside the main ref
      if (ref.current?.contains(target)) {
        return
      }

      // Check if click is inside any additional refs
      for (const additionalRef of additionalRefs) {
        if (additionalRef.current?.contains(target)) {
          return
        }
      }

      onClickOutside()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClickOutside()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    if (closeOnEscape) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (closeOnEscape) {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [enabled, onClickOutside, closeOnEscape, additionalRefs])

  return ref
}
