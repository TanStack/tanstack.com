import * as React from 'react'
import { getSvgPath } from 'figma-squircle'

/**
 * Cross-browser squircle corners.
 *
 * Chromium reshapes corners natively via `corner-shape: squircle` (the
 * `corner-squircle` utility), which correctly handles borders + shadows for
 * free. Safari and Firefox don't support it yet, so this applies a superellipse
 * `clip-path` there instead — matched to the element's own computed
 * `border-radius` (so it tracks responsive Tailwind classes) and re-computed on
 * resize. It is a deliberate no-op where native squircles work, so shadowed
 * elements keep their shadows on Chromium.
 *
 * `clip-path` clips outset `box-shadow`, so only use this on shape-forward
 * containers without an outer shadow (media/image wrappers, cards); leave
 * shadowed buttons on the native-only path.
 */

function supportsNativeSquircle(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('corner-shape', 'squircle')
  )
}

export function useSquircleFallback(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current
    if (!el || supportsNativeSquircle()) return

    const apply = () => {
      const { width, height } = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const radius = (prop: string) =>
        parseFloat(style.getPropertyValue(prop)) || 0
      const corners = {
        topLeftCornerRadius: radius('border-top-left-radius'),
        topRightCornerRadius: radius('border-top-right-radius'),
        bottomRightCornerRadius: radius('border-bottom-right-radius'),
        bottomLeftCornerRadius: radius('border-bottom-left-radius'),
      }

      const hasRadius = Object.values(corners).some((r) => r > 0)
      if (!width || !height || !hasRadius) {
        el.style.clipPath = ''
        return
      }

      el.style.clipPath = `path('${getSvgPath({
        width,
        height,
        cornerSmoothing: 0.6,
        ...corners,
      })}')`
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    // Element size may not change when a breakpoint flips the border-radius, so
    // re-read on viewport resize too.
    window.addEventListener('resize', apply)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', apply)
      el.style.clipPath = ''
    }
  }, [ref])
}

type SquircleProps = React.HTMLAttributes<HTMLDivElement>

/** A `<div>` that carries a squircle shape cross-browser (see useSquircleFallback). */
export const Squircle = React.forwardRef<HTMLDivElement, SquircleProps>(
  function Squircle({ children, ...rest }, forwardedRef) {
    const localRef = React.useRef<HTMLDivElement>(null)
    React.useImperativeHandle(forwardedRef, () => localRef.current!, [])
    useSquircleFallback(localRef)
    return (
      <div ref={localRef} {...rest}>
        {children}
      </div>
    )
  },
)
