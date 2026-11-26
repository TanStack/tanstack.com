import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react'

/** Touch context menus yield to scrolling and never consume the following tap. */
export function useLongPress(
  onLongPress: (target: HTMLElement, x: number, y: number) => void,
  disabled = false,
) {
  const gesture = useRef<{
    timer: ReturnType<typeof setTimeout>
    x: number
    y: number
    id: number
  } | null>(null)
  const suppressClickUntil = useRef(0)
  const cancel = () => {
    if (gesture.current) clearTimeout(gesture.current.timer)
    gesture.current = null
  }
  useEffect(() => cancel, [])
  useEffect(() => {
    if (disabled) cancel()
  }, [disabled])
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      cancel()
      suppressClickUntil.current = 0
      if (disabled || event.pointerType !== 'touch' || !event.isPrimary) return
      const target = event.currentTarget
      const { clientX: x, clientY: y, pointerId: id } = event
      gesture.current = {
        x,
        y,
        id,
        timer: setTimeout(() => {
          gesture.current = null
          suppressClickUntil.current = Date.now() + 1500
          onLongPress(target, x, y)
        }, 500),
      }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = gesture.current
      if (
        current &&
        (event.pointerId !== current.id ||
          Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8)
      )
        cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (Date.now() < suppressClickUntil.current) {
        suppressClickUntil.current = 0
        event.preventDefault()
        event.stopPropagation()
      }
    },
  }
}
