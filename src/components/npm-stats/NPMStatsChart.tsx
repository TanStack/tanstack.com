import * as React from 'react'
import * as v from 'valibot'
import * as Plot from '@observablehq/plot'
import * as d3 from 'd3'
import { ParentSize } from '~/components/ParentSize'
import { packageGroupSchema } from '~/routes/stats/npm/-comparisons'
import { defaultColors } from '~/utils/npm-packages'

// Types
export type PackageGroup = v.InferOutput<typeof packageGroupSchema>

export const binTypeSchema = v.picklist([
  'yearly',
  'monthly',
  'weekly',
  'daily',
])
export type BinType = v.InferOutput<typeof binTypeSchema>

export const transformModeSchema = v.picklist(['none', 'normalize-y'])
export type TransformMode = v.InferOutput<typeof transformModeSchema>

export const showDataModeSchema = v.picklist(['all', 'complete'])
export type ShowDataMode = v.InferOutput<typeof showDataModeSchema>

export type TimeRange =
  | '7-days'
  | '30-days'
  | '90-days'
  | '180-days'
  | '365-days'
  | '730-days'
  | '1825-days'
  | 'all-time'

export type FacetValue = 'name'

// Type for query data returned from npm stats API
export type NpmQueryData = Array<{
  packages: Array<{
    name?: string
    hidden?: boolean
    downloads: Array<{ day: string; downloads: number }>
  }>
  start: string
  end: string
  error?: string
  actualStartDate?: Date
}>

// Binning options configuration
export const binningOptions = [
  {
    label: 'Yearly',
    value: 'yearly',
    single: 'year',
    bin: d3.utcYear,
  },
  {
    label: 'Monthly',
    value: 'monthly',
    single: 'month',
    bin: d3.utcMonth,
  },
  {
    label: 'Weekly',
    value: 'weekly',
    single: 'week',
    bin: d3.utcWeek,
  },
  {
    label: 'Daily',
    value: 'daily',
    single: 'day',
    bin: d3.utcDay,
  },
] as const

export const binningOptionsByType = binningOptions.reduce(
  (acc, option) => {
    acc[option.value] = option
    return acc
  },
  {} as Record<BinType, (typeof binningOptions)[number]>,
)

export const timeRanges = [
  { value: '7-days', label: '7 Days' },
  { value: '30-days', label: '30 Days' },
  { value: '90-days', label: '90 Days' },
  { value: '180-days', label: '6 Months' },
  { value: '365-days', label: '1 Year' },
  { value: '730-days', label: '2 Years' },
  { value: '1825-days', label: '5 Years' },
  { value: 'all-time', label: 'All Time' },
] as const

export const defaultRangeBinTypes: Record<TimeRange, BinType> = {
  '7-days': 'daily',
  '30-days': 'daily',
  '90-days': 'weekly',
  '180-days': 'weekly',
  '365-days': 'weekly',
  '730-days': 'monthly',
  '1825-days': 'monthly',
  'all-time': 'monthly',
}

// Get or assign colors for packages
export function getPackageColor(
  packageName: string,
  packages: PackageGroup[],
): string {
  // Find the package group that contains this package
  const packageInfo = packages.find((pkg) =>
    pkg.packages.some((p) => p.name === packageName),
  )
  if (packageInfo?.color) {
    return packageInfo.color
  }

  // Otherwise, assign a default color based on the package's position
  const packageIndex = packages.findIndex((pkg) =>
    pkg.packages.some((p) => p.name === packageName),
  )
  return defaultColors[packageIndex % defaultColors.length]
}

// Custom number formatter for more precise control
export const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`
  }
  return num.toString()
}

// Check if a binning option is valid for a time range
export function isBinningOptionValidForRange(
  range: TimeRange,
  binType: BinType,
): boolean {
  switch (range) {
    case '7-days':
    case '30-days':
      return binType === 'daily'
    case '90-days':
    case '180-days':
      return (
        binType === 'daily' || binType === 'weekly' || binType === 'monthly'
      )
    case '365-days':
      return (
        binType === 'daily' || binType === 'weekly' || binType === 'monthly'
      )
    case '730-days':
    case '1825-days':
    case 'all-time':
      return true
  }
}

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

  // Apply the baseline correction
  const baselinePackageIndex = packages.findIndex((pkg) => {
    return pkg.baseline
  })

  const baselinePackage = binnedPackageData[baselinePackageIndex]

  const baseLineValuesByDate =
    baselinePackage && binnedPackageData.length
      ? (() => {
          return new Map(
            baselinePackage.downloads.map((d) => {
              return [d.date.getTime(), d.downloads]
            }),
          )
        })()
      : undefined

  const correctedPackageData = binnedPackageData.map((packageGroup) => {
    const first = packageGroup.downloads[0]
    const firstDownloads = first?.downloads ?? 0

    return {
      ...packageGroup,
      downloads: packageGroup.downloads.map((d) => {
        if (baseLineValuesByDate) {
          d.downloads =
            d.downloads / (baseLineValuesByDate.get(d.date.getTime()) || 1)
        }

        return {
          ...d,
          change: d.downloads - firstDownloads,
        }
      }),
    }
  })

  // Filter out any top-level hidden packages
  const filteredPackageData = correctedPackageData.filter((_, index) => {
    const packageGroupWithHidden = packages[index]
    const isHidden = packageGroupWithHidden?.packages[0]?.hidden
    const isBaseline = packageGroupWithHidden?.baseline
    return !isBaseline && !isHidden
  })

  const plotData = filteredPackageData.flatMap((d) => d.downloads)

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
                  : baselinePackage
                    ? 'Downloads (% of baseline)'
                    : 'Downloads',
              labelOffset: 35,
            },
            grid: true,
            color: {
              domain: [...new Set(plotData.map((d) => d.name))],
              range: [...new Set(plotData.map((d) => d.name))]
                .filter((pkg): pkg is string => pkg !== undefined)
                .map((pkg) => getPackageColor(pkg, packages)),
              legend: false,
            },
          }}
        />
      )}
    </ParentSize>
  )
}
