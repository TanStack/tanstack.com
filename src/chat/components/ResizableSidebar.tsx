import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type RefObject,
} from 'react'

const minWidth = 220
const maxWidth = 480
const minContentWidth = 360

export function ResizableSidebar({
  sidebarRef,
  viewerId,
  resizable,
  children,
  style,
  ...props
}: ComponentPropsWithoutRef<'aside'> & {
  sidebarRef: RefObject<HTMLElement | null>
  viewerId: string
  resizable: boolean
}) {
  const storageKey = JSON.stringify(['gum', 'sidebar-width', 1, viewerId])
  const [preferredWidth, setPreferredWidth] = useState<number>()
  const [availableWidth, setAvailableWidth] = useState(0)
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{
    pointerId: number
    x: number
    width: number
    preferredWidth: number | undefined
  } | null>(null)
  const maximum = Math.max(
    minWidth,
    Math.min(
      maxWidth,
      availableWidth ? availableWidth - minContentWidth : maxWidth,
    ),
  )
  const clamp = (value: number) => Math.max(minWidth, Math.min(maximum, value))
  const defaultWidth = availableWidth && availableWidth <= 1100 ? 220 : 254
  const width = clamp(preferredWidth ?? defaultWidth)

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? 'null',
      )
      setPreferredWidth(
        typeof stored === 'number' && Number.isFinite(stored)
          ? Math.max(minWidth, Math.min(maxWidth, stored))
          : undefined,
      )
    } catch {
      setPreferredWidth(undefined)
    }
  }, [storageKey])

  useEffect(() => {
    const shell = sidebarRef.current?.closest('.app-shell')
    if (!shell) return
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width)
    })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [sidebarRef])

  const cancelDrag = () => {
    if (!drag.current) return
    setPreferredWidth(drag.current.preferredWidth)
    drag.current = null
    setResizing(false)
  }

  useEffect(() => {
    if (!resizable) cancelDrag()
  }, [resizable])

  const save = (value: number | undefined) => {
    setPreferredWidth(value)
    try {
      if (value === undefined) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Resizing still works when browser storage is unavailable.
    }
  }

  return (
    <aside
      {...props}
      id="workspace-sidebar"
      ref={sidebarRef}
      data-resizing={resizing || undefined}
      style={{ ...style, '--sidebar-width': `${width}px` } as CSSProperties}
    >
      <div className="sidebar-content">{children}</div>
      {resizable && (
        <div
          className="sidebar-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-controls="workspace-sidebar"
          aria-valuemin={minWidth}
          aria-valuemax={Math.round(maximum)}
          aria-valuenow={Math.round(width)}
          aria-valuetext={`${Math.round(width)} pixels wide`}
          title="Drag to resize. Double-click to reset."
          onDoubleClick={() => save(undefined)}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary || drag.current) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              width,
              preferredWidth,
            }
            setResizing(true)
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (!start || start.pointerId !== event.pointerId) return
            setPreferredWidth(clamp(start.width + event.clientX - start.x))
          }}
          onPointerUp={(event) => {
            const start = drag.current
            if (!start || start.pointerId !== event.pointerId) return
            drag.current = null
            setResizing(false)
            save(clamp(start.width + event.clientX - start.x))
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onKeyDown={(event) => {
            if (drag.current) {
              if (event.key === 'Escape') {
                event.preventDefault()
                const { pointerId } = drag.current
                cancelDrag()
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
                    ? minWidth
                    : event.key === 'End'
                      ? maximum
                      : undefined
            if (next === undefined) return
            event.preventDefault()
            save(clamp(next))
          }}
        />
      )}
    </aside>
  )
}
