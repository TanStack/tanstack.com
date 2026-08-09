import * as React from 'react'
import { getChartsCatalogAssetUrl } from '~/utils/charts-catalog'

export type ChartsCatalogModuleReference = {
  path: string
  preload: Array<string>
}

type ChartMountInput = {
  width: number
  height: number
  revision: number
  interactive?: boolean
  preview?: boolean
}

type ChartMountHandle = {
  update(input: ChartMountInput): void
  destroy(): void
}

type ChartRuntimeModule = {
  mount(container: HTMLElement, input: ChartMountInput): ChartMountHandle
}

export function ChartsCatalogChart({
  artifactRevision,
  caseId,
  defer = false,
  fill = false,
  height = 360,
  interactive = true,
  logicalWidth,
  module,
  onStatus,
  preview = false,
  revision = 0,
}: {
  artifactRevision: string
  caseId: string
  defer?: boolean
  fill?: boolean
  height?: number
  interactive?: boolean
  logicalWidth?: number
  module: ChartsCatalogModuleReference
  onStatus?: (status: 'ready' | 'resize' | 'error') => void
  preview?: boolean
  revision?: number
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const handleRef = React.useRef<ChartMountHandle | undefined>(undefined)
  const inputRef = React.useRef({ interactive, preview, revision })
  const sizeRef = React.useRef({ fill, height, logicalWidth })
  const onStatusRef = React.useRef(onStatus)
  const [visible, setVisible] = React.useState(!defer)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    inputRef.current = { interactive, preview, revision }
  }, [interactive, preview, revision])

  React.useEffect(() => {
    sizeRef.current = { fill, height, logicalWidth }
  }, [fill, height, logicalWidth])

  React.useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  React.useEffect(() => {
    const container = containerRef.current
    if (!defer || visible || !container) return

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '480px 0px' },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [defer, visible])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || !visible) return

    let cancelled = false
    let mountedHandle: ChartMountHandle | undefined
    let size = measureChart(container, sizeRef.current)
    const preloadLinks = module.preload.map((assetPath) => {
      const link = document.createElement('link')
      link.rel = 'modulepreload'
      link.href = getChartsCatalogAssetUrl(artifactRevision, assetPath)
      document.head.appendChild(link)
      return link
    })

    setFailed(false)

    void import(
      /* @vite-ignore */
      getChartsCatalogAssetUrl(artifactRevision, module.path)
    )
      .then((loaded: unknown) => {
        if (cancelled) return
        if (!isChartRuntimeModule(loaded)) {
          throw new TypeError('Invalid Charts catalog runtime module')
        }

        const mounted = loaded.mount(container, {
          ...size,
          ...inputRef.current,
        })
        if (!isChartMountHandle(mounted)) {
          throw new TypeError('Invalid Charts catalog mount handle')
        }
        mountedHandle = mounted
        handleRef.current = mounted
        requestAnimationFrame(() => {
          if (!cancelled) onStatusRef.current?.('ready')
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error(`Unable to mount Charts catalog case ${caseId}`, error)
        setFailed(true)
        onStatusRef.current?.('error')
      })

    const resizeObserver = new ResizeObserver(() => {
      const nextSize = measureChart(container, sizeRef.current)
      if (nextSize.width === size.width && nextSize.height === size.height) {
        return
      }
      size = nextSize
      handleRef.current?.update({
        ...size,
        ...inputRef.current,
      })
      onStatusRef.current?.('resize')
    })
    resizeObserver.observe(container)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      mountedHandle?.destroy()
      if (handleRef.current === mountedHandle) {
        handleRef.current = undefined
      }
      for (const link of preloadLinks) link.remove()
      container.replaceChildren()
    }
  }, [artifactRevision, caseId, module, visible])

  React.useEffect(() => {
    const container = containerRef.current
    const handle = handleRef.current
    if (!container || !handle) return

    handle.update({
      ...measureChart(container, sizeRef.current),
      ...inputRef.current,
    })
  }, [fill, height, interactive, logicalWidth, preview, revision])

  return (
    <div
      className={`charts-catalog-chart relative w-full overflow-visible ${
        fill ? 'h-full' : ''
      }`}
      data-chart-case={caseId}
      style={fill ? undefined : { height }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {!visible || failed ? (
        <div
          className={`absolute inset-0 rounded-lg ${
            failed
              ? 'grid place-items-center text-sm text-red-700 dark:text-red-300'
              : 'animate-pulse bg-gray-100 dark:bg-gray-900'
          }`}
        >
          {failed ? 'Render failed' : null}
        </div>
      ) : null}
    </div>
  )
}

function measureChart(
  container: HTMLElement,
  {
    fill,
    height,
    logicalWidth,
  }: { fill: boolean; height: number; logicalWidth?: number },
) {
  const bounds = container.getBoundingClientRect()
  return {
    width: Math.max(1, Math.floor(logicalWidth ?? bounds.width)),
    height: Math.max(1, Math.floor(fill ? bounds.height : height)),
  }
}

function isChartRuntimeModule(value: unknown): value is ChartRuntimeModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mount' in value &&
    typeof value.mount === 'function'
  )
}

function isChartMountHandle(value: unknown): value is ChartMountHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'update' in value &&
    typeof value.update === 'function' &&
    'destroy' in value &&
    typeof value.destroy === 'function'
  )
}
