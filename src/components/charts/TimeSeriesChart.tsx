import * as React from 'react'
import * as d3 from 'd3'
import {
  areaY,
  barY,
  d3Curve,
  defineChart,
  dot,
  lineY,
  type ChartPoint,
} from '@tanstack/charts'
import { tooltip } from '@tanstack/charts/tooltip'
import { Chart } from '@tanstack/react-charts'
import { type BinType, binTimeSeriesData } from '~/utils/chart'

export type ChartVariant = 'area' | 'bar' | 'cumulative'

type TimeSeriesDatum = {
  count: number
  date: Date
  id: number
  value: number
}

type TimeSeriesChartInput = {
  color: string
  data: Array<TimeSeriesDatum>
  variant: ChartVariant
  yLabel: string
}

function createTimeSeriesChart(input: TimeSeriesChartInput) {
  const firstDate = input.data[0]?.date ?? new Date(0)
  const lastDate = input.data.at(-1)?.date ?? new Date(86_400_000)
  const maxValue = d3.max(input.data, (datum) => datum.value) ?? 1
  const curve = d3Curve(d3.curveMonotoneX)

  return defineChart({
    marks:
      input.variant === 'bar'
        ? [
            barY(input.data, {
              id: 'time-series-bars',
              x: 'date',
              y: 'value',
              key: 'id',
              fill: input.color,
              fillOpacity: 0.8,
              inset: 1,
            }),
          ]
        : [
            areaY(input.data, {
              id: 'time-series-area',
              x: 'date',
              y1: 0,
              y2: 'value',
              key: 'id',
              fill: input.color,
              fillOpacity: 0.2,
              curve,
            }),
            lineY(input.data, {
              id: 'time-series-line',
              x: 'date',
              y: 'value',
              key: 'id',
              stroke: input.color,
              strokeWidth: 2,
              curve,
            }),
            dot(input.data, {
              id: 'time-series-points',
              x: 'date',
              y: 'value',
              key: 'id',
              fill: input.color,
              r: 3,
            }),
          ],
    x: {
      scale: d3.scaleUtc().domain([firstDate, lastDate]).nice(),
      axis: { label: 'Date' },
      grid: true,
    },
    y: {
      scale: d3.scaleLinear().domain([0, maxValue]).nice(),
      axis: { label: input.yLabel },
      grid: true,
    },
    margin: { top: 20, right: 20, bottom: 40, left: 60 },
    theme: { background: 'transparent' },
    animate: true,
    tooltip: { use: tooltip, format: formatTooltip },
  })
}

type TimeSeriesChartProps = {
  data: Array<{ date: string; count: number }>
  binType: BinType
  variant?: ChartVariant
  color?: string
  height?: number
  yLabel?: string
}

export function TimeSeriesChart({
  data,
  binType,
  variant = 'area',
  color = '#3b82f6',
  height = 200,
  yLabel,
}: TimeSeriesChartProps) {
  const chartData = React.useMemo(() => {
    let total = 0

    return binTimeSeriesData(data, binType).map((datum) => {
      total += datum.count
      return {
        ...datum,
        id: datum.date.getTime(),
        value: variant === 'cumulative' ? total : datum.count,
      }
    })
  }, [binType, data, variant])
  const definition = React.useMemo(
    () =>
      createTimeSeriesChart({
        color,
        data: chartData,
        variant,
        yLabel: yLabel ?? (variant === 'cumulative' ? 'Total' : 'Count'),
      }),
    [chartData, color, variant, yLabel],
  )

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No data available
      </div>
    )
  }

  return (
    <Chart
      definition={definition}
      height={height}
      initialWidth={640}
      ariaLabel={`${variant === 'cumulative' ? 'Cumulative' : variant} count by date`}
    />
  )
}

function formatTooltip(point: ChartPoint<TimeSeriesDatum>) {
  const valueLabel =
    point.datum.value === point.datum.count
      ? point.datum.value.toLocaleString()
      : `${point.datum.value.toLocaleString()} total`

  return `${point.datum.date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}\n${valueLabel}`
}
