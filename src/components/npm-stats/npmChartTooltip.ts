import type { ChartPoint, ChartTooltipContentContext } from '@tanstack/charts'
import type { BarOrientation, ViewMode } from './shared'

export type NpmHistoryPoint = {
  color: string
  date: Date
  id: string
  label: string
  seriesName: string
  seriesLabel?: string
  value: number
}

export type NpmStackedHistoryPoint = NpmHistoryPoint & {
  fill: string
  value1: number
  value2: number
}

export type NpmBarPoint = {
  category: string
  color: string
  fill: string
  id: string
  label: string
  seriesName: string
  value1: number
  value2: number
}

type NpmChartDatum = NpmHistoryPoint | NpmStackedHistoryPoint | NpmBarPoint

export function getNpmChartTooltipContent(
  points: ReadonlyArray<ChartPoint<NpmChartDatum>>,
  context: ChartTooltipContentContext,
  input: {
    barOrientation: BarOrientation
    viewMode: ViewMode
    xLabel?: string
    yLabel?: string
    yFormat?: (value: number) => string
  },
) {
  const first = points[0]
  if (!first) return { rows: [] }

  const getLabel = (point: ChartPoint<NpmChartDatum>) =>
    ('seriesLabel' in point.datum ? point.datum.seriesLabel : undefined) ??
    point.groupLabel

  const formatValue = (point: ChartPoint<NpmChartDatum>) => {
    const datum = point.datum
    const value = 'value1' in datum ? datum.value2 - datum.value1 : datum.value

    return input.yFormat?.(value) ?? value.toLocaleString()
  }

  if (points.length > 1) {
    const title =
      input.viewMode === 'history'
        ? `Date: ${context.formatX(first.xValue)}`
        : input.barOrientation === 'horizontal'
          ? context.formatY(first.yValue)
          : context.formatX(first.xValue)

    return {
      title,
      rows: points.map((point) => ({
        active: point === context.primaryPoint,
        color: point.datum.color,
        label: getLabel(point),
        value: formatValue(point),
      })),
    }
  }

  return {
    title: getLabel(first),
    color: first.datum.color,
    rows:
      input.viewMode === 'history'
        ? [
            { label: 'Date', value: context.formatX(first.xValue) },
            {
              label: input.yLabel ?? 'Downloads',
              value: formatValue(first),
            },
          ]
        : [
            {
              label: input.xLabel ?? input.yLabel ?? 'Downloads',
              value: formatValue(first),
            },
          ],
  }
}
