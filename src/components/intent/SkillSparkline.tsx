import * as React from 'react'
import * as d3 from 'd3'
import { defineChart, rect, type ChartPoint } from '@tanstack/charts'
import { Chart } from '@tanstack/react-charts'
import type { SkillHistoryEntry } from '~/utils/intent.functions'

const changeColors = {
  added: '#22c55e',
  removed: '#ef4444',
  modified: '#f59e0b',
  unchanged: '#808080',
} as const

type ChangeType = keyof typeof changeColors
const changeTypes = [
  'added',
  'removed',
  'modified',
  'unchanged',
] as const satisfies ReadonlyArray<ChangeType>

type SparkRect = {
  entry: SkillHistoryEntry
  historyIndex: number
  id: string
  type: ChangeType
  x: number
  x1: number
  x2: number
  y: number
  y1: number
  y2: number
}

function createSkillSparkline(
  history: Array<SkillHistoryEntry>,
  slots: number,
  keyboard: boolean,
) {
  const responsiveDefinition = defineChart(({ width }) => {
    const offset = slots - history.length
    const pxPerSlot = width / slots
    const barPx = Math.min(10, pxPerSlot * 0.6)
    const barWidth = (barPx / 2) * (slots / width)
    const data: Array<SparkRect> = []

    history.forEach((entry, historyIndex) => {
      const x = historyIndex + offset
      const changes = [
        ['added', entry.added],
        ['modified', entry.modified],
        ['removed', entry.removed],
      ] as const
      let y = 0

      changes.forEach(([type, value]) => {
        if (value <= 0) return
        data.push({
          entry,
          historyIndex,
          id: `${historyIndex}:${type}`,
          type,
          x,
          x1: x - barWidth,
          x2: x + barWidth,
          y: y + value / 2,
          y1: y,
          y2: y + value,
        })
        y += value
      })

      if (y === 0) {
        data.push({
          entry,
          historyIndex,
          id: `${historyIndex}:unchanged`,
          type: 'unchanged',
          x,
          x1: x - barWidth,
          x2: x + barWidth,
          y: entry.total / 2,
          y1: 0,
          y2: entry.total,
        })
      }
    })

    return {
      marks: [
        rect(data, {
          id: 'skill-history',
          x: 'x',
          x1: 'x1',
          x2: 'x2',
          y: 'y',
          y1: 'y1',
          y2: 'y2',
          z: 'type',
          key: 'id',
          inset: 0,
        }),
      ],
      x: {
        scale: d3.scaleLinear().domain([-0.5, slots - 0.5]),
        guide: false,
      },
      y: {
        scale: d3
          .scaleLinear()
          .domain([0, d3.max(history, (entry) => entry.total) ?? 1]),
        guide: false,
      },
      color: {
        scale: d3
          .scaleOrdinal<ChangeType, string>()
          .domain(changeTypes)
          .range(changeTypes.map((type) => changeColors[type])),
      },
      guides: false,
      margin: 2,
      theme: { background: 'transparent' },
    }
  })

  return defineChart(responsiveDefinition, {
    keyboard,
    tooltip: { format: formatSparkTooltip },
  })
}

export function SkillSparklinePlaceholder({
  height = 40,
}: {
  height?: number
}) {
  return (
    <div
      className="animate-pulse rounded bg-gray-100 dark:bg-gray-800/40"
      style={{ width: '100%', height }}
    />
  )
}

interface SkillSparklineProps {
  history: Array<SkillHistoryEntry>
  height?: number
  maxSlots?: number
  onVersionClick?: (entry: SkillHistoryEntry, index: number) => void
}

export function SkillSparkline({
  history,
  height = 40,
  maxSlots,
  onVersionClick,
}: SkillSparklineProps) {
  const slots = Math.max(maxSlots ?? history.length, history.length)
  const keyboard = Boolean(onVersionClick)
  const skillSparkline = React.useMemo(
    () => createSkillSparkline(history, slots, keyboard),
    [history, keyboard, slots],
  )

  if (history.length === 0) return null

  return (
    <Chart
      definition={skillSparkline}
      height={height}
      initialWidth={320}
      ariaLabel="Skill changes by version"
      tabIndex={onVersionClick ? 0 : -1}
      onSelect={
        onVersionClick
          ? (point) => {
              if (!point) return
              onVersionClick(point.datum.entry, point.datum.historyIndex)
            }
          : undefined
      }
      style={onVersionClick ? { cursor: 'pointer' } : undefined}
    />
  )
}

function formatSparkTooltip(point: ChartPoint<SparkRect>) {
  const { entry } = point.datum
  const changes = [
    entry.added > 0 ? `Added +${entry.added}` : '',
    entry.removed > 0 ? `Removed -${entry.removed}` : '',
    entry.modified > 0 ? `Modified ~${entry.modified}` : '',
  ].filter(Boolean)

  return [`v${entry.version}`, `Skills ${entry.total}`, ...changes].join('\n')
}
