import * as React from 'react'
import * as Plot from '@observablehq/plot'
import { ParentSize } from '@visx/responsive'

type NpmStats = {
  start: string
  end: string
  package: string
  downloads: Array<{
    downloads: number
    day: string
  }>
}

export function NpmStatsChart({ stats }: { stats: NpmStats[] }) {
  const plotRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!stats.length || !plotRef.current) return

    // Flatten the data for the plot
    const plotData = stats.flatMap((stat) =>
      stat.downloads.map((d) => ({
        ...d,
        package: stat.package,
        date: new Date(d.day),
      }))
    )

    const chart = Plot.plot({
      marginLeft: 50,
      marginRight: 0,
      marginBottom: 70,
      width: plotRef.current.clientWidth,
      height: plotRef.current.clientHeight,
      marks: [
        Plot.line(plotData, {
          x: 'date',
          y: 'downloads',
          stroke: 'package',
          strokeWidth: 2,
        }),
      ],
      x: {
        type: 'time',
        label: 'Date',
        labelOffset: 35,
        tickFormat: (d: Date) => d.toLocaleDateString(),
      },
      y: {
        label: 'Downloads',
        labelOffset: 35,
        tickFormat: (d: number) => {
          if (d >= 1000000) {
            return `${(d / 1000000).toFixed(1)}M`
          }
          if (d >= 1000) {
            return `${(d / 1000).toFixed(1)}K`
          }
          return d.toString()
        },
      },
      grid: true,
      color: {
        legend: true,
      },
    })

    plotRef.current.appendChild(chart)

    return () => {
      if (plotRef.current) {
        plotRef.current.innerHTML = ''
      }
    }
  }, [stats])

  return (
    <ParentSize>
      {({ width, height }) => (
        <div
          ref={plotRef}
          style={{
            width,
            height: Math.max(400, height * 0.6),
          }}
        />
      )}
    </ParentSize>
  )
}
