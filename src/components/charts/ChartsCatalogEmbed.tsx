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
    const target = frameRef.current?.contentWindow
    if (!chartEmbed || !target || !shouldLoad) return

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== chartEmbed.origin ||
        event.source !== target ||
        !isReadyChartEmbedMessage(event.data, chartEmbed.caseId)
      ) {
        return
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

function isReadyChartEmbedMessage(value: unknown, caseId: string) {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'tanstack-charts:embed' &&
    'version' in value &&
    value.version === 1 &&
    'status' in value &&
    value.status === 'ready' &&
    'caseId' in value &&
    value.caseId === caseId
  )
}
