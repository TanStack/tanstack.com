import * as React from 'react'

export type ResizeChangeOptions = {
  replace: boolean
}

export type ResizableSizeChange = {
  height?: number
  width?: number | undefined
}

export type ResizableProps = {
  height: number
  width?: number
  onSizeChange: (
    size: ResizableSizeChange,
    options: ResizeChangeOptions,
  ) => void
  children: React.ReactNode
  minHeight?: number
  minWidth?: number
  fullWidthSnapThreshold?: number
  enableWidthResize?: boolean
}

export function Resizable({
  height,
  width,
  onSizeChange,
  children,
  minHeight = 300,
  minWidth = 320,
  fullWidthSnapThreshold = 12,
  enableWidthResize = true,
}: ResizableProps) {
  const [isHeightDragging, setIsHeightDragging] = React.useState(false)
  const [isWidthDragging, setIsWidthDragging] = React.useState(false)
  const [isCornerDragging, setIsCornerDragging] = React.useState(false)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const startYRef = React.useRef<number>(0)
  const startXRef = React.useRef<number>(0)
  const startHeightRef = React.useRef<number>(height)
  const startWidthRef = React.useRef<number>(width ?? 0)

  const onSizeChangeRef = React.useRef(onSizeChange)
  React.useEffect(() => {
    onSizeChangeRef.current = onSizeChange
  })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateContainerWidth = () => {
      setContainerWidth(Math.round(container.getBoundingClientRect().width))
    }

    updateContainerWidth()

    const ownerWindow = container.ownerDocument.defaultView
    if (!ownerWindow?.ResizeObserver) {
      ownerWindow?.addEventListener('resize', updateContainerWidth)
      return () => {
        ownerWindow?.removeEventListener('resize', updateContainerWidth)
      }
    }

    const resizeObserver = new ownerWindow.ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(Math.round(entry.contentRect.width))
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const getMaxWidth = React.useCallback(() => {
    return (
      containerWidth ||
      Math.round(containerRef.current?.getBoundingClientRect().width ?? 0)
    )
  }, [containerWidth])

  const getHeightFromDelta = React.useCallback(
    (deltaY: number) => Math.max(minHeight, startHeightRef.current + deltaY),
    [minHeight],
  )

  const getWidthFromDelta = React.useCallback(
    ({ deltaX, maxWidth }: { deltaX: number; maxWidth: number }) => {
      const rawWidth = startWidthRef.current + deltaX * 2
      const nextMinWidth = Math.min(minWidth, maxWidth)
      const nextWidth = Math.max(
        nextMinWidth,
        Math.min(maxWidth, Math.round(rawWidth)),
      )

      if (nextWidth >= maxWidth - fullWidthSnapThreshold) {
        return undefined
      }

      return nextWidth
    },
    [fullWidthSnapThreshold, minWidth],
  )

  const handleHeightMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsHeightDragging(true)
      startYRef.current = e.clientY
      startHeightRef.current = height

      const ownerDocument = e.currentTarget.ownerDocument
      const previousCursor = ownerDocument.body.style.cursor
      const previousUserSelect = ownerDocument.body.style.userSelect
      ownerDocument.body.style.cursor = 'ns-resize'
      ownerDocument.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startYRef.current
        const newHeight = getHeightFromDelta(deltaY)
        onSizeChangeRef.current({ height: newHeight }, { replace: true })
      }

      const handleMouseUp = (e: MouseEvent) => {
        const deltaY = e.clientY - startYRef.current
        const newHeight = getHeightFromDelta(deltaY)
        if (newHeight !== startHeightRef.current) {
          onSizeChangeRef.current({ height: newHeight }, { replace: false })
        } else {
          onSizeChangeRef.current({}, { replace: false })
        }

        setIsHeightDragging(false)
        ownerDocument.body.style.cursor = previousCursor
        ownerDocument.body.style.userSelect = previousUserSelect
        ownerDocument.removeEventListener('mousemove', handleMouseMove)
        ownerDocument.removeEventListener('mouseup', handleMouseUp)
      }

      ownerDocument.addEventListener('mousemove', handleMouseMove)
      ownerDocument.addEventListener('mouseup', handleMouseUp)
    },
    [getHeightFromDelta, height],
  )

  const handleWidthMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const maxWidth = getMaxWidth()
      if (!maxWidth) return

      e.preventDefault()
      setIsWidthDragging(true)
      startXRef.current = e.clientX
      startWidthRef.current = Math.min(width ?? maxWidth, maxWidth)

      const ownerDocument = e.currentTarget.ownerDocument
      const previousCursor = ownerDocument.body.style.cursor
      const previousUserSelect = ownerDocument.body.style.userSelect
      ownerDocument.body.style.cursor = 'ew-resize'
      ownerDocument.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current
        const newWidth = getWidthFromDelta({ deltaX, maxWidth })
        onSizeChangeRef.current({ width: newWidth }, { replace: true })
      }

      const handleMouseUp = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current
        const newWidth = getWidthFromDelta({ deltaX, maxWidth })
        if (newWidth !== width) {
          onSizeChangeRef.current({ width: newWidth }, { replace: false })
        } else {
          onSizeChangeRef.current({}, { replace: false })
        }

        setIsWidthDragging(false)
        ownerDocument.body.style.cursor = previousCursor
        ownerDocument.body.style.userSelect = previousUserSelect
        ownerDocument.removeEventListener('mousemove', handleMouseMove)
        ownerDocument.removeEventListener('mouseup', handleMouseUp)
      }

      ownerDocument.addEventListener('mousemove', handleMouseMove)
      ownerDocument.addEventListener('mouseup', handleMouseUp)
    },
    [getMaxWidth, getWidthFromDelta, width],
  )

  const handleWidthDoubleClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (width !== undefined) {
        onSizeChangeRef.current({ width: undefined }, { replace: false })
      }
    },
    [width],
  )

  const handleCornerMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const maxWidth = getMaxWidth()
      if (!maxWidth) return

      e.preventDefault()
      e.stopPropagation()
      setIsHeightDragging(true)
      setIsWidthDragging(true)
      setIsCornerDragging(true)
      startXRef.current = e.clientX
      startYRef.current = e.clientY
      startHeightRef.current = height
      startWidthRef.current = Math.min(width ?? maxWidth, maxWidth)

      const ownerDocument = e.currentTarget.ownerDocument
      const previousCursor = ownerDocument.body.style.cursor
      const previousUserSelect = ownerDocument.body.style.userSelect
      ownerDocument.body.style.cursor = 'nwse-resize'
      ownerDocument.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current
        const deltaY = e.clientY - startYRef.current
        const newHeight = getHeightFromDelta(deltaY)
        const newWidth = getWidthFromDelta({ deltaX, maxWidth })

        onSizeChangeRef.current(
          { height: newHeight, width: newWidth },
          { replace: true },
        )
      }

      const handleMouseUp = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current
        const deltaY = e.clientY - startYRef.current
        const newHeight = getHeightFromDelta(deltaY)
        const newWidth = getWidthFromDelta({ deltaX, maxWidth })
        const hasHeightChanged = newHeight !== startHeightRef.current
        const hasWidthChanged = newWidth !== width

        if (hasHeightChanged || hasWidthChanged) {
          onSizeChangeRef.current(
            {
              ...(hasHeightChanged ? { height: newHeight } : {}),
              ...(hasWidthChanged ? { width: newWidth } : {}),
            },
            { replace: false },
          )
        } else {
          onSizeChangeRef.current({}, { replace: false })
        }

        setIsHeightDragging(false)
        setIsWidthDragging(false)
        setIsCornerDragging(false)
        ownerDocument.body.style.cursor = previousCursor
        ownerDocument.body.style.userSelect = previousUserSelect
        ownerDocument.removeEventListener('mousemove', handleMouseMove)
        ownerDocument.removeEventListener('mouseup', handleMouseUp)
      }

      ownerDocument.addEventListener('mousemove', handleMouseMove)
      ownerDocument.addEventListener('mouseup', handleMouseUp)
    },
    [getHeightFromDelta, getMaxWidth, getWidthFromDelta, height, width],
  )

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className="relative mx-auto"
        style={{ width: width ?? '100%', maxWidth: '100%' }}
      >
        {children}
        {enableWidthResize ? (
          <div
            role="separator"
            aria-label="Resize chart width"
            aria-orientation="vertical"
            onMouseDown={handleWidthMouseDown}
            onDoubleClick={handleWidthDoubleClick}
            className={`absolute right-0 top-0 z-20 flex w-3 cursor-ew-resize select-none items-center justify-center ${
              isWidthDragging ? 'bg-blue-500/20' : 'hover:bg-gray-500/20'
            }`}
            style={{ height: Math.max(0, height - 8) }}
          >
            <div className="h-8 w-1 rounded-full bg-gray-400" />
          </div>
        ) : null}
        {enableWidthResize ? (
          <div
            role="separator"
            aria-label="Resize chart width and height"
            aria-orientation="horizontal"
            onMouseDown={handleCornerMouseDown}
            onDoubleClick={handleWidthDoubleClick}
            className={`absolute right-0 z-40 flex h-5 w-5 cursor-nwse-resize select-none items-end justify-end rounded-tl-md p-1 ${
              isCornerDragging ? 'bg-blue-500/25' : 'hover:bg-gray-500/20'
            }`}
            style={{ top: Math.max(0, height - 20) }}
          >
            <div className="h-2.5 w-2.5 border-b-2 border-r-2 border-gray-400" />
          </div>
        ) : null}
        <div
          role="separator"
          aria-label="Resize chart height"
          aria-orientation="horizontal"
          onMouseDown={handleHeightMouseDown}
          className={`absolute left-0 right-0 z-30 flex h-2 cursor-ns-resize select-none items-center justify-center ${
            isHeightDragging ? 'bg-blue-500' : 'hover:bg-gray-500/20'
          }`}
          style={{ top: Math.max(0, height - 2) }}
        >
          <div className="h-1 w-8 rounded-full bg-gray-400" />
        </div>
      </div>
    </div>
  )
}
