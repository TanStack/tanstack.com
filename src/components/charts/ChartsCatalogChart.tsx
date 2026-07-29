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
  height = 360,
  interactive = true,
  module,
  onStatus,
  revision = 0,
}: {
  artifactRevision: string
  caseId: string
  defer?: boolean
  height?: number
  interactive?: boolean
  module: ChartsCatalogModuleReference
  onStatus?: (status: 'ready' | 'resize' | 'error') => void
  revision?: number
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const handleRef = React.useRef<ChartMountHandle | undefined>(undefined)
  const inputRef = React.useRef({ height, interactive, revision })
  const onStatusRef = React.useRef(onStatus)
  const [visible, setVisible] = React.useState(!defer)
  const [failed, setFailed] = React.useState(false)

  inputRef.current = { height, interactive, revision }
  onStatusRef.current = onStatus

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
    let width = measureWidth(container)
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
          width,
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
      const nextWidth = measureWidth(container)
      if (nextWidth === width || nextWidth < 1) return
      width = nextWidth
      handleRef.current?.update({
        width,
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
      width: measureWidth(container),
      height,
      interactive,
      revision,
    })
  }, [height, interactive, revision])

  return (
    <div
      className="charts-catalog-chart relative w-full overflow-visible"
      data-chart-case={caseId}
      style={{ minHeight: height }}
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

function measureWidth(container: HTMLElement) {
  return Math.max(1, Math.floor(container.getBoundingClientRect().width))
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
