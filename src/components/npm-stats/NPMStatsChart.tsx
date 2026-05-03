import * as React from 'react'
import * as Plot from '@observablehq/plot'
import * as d3 from 'd3'
import { ParentSize } from '~/components/ParentSize'
import { binningOptionsByType } from './binning'
import type {
  BinType,
  FacetValue,
  NpmQueryData,
  PackageGroup,
  ShowDataMode,
  TimeRange,
  TransformMode,
} from './shared'
import { getPackageColor } from './shared'
import { BASELINE_LINE_COLOR } from './BaselineSection'

const BASELINE_LINE_NAME = '__baseline__'

// Plot figure component
function PlotFigure({ options }: { options: Parameters<typeof Plot.plot>[0] }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!containerRef.current) return
    const plot = Plot.plot(options)
    containerRef.current.append(plot)
    return () => plot.remove()
  }, [options])

  return <div ref={containerRef} />
}

// Props for the NPMStatsChart component
export type NPMStatsChartProps = {
  queryData: NpmQueryData | undefined
  transform: TransformMode
  binType: BinType
  packages: PackageGroup[]
  range: TimeRange
  facetX?: FacetValue
  facetY?: FacetValue
  showDataMode: ShowDataMode
  normalizeBaseline?: boolean
  showBaseline?: boolean
}

export function NPMStatsChart({
  queryData,
  transform,
  binType,
  packages,
  range,
  facetX,
  facetY,
  showDataMode,
  normalizeBaseline = true,
  showBaseline = false,
}: NPMStatsChartProps) {
  if (!queryData?.length) return null

  const binOption = binningOptionsByType[binType]
  const binUnit = binningOptionsByType[binType].bin

  const now = d3.utcDay(new Date())

  let startDate = (() => {
    switch (range) {
      case '7-days':
        return d3.utcDay.offset(now, -7)
      case '30-days':
        return d3.utcDay.offset(now, -30)
      case '90-days':
        return d3.utcDay.offset(now, -90)
      case '180-days':
        return d3.utcDay.offset(now, -180)
      case '365-days':
        return d3.utcDay.offset(now, -365)
      case '730-days':
        return d3.utcDay.offset(now, -730)
      case '1825-days':
        return d3.utcDay.offset(now, -1825)
      case 'all-time':
        // Use the actual start date from the query data, or fall back to npm's stats start date
        const earliestActualStartDate = queryData
          .map((pkg) => pkg.actualStartDate)
          .filter((d): d is Date => d !== undefined)
          .sort((a, b) => a.getTime() - b.getTime())[0]
        return earliestActualStartDate || d3.utcDay(new Date('2015-01-10'))
    }
  })()

  startDate = binOption.bin.floor(startDate)

  const combinedPackageGroups = queryData.map((queryPackageGroup, index) => {
    // Get the corresponding package group from the packages prop to get the hidden state
    const packageGroupWithHidden = packages[index]

    // Filter out any sub packages that are hidden before
    // summing them into a unified downloads count
    const visiblePackages = queryPackageGroup.packages.filter((p, i) => {
      const hiddenState = packageGroupWithHidden?.packages.find(
        (pg) => pg.name === p.name,
      )?.hidden
      return !i || !hiddenState
    })

    const downloadsByDate: Map<number, number> = new Map()

    visiblePackages.forEach((pkg) => {
      pkg.downloads.forEach((d) => {
        // Clamp the data to the floor bin of the start date
        const date = d3.utcDay(new Date(d.day))
        if (date < startDate) return

        downloadsByDate.set(
          date.getTime(),
          // Sum the downloads for each date
          (downloadsByDate.get(date.getTime()) || 0) + d.downloads,
        )
      })
    })

    return {
      ...queryPackageGroup,
      downloads: Array.from(downloadsByDate.entries()).map(
        ([date, downloads]) => [d3.utcDay(new Date(date)), downloads],
      ) as [Date, number][],
    }
  })

  // Prepare data for plotting
  const binnedPackageData = combinedPackageGroups.map((packageGroup) => {
    // Now apply our binning as groupings
    const binned = d3.sort(
      d3.rollup(
        packageGroup.downloads,
        (v) => d3.sum(v, (d) => d[1]),
        (d) => binUnit.floor(d[0]),
      ),
      (d) => d[0],
    )

    const downloads = binned.map((d) => ({
      name: packageGroup.packages[0]?.name,
      date: d3.utcDay(new Date(d[0])),
      downloads: d[1],
    }))

    return {
      ...packageGroup,
      downloads,
    }
  })

  // Build the baseline divisor.
  //
  // Single-package baseline: divisor[T] = downloads_baseline[T]. Tracked
  // packages divided by this give "% of baseline" — intuitive when there's
  // one familiar reference like react.
  //
  // Multi-package baseline: equal-weighted growth index. Each baseline j is
  // first re-based to its own T0:  ix_j[T] = downloads_j[T] / downloads_j[T0].
  // We average ix across baseline packages to get a unitless multiplier B[T]
  // starting at 1.0 — each member contributes its growth rate equally
  // regardless of size, so the largest member can't dominate the line shape.
  // Tracked packages are then divided by B[T], yielding download values
  // adjusted for baseline growth.
  const baselineGroups = binnedPackageData.filter(
    (_, index) => packages[index]?.baseline,
  )
  const isMultiBaseline = baselineGroups.length > 1

  const baselineDivisorByDate = baselineGroups.length
    ? (() => {
        if (!isMultiBaseline) {
          // Single baseline group — divisor is its raw download counts.
          const single = new Map<number, number>()
          baselineGroups[0]?.downloads.forEach((d) => {
            single.set(d.date.getTime(), d.downloads)
          })
          return single
        }
        // Equal-weighted index: index each baseline to its own T0 then average.
        const perPackageIndex = baselineGroups.map((group) => {
          const t0 = group.downloads[0]?.downloads ?? 0
          const ix = new Map<number, number>()
          group.downloads.forEach((d) => {
            ix.set(d.date.getTime(), t0 > 0 ? d.downloads / t0 : 1)
          })
          return ix
        })
        const allDates = new Set<number>()
        perPackageIndex.forEach((ix) =>
          ix.forEach((_, key) => allDates.add(key)),
        )
        const averaged = new Map<number, number>()
        allDates.forEach((key) => {
          let sum = 0
          let count = 0
          perPackageIndex.forEach((ix) => {
            const v = ix.get(key)
            if (v !== undefined) {
              sum += v
              count++
            }
          })
          if (count > 0) averaged.set(key, sum / count)
        })
        return averaged
      })()
    : undefined

  const normalizeByBaseline = !!baselineDivisorByDate && normalizeBaseline

  const correctedPackageData = binnedPackageData.map((packageGroup) => {
    const first = packageGroup.downloads[0]
    const firstDownloads = first?.downloads ?? 0

    return {
      ...packageGroup,
      downloads: packageGroup.downloads.map((d) => {
        if (normalizeByBaseline && baselineDivisorByDate) {
          d.downloads =
            d.downloads / (baselineDivisorByDate.get(d.date.getTime()) || 1)
        }

        return {
          ...d,
          change: d.downloads - firstDownloads,
        }
      }),
    }
  })

  // Filter out any top-level hidden packages. Baseline series stay in the
  // plot when visible — they render as a flat reference line at 1.0 (every
  // point divided by itself) so users can see the baseline alongside the
  // normalized series.
  const filteredPackageData = correctedPackageData.filter((_, index) => {
    const packageGroupWithHidden = packages[index]
    const isHidden = packageGroupWithHidden?.packages[0]?.hidden
    return !isHidden
  })

  const plotData = filteredPackageData.flatMap((d) => d.downloads)

  if (showBaseline && baselineDivisorByDate) {
    const baselinePoints = [...baselineDivisorByDate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, divisor]) => ({
        name: BASELINE_LINE_NAME,
        date: d3.utcDay(new Date(time)),
        // When normalized, baseline / baseline = 1 at every point.
        // When raw, multi-baseline shows the growth-index multiplier (~1.0+);
        // single-baseline shows the raw divisor value (downloads).
        downloads: normalizeByBaseline ? 1 : divisor,
      }))
    const firstBaselineDownloads = baselinePoints[0]?.downloads ?? 0
    plotData.push(
      ...baselinePoints.map((d) => ({
        ...d,
        change: d.downloads - firstBaselineDownloads,
      })),
    )
  }

  const baseOptions: Plot.LineYOptions = {
    x: 'date',
    y: transform === 'normalize-y' ? 'change' : 'downloads',
    fx: facetX,
    fy: facetY,
  } as const

  const partialBinEnd = binUnit.floor(now)
  const partialBinStart = binUnit.offset(partialBinEnd, -1)

  // Force complete data mode when using relative change
  const effectiveShowDataMode =
    transform === 'normalize-y' ? 'complete' : showDataMode

  return (
    <ParentSize>
      {({ width = 1000, height }) => (
        <PlotFigure
          options={{
            marginLeft: 70,
            marginRight: 10,
            marginBottom: 70,
            width,
            height,
            marks: (
              [
                facetX || facetY
                  ? Plot.frame({
                      strokeOpacity: 0.2,
                    })
                  : undefined,
                Plot.ruleY([0], {
                  stroke: 'currentColor',
                  strokeWidth: 1.5,
                  strokeOpacity: 0.5,
                }),
                effectiveShowDataMode === 'all'
                  ? Plot.lineY(
                      plotData.filter((d) => d.date >= partialBinStart),
                      {
                        ...baseOptions,
                        stroke: 'name',
                        strokeWidth: 1.5,
                        strokeDasharray: '2 4',
                        strokeOpacity: 0.8,
                        curve: 'monotone-x',
                      },
                    )
                  : undefined,
                Plot.lineY(
                  plotData.filter((d) => d.date < partialBinEnd),
                  {
                    ...baseOptions,
                    stroke: 'name',
                    strokeWidth: 2,
                    curve: 'monotone-x',
                  },
                ),
                Plot.tip(
                  effectiveShowDataMode === 'all'
                    ? plotData
                    : plotData.filter((d) => d.date < partialBinEnd),
                  Plot.pointer({
                    ...baseOptions,
                    stroke: 'name',
                    format: {
                      x: (d) =>
                        d.toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        }),
                    },
                  } as Plot.TipOptions),
                ),
              ] as const
            ).filter(Boolean),
            x: {
              label: 'Date',
              labelOffset: 35,
            },
            y: {
              label:
                transform === 'normalize-y'
                  ? 'Downloads Growth'
                  : normalizeByBaseline
                    ? isMultiBaseline
                      ? 'Downloads (indexed)'
                      : 'Downloads (% of baseline)'
                    : 'Downloads',
              labelOffset: 35,
            },
            grid: true,
            color: {
              domain: [...new Set(plotData.map((d) => d.name))],
              range: [...new Set(plotData.map((d) => d.name))]
                .filter((pkg): pkg is string => pkg !== undefined)
                .map((pkg) =>
                  pkg === BASELINE_LINE_NAME
                    ? BASELINE_LINE_COLOR
                    : getPackageColor(pkg, packages),
                ),
              legend: false,
            },
          }}
        />
      )}
    </ParentSize>
  )
}
