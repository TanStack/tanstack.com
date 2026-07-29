import * as React from 'react'
import { useTheme } from '~/components/ThemeProvider'
import { parseChartsCatalogEmbed } from '~/utils/charts-catalog-embed'

type ChartsCatalogEmbedProps = Omit<
  React.IframeHTMLAttributes<HTMLIFrameElement>,
  'src'
> & {
  deferUntilVisible?: boolean
  src: string
  theme?: 'dark' | 'light' | 'system'
}

export function ChartsCatalogEmbed({
  className,
  deferUntilVisible = false,
  loading = 'lazy',
  onLoad,
  src,
  theme = 'system',
  title,
  ...iframeProps
}: ChartsCatalogEmbedProps) {
  const { resolvedTheme } = useTheme()
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const [shouldLoad, setShouldLoad] = React.useState(!deferUntilVisible)
  const chartEmbed = React.useMemo(() => parseChartsCatalogEmbed(src), [src])
  const iframeTitle = title?.trim() || 'TanStack Charts example'
  const resolvedEmbedTheme = theme === 'system' ? resolvedTheme : theme

  React.useEffect(() => {
    const frame = frameRef.current
    if (!deferUntilVisible || shouldLoad || !frame) return

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '480px 0px' },
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [deferUntilVisible, shouldLoad])

  const postChartTheme = React.useCallback(() => {
    const target = frameRef.current?.contentWindow
    if (!chartEmbed || !target || !shouldLoad) return

    target.postMessage(
      {
        type: 'tanstack-charts:embed',
        version: 1,
        command: 'set-theme',
        caseId: chartEmbed.caseId,
        theme: resolvedEmbedTheme,
      },
      chartEmbed.origin,
    )
  }, [chartEmbed, resolvedEmbedTheme, shouldLoad])

  React.useEffect(() => {
    const frame = frameRef.current
    const target = frame?.contentWindow
    if (!chartEmbed || !frame || !target || !shouldLoad) return

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== chartEmbed.origin ||
        event.source !== target ||
        !isChartEmbedStatusMessage(event.data, chartEmbed.caseId)
      ) {
        return
      }
      if (chartEmbed.source !== 'hidden') {
        frame.style.height = `${event.data.height}px`
      }
      postChartTheme()
    }

    window.addEventListener('message', handleMessage)
    postChartTheme()
    return () => window.removeEventListener('message', handleMessage)
  }, [chartEmbed, postChartTheme, shouldLoad])

  if (!chartEmbed) return null

  return (
    <iframe
      title={iframeTitle}
      {...iframeProps}
      ref={frameRef}
      src={shouldLoad ? src : undefined}
      loading={loading}
      referrerPolicy="strict-origin-when-cross-origin"
      className={`block w-full ${className ?? ''}`.trim()}
      data-chart-catalog-embed={chartEmbed.caseId}
      onLoad={(event) => {
        onLoad?.(event)
        postChartTheme()
      }}
    />
  )
}

function isChartEmbedStatusMessage(
  value: unknown,
  caseId: string,
): value is {
  type: 'tanstack-charts:embed'
  version: 1
  status: 'ready' | 'resize' | 'error'
  caseId: string
  height: number
} {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'tanstack-charts:embed' &&
    'version' in value &&
    value.version === 1 &&
    'status' in value &&
    (value.status === 'ready' ||
      value.status === 'resize' ||
      value.status === 'error') &&
    'caseId' in value &&
    value.caseId === caseId &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height) &&
    value.height > 0
  )
}
