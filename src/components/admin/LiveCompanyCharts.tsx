import { useMemo } from 'react'
import { areaY, defineChart, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { scaleLinear, scaleUtc } from 'd3'

export type CompanySample = { time: number; companies: number }

export function LiveCompanyTrend({
  samples,
  count,
}: {
  samples: CompanySample[]
  count: number
}) {
  const definition = useMemo(() => {
    const first = samples[0]?.time ?? Date.now()
    const last = Math.max(first + 1_000, samples.at(-1)?.time ?? first)
    const points = samples.map((sample) => ({
      ...sample,
      date: new Date(sample.time),
    }))
    return defineChart({
      marks: [
        areaY(points, {
          x: 'date',
          y1: 0,
          y2: 'companies',
          fill: '#10b981',
          fillOpacity: 0.12,
        }),
        lineY(points, {
          x: 'date',
          y: 'companies',
          stroke: '#10b981',
          strokeWidth: 2,
        }),
      ],
      scales: {
        x: {
          scale: scaleUtc().domain([new Date(first), new Date(last)]),
          axis: {
            ticks: {
              count: 3,
              format: (value) =>
                new Date(value).toLocaleTimeString([], {
                  minute: '2-digit',
                  second: '2-digit',
                }),
            },
          },
        },
        y: {
          scale: scaleLinear()
            .domain([
              0,
              Math.max(3, ...samples.map((sample) => sample.companies)),
            ])
            .nice(),
          grid: true,
          axis: {
            ticks: {
              count: 3,
              format: (value) => (Number.isInteger(value) ? String(value) : ''),
            },
          },
        },
      },
      margin: { top: 10, right: 10, bottom: 24, left: 25 },
      theme: {
        background: 'transparent',
        foreground: 'currentColor',
        muted: '#6b7280',
        grid: 'rgba(107, 114, 128, 0.15)',
      },
    })
  }, [samples])
  return (
    <section className="min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Identified companies online
        </h2>
        <span className="text-[11px] text-gray-500">
          Since opened · up to 5m
        </span>
      </div>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
        {count}
      </p>
      <div className="mt-3 h-36">
        {samples.length < 2 ? (
          <p className="flex h-full items-center text-xs text-gray-500">
            Trend starts with the next live update.
          </p>
        ) : (
          <Chart
            definition={definition}
            height={144}
            initialWidth={400}
            ariaLabel="Identified companies online since this dashboard opened, up to five minutes"
          />
        )}
      </div>
    </section>
  )
}

export function CompanyBreakdownChart({
  title,
  items,
  color,
  note,
}: {
  title: string
  items: { name: string; value: number }[]
  color: string
  note?: string
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value))
  return (
    <section className="min-w-0 p-5 sm:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2
          className="text-sm font-medium text-gray-600 dark:text-gray-400"
          title={note}
        >
          {title}
        </h2>
        <span className="text-[11px] text-gray-500">Companies</span>
      </div>
      {items.length === 0 ? (
        <p className="flex h-40 items-center text-xs text-gray-500">
          No identified companies online yet.
        </p>
      ) : (
        <ul className="space-y-3.5" aria-label={title}>
          {items.map((item) => (
            <li key={item.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="font-mono tabular-nums">{item.value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-500/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.value / maximum) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
