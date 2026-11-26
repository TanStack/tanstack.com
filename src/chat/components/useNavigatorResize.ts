import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react'

/** Keep the dock and card preferences independent as the layout changes. */
export function useNavigatorResize({
  storageKey,
  wide,
  availableWidth,
  enabled,
}: {
  storageKey: string
  wide: boolean
  availableWidth: number
  enabled: boolean
}) {
  const key = JSON.stringify([storageKey, wide ? 'dock' : 'card'])
  const [saved, setSaved] = useState<{ key: string; width?: number }>({ key })
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{
    pointerId: number
    x: number
    width: number
    saved: typeof saved
  } | null>(null)
  const maximum = Math.max(
    0,
    Math.min(480, availableWidth ? availableWidth - (wide ? 360 : 24) : 480),
  )
  const minimum = Math.min(220, maximum)
  const clamp = (value: number) => Math.max(minimum, Math.min(maximum, value))
  const width = clamp(
    (saved.key === key ? saved.width : undefined) ?? (wide ? 280 : 360),
  )

  useLayoutEffect(() => {
    let width: number | undefined
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (typeof stored === 'number' && Number.isFinite(stored))
        width = Math.max(220, Math.min(480, stored))
    } catch {
      // The panel remains resizable when browser storage is unavailable.
    }
    setSaved({ key, width })
  }, [key])

  const cancel = () => {
    if (!drag.current) return
    const previous = drag.current.saved
    setSaved((current) => (current.key === previous.key ? previous : current))
    drag.current = null
    setResizing(false)
  }
  useEffect(() => {
    cancel()
  }, [enabled, key])

  const save = (width?: number) => {
    setSaved({ key, width })
    try {
      if (width === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(width))
    } catch {
      // Keep the chosen width for this session even if it cannot be saved.
    }
  }
  const handleProps: HTMLAttributes<HTMLDivElement> = {
    role: 'separator',
    tabIndex: enabled ? 0 : -1,
    'aria-label': 'Resize threads and conversations',
    'aria-orientation': 'vertical',
    'aria-valuemin': Math.round(minimum),
    'aria-valuemax': Math.round(maximum),
    'aria-valuenow': Math.round(width),
    'aria-valuetext': `${Math.round(width)} pixels wide`,
    title: 'Drag to resize. Double-click to reset.',
    onDoubleClick: () => save(),
    onPointerDown: (event) => {
      if (!enabled || event.button !== 0 || !event.isPrimary || drag.current)
        return
      event.preventDefault()
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        width,
        saved,
      }
      setResizing(true)
    },
    onPointerMove: (event) => {
      const start = drag.current
      if (!start || start.pointerId !== event.pointerId) return
      setSaved({ key, width: clamp(start.width + event.clientX - start.x) })
    },
    onPointerUp: (event) => {
      const start = drag.current
      if (!start || start.pointerId !== event.pointerId) return
      drag.current = null
      setResizing(false)
      save(clamp(start.width + event.clientX - start.x))
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onKeyDown: (event) => {
      if (drag.current) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          const { pointerId } = drag.current
          cancel()
          if (event.currentTarget.hasPointerCapture(pointerId))
            event.currentTarget.releasePointerCapture(pointerId)
        }
        return
      }
      const step = event.shiftKey ? 64 : 16
      const next =
        event.key === 'ArrowLeft'
          ? width - step
          : event.key === 'ArrowRight'
            ? width + step
            : event.key === 'Home'
              ? minimum
              : event.key === 'End'
                ? maximum
                : undefined
      if (next === undefined) return
      event.preventDefault()
      event.stopPropagation()
      save(clamp(next))
    },
  }
  return { width, resizing, handleProps }
}
