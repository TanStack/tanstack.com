import * as React from 'react'
import { parseChartsCatalogEmbed } from '~/utils/charts-catalog-embed'
import { ChartsCatalogDocExample } from './ChartsCatalogDocExample'

type ChartsCatalogEmbedProps = Omit<
  React.IframeHTMLAttributes<HTMLIFrameElement>,
  'src'
> & {
  deferUntilVisible?: boolean
  src: string
  theme?: 'dark' | 'light' | 'system'
}

export function ChartsCatalogEmbed({
  height: heightProp,
  src,
  title,
}: ChartsCatalogEmbedProps) {
  const chartEmbed = React.useMemo(() => parseChartsCatalogEmbed(src), [src])

  if (!chartEmbed) return null

  return (
    <ChartsCatalogDocExample
      caseId={chartEmbed.caseId}
      height={getInitialHeight(heightProp, src)}
      source={chartEmbed.source}
      title={title}
    />
  )
}

function getInitialHeight(
  height: React.IframeHTMLAttributes<HTMLIFrameElement>['height'],
  src: string | undefined,
) {
  const numericHeight =
    typeof height === 'number'
      ? height
      : typeof height === 'string'
        ? Number(height)
        : Number.NaN
  if (Number.isSafeInteger(numericHeight) && numericHeight >= 120) {
    return numericHeight
  }

  if (!src) return 360
  const urlHeight = Number(new URL(src).searchParams.get('height'))
  return Number.isSafeInteger(urlHeight) && urlHeight >= 120 ? urlHeight : 360
}
