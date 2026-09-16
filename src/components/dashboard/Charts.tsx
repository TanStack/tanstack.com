import { useMemo } from 'react'
import { areaY, lineY, barY, defineChart } from '@tanstack/charts'
import { Chart } from '~/components/charts/Chart'
import { tooltip } from '@tanstack/charts/tooltip'
import { scaleBand, scaleLinear } from 'd3-scale'
import type { exploreTrips } from './model'

type Analysis = ReturnType<typeof exploreTrips>
export function TripTrend({
  data,
  dark,
  height,
  onDay,
}: {
  data: Analysis['timeline']
  dark: boolean
  height: number
  onDay: (day: number) => void
}) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(data, {
            x: 'index',
            key: 'index',
            y1: 0,
            y2: 'count',
            fill: '#818cf8',
            fillOpacity: 0.15,
          }),
          lineY(data, {
            x: 'index',
            key: 'index',
            y: 'count',
            stroke: '#818cf8',
            strokeWidth: 2,
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([0, 167]),
            axis: {
              ticks: {
                values: [0, 24, 48, 72, 96, 120, 144],
                format: (value) => `Jan ${Math.floor(value / 24) + 1}`,
              },
            },
          },
          y: {
            scale: scaleLinear()
              .domain([0, Math.max(1, ...data.map((row) => row.count))])
              .nice(),
            axis: { ticks: { count: 4 } },
            grid: true,
          },
        },
        margin: { left: 36, right: 12, top: 10, bottom: 28 },
        theme: {
          background: 'transparent',
          foreground: dark ? '#a1a1aa' : '#71717a',
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `Jan ${point.datum.day}, ${String(point.datum.index % 24).padStart(2, '0')}:00\n${point.datum.count} trips`,
        },
      }),
    [data, dark],
  )
  return (
    <Chart
      definition={definition}
      height={height}
      initialWidth={680}
      ariaLabel="Hourly trip volume, January 1 to 7. Select a point to filter by day."
      onSelect={(point) => {
        if (point) onDay(point.datum.day)
      }}
    />
  )
}
export function HourChart({
  data,
  dark,
}: {
  data: Analysis['hours']
  dark: boolean
}) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(data, {
            x: 'hour',
            key: 'hour',
            y: 'count',
            fill: '#818cf8',
            inset: 1,
          }),
        ],
        scales: {
          x: {
            scale: scaleBand(
              data.map((row) => row.hour),
              [0, 1],
            ).padding(0.22),
            axis: {
              ticks: {
                values: [0, 6, 12, 18, 23],
                format: (value) => `${value}:00`,
              },
            },
          },
          y: {
            scale: scaleLinear()
              .domain([0, Math.max(1, ...data.map((row) => row.count))])
              .nice(),
            axis: { ticks: { count: 3 } },
            grid: true,
          },
        },
        margin: { left: 36, right: 10, top: 8, bottom: 25 },
        theme: {
          background: 'transparent',
          foreground: dark ? '#a1a1aa' : '#71717a',
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${point.datum.hour}:00–${point.datum.hour + 1}:00\n${point.datum.count} trips`,
        },
      }),
    [data, dark],
  )
  return (
    <Chart
      definition={definition}
      height={148}
      initialWidth={320}
      ariaLabel="Trips by pickup hour, NYC local time"
    />
  )
}
export function DurationChart({
  data,
  dark,
}: {
  data: Analysis['durations']
  dark: boolean
}) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(data, {
            x: 'label',
            key: 'label',
            y: 'count',
            fill: '#2ba993',
            inset: 2,
          }),
        ],
        scales: {
          x: {
            scale: scaleBand(
              data.map((row) => row.label),
              [0, 1],
            ).padding(0.35),
            axis: {},
          },
          y: {
            scale: scaleLinear()
              .domain([0, Math.max(1, ...data.map((row) => row.count))])
              .nice(),
            axis: { ticks: { count: 3 } },
            grid: true,
          },
        },
        margin: { left: 36, right: 10, top: 8, bottom: 25 },
        theme: {
          background: 'transparent',
          foreground: dark ? '#a1a1aa' : '#71717a',
        },
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${point.datum.label} minutes\n${point.datum.count} trips`,
        },
      }),
    [data, dark],
  )
  return (
    <Chart
      definition={definition}
      height={148}
      initialWidth={320}
      ariaLabel="Trip duration in minutes. Bins include their lower bound; the final bin includes 180."
    />
  )
}
