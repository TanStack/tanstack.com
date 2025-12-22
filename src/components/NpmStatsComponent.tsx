import * as React from 'react'
import { z } from 'zod'
import { useDebouncedValue, useThrottledCallback } from '@tanstack/react-pacer'
import {
  X,
  Plus,
  Eye,
  EyeOff,
  Pin,
  EllipsisVertical,
  Search,
} from 'lucide-react'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import * as Plot from '@observablehq/plot'
import { ParentSize } from '@visx/responsive'
import { Tooltip } from '~/components/Tooltip'
import * as d3 from 'd3'
import { HexColorPicker } from 'react-colorful'
import {
  getPopularComparisons,
  packageGroupSchema,
} from '~/routes/stats/npm/-comparisons'
import { twMerge } from 'tailwind-merge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { Command } from 'cmdk'
import { Spinner } from '~/components/Spinner'

const transformModeSchema = z.enum(['none', 'normalize-y'])
const binTypeSchema = z.enum(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = z.enum(['all', 'complete'])

const timeRanges = [
  { value: '7-days', label: '7 Days' },
  { value: '30-days', label: '30 Days' },
  { value: '90-days', label: '90 Days' },
  { value: '180-days', label: '6 Months' },
  { value: '365-days', label: '1 Year' },
  { value: '730-days', label: '2 Years' },
  { value: '1825-days', label: '5 Years' },
  { value: 'all-time', label: 'All Time' },
] as const

type TimeRange =
  | '7-days'
  | '30-days'
  | '90-days'
  | '180-days'
  | '365-days'
  | '730-days'
  | '1825-days'
  | 'all-time'

type BinType = z.infer<typeof binTypeSchema>

const binningOptions = [
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

const binningOptionsByType = binningOptions.reduce(
  (acc, option) => {
    acc[option.value] = option
    return acc
  },
  {} as Record<BinType, (typeof binningOptions)[number]>,
)

type TransformMode = z.infer<typeof transformModeSchema>

const defaultColors = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // yellow-green
  '#17becf', // cyan
] as const

// Custom number formatter for more precise control
const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`
  }
  return num.toString()
}

const dropdownButtonStyles = {
  base: 'bg-gray-500/10 rounded-md px-2 py-1 text-sm flex items-center gap-1',
  active: 'bg-gray-500/20',
} as const

function npmQueryOptions({
  packageGroups,
  range,
}: {
  packageGroups: z.infer<typeof packageGroupSchema>[]
  range: TimeRange
}) {
  const now = d3.utcDay(new Date())
  // Set to start of today to avoid timezone issues
  now.setHours(0, 0, 0, 0)
  const endDate = now

  // NPM download statistics only go back to January 10, 2015
  const NPM_STATS_START_DATE = d3.utcDay(new Date('2015-01-10'))

  const startDate = (() => {
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
        // Use NPM's stats start date - the API will return empty data for dates before packages existed
        return NPM_STATS_START_DATE
    }
  })()

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  return queryOptions({
    queryKey: [
      'npm-stats',
      packageGroups.map((pg) => ({
        packages: pg.packages.map((p) => ({ name: p.name })),
      })),
      range,
    ],
    queryFn: async () => {
      try {
        // Import the bulk server function for fetching all npm downloads at once
        const { fetchNpmDownloadsBulk } = await import('~/utils/stats.server')

        // Make a single bulk request for all packages
        const results = await fetchNpmDownloadsBulk({
          data: {
            packageGroups: packageGroups.map((pg) => ({
              packages: pg.packages.map((p) => ({
                name: p.name,
                hidden: p.hidden,
              })),
            })),
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          },
        })

        // Process results to match the expected format
        return results.map((result, groupIndex) => {
          let actualStartDate = startDate

          // Find the earliest non-zero download for this package group
          for (const pkg of result.packages) {
            const firstNonZero = pkg.downloads.find((d) => d.downloads > 0)
            if (firstNonZero) {
              const firstNonZeroDate = d3.utcDay(new Date(firstNonZero.day))
              if (firstNonZeroDate < actualStartDate) {
                actualStartDate = firstNonZeroDate
              }
            }
          }

          return {
            packages: result.packages.map((pkg) => ({
              ...packageGroups[groupIndex].packages.find(
                (p) => p.name === pkg.name,
              ),
              downloads: pkg.downloads,
            })),
            start: formatDate(actualStartDate),
            end: formatDate(endDate),
            error: result.error,
            actualStartDate,
          }
        })
      } catch (error) {
        console.error('Failed to fetch npm stats:', error)
        // Return error state for all package groups
        return packageGroups.map((packageGroup) => ({
          packages: packageGroup.packages.map((pkg) => ({
            ...pkg,
            downloads: [],
          })),
          start: formatDate(startDate),
          end: formatDate(endDate),
          error: 'Failed to fetch package data (see console for details)',
          actualStartDate: startDate,
        }))
      }
    },
    placeholderData: keepPreviousData,
  })
}

// Get or assign colors for packages
function getPackageColor(
  packageName: string,
  packages: z.infer<typeof packageGroupSchema>[],
) {
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

function PlotFigure({ options }: { options: any }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!containerRef.current) return
    const plot = Plot.plot(options)
    containerRef.current.append(plot)
    return () => plot.remove()
  }, [options])

  return <div ref={containerRef} />
}

function Resizable({
  height,
  onHeightChange,
  children,
}: {
  height: number
  onHeightChange: (height: number) => void
  children: React.ReactNode
}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragEl, setDragEl] = React.useState<HTMLDivElement | null>(null)
  const startYRef = React.useRef<number>(0)
  const startHeightRef = React.useRef<number>(height)

  const onHeightChangeRef = React.useRef(onHeightChange)

  React.useEffect(() => {
    onHeightChangeRef.current = onHeightChange
  })

  React.useEffect(() => {
    if (!dragEl) return

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
      startYRef.current = e.clientY
      startHeightRef.current = height

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startYRef.current
        const newHeight = Math.max(300, startHeightRef.current + deltaY)
        onHeightChangeRef.current(newHeight)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    dragEl.addEventListener('mousedown', handleMouseDown)
    return () => {
      dragEl?.removeEventListener('mousedown', handleMouseDown)
    }
  }, [dragEl, height])

  return (
    <div className="relative" style={{ height }}>
      {children}
      <div
        ref={setDragEl}
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center select-none ${
          isDragging ? 'bg-blue-500' : 'hover:bg-gray-500/20'
        }`}
      >
        <div className="w-8 h-1 bg-gray-400 rounded-full" />
      </div>
    </div>
  )
}

const showDataModeOptions = [
  { value: 'all', label: 'All Data' },
  { value: 'complete', label: 'Hide Partial Data' },
] as const

type ShowDataMode = z.infer<typeof showDataModeSchema>

function NpmStatsChartVisualization({
  queryData,
  transform,
  binType,
  packages,
  range,
  facetX,
  facetY,
  showDataMode,
}: {
  queryData:
    | undefined
    | Awaited<
        ReturnType<Required<ReturnType<typeof npmQueryOptions>>['queryFn']>
      >
  transform: TransformMode
  binType: BinType
  packages: z.infer<typeof packageGroupSchema>[]
  range: TimeRange
  facetX?: FacetValue
  facetY?: FacetValue
  showDataMode: ShowDataMode
}) {
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
      name: packageGroup.packages[0].name,
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

    return {
      ...packageGroup,
      downloads: packageGroup.downloads.map((d) => {
        if (baseLineValuesByDate) {
          d.downloads =
            d.downloads / (baseLineValuesByDate.get(d.date.getTime()) || 0)
        }

        return {
          ...d,
          change: d.downloads - first.downloads,
        }
      }),
    }
  })

  // Filter out any top-level hidden packages
  const filteredPackageData = correctedPackageData.filter((pkg, index) => {
    const packageGroupWithHidden = packages[index]
    const isHidden = packageGroupWithHidden?.packages[0]?.hidden
    return !pkg.baseline && !isHidden
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
            marks: [
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
              effectiveShowDataMode === 'all' && [
                Plot.lineY(
                  plotData.filter((d) => d.date >= partialBinStart),
                  {
                    ...baseOptions,
                    stroke: 'name',
                    strokeWidth: 1.5,
                    strokeDasharray: '2 4',
                    strokeOpacity: 0.8,
                    curve: 'monotone-x',
                  },
                ),
              ],
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
            ].filter(Boolean),
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
              range: [...new Set(plotData.map((d) => d.name))].map((pkg) =>
                getPackageColor(pkg, packages),
              ),
              legend: false,
            },
          }}
        />
      )}
    </ParentSize>
  )
}

function PackageSearch({
  onSelect,
  placeholder = 'Search for a package...',
  autoFocus = false,
}: {
  onSelect: (packageName: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [inputValue, setInputValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const [debouncedInputValue] = useDebouncedValue(inputValue, {
    wait: 150,
  })

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const searchQuery = useQuery({
    queryKey: ['npm-search', debouncedInputValue],
    queryFn: async () => {
      if (!debouncedInputValue || debouncedInputValue.length <= 2)
        return {
          all: [] as string[],
          set: new Set<string>(),
        }

      const response = await fetch(
        `https://api.npms.io/v2/search?q=${encodeURIComponent(
          debouncedInputValue,
        )}&size=10`,
      )
      const data = await response.json()
      return data.results.map((r: any) => r.package)
    },
    enabled: debouncedInputValue.length > 2,
    placeholderData: keepPreviousData,
  })

  const results = React.useMemo(() => {
    const hasInputValue = searchQuery.data?.find(
      (d) => d.name === debouncedInputValue,
    )

    return [
      ...(hasInputValue
        ? []
        : [
            {
              name: debouncedInputValue,
              label: `Use "${debouncedInputValue}"`,
            },
          ]),
      ...(searchQuery.data ?? []),
    ]
  }, [searchQuery.data, debouncedInputValue])

  const handleInputChange = (value: string) => {
    setInputValue(value)
  }

  const handleSelect = (value: string) => {
    const selectedItem = results?.find((item) => item.name === value)
    if (!selectedItem) return

    onSelect(selectedItem.name)
    setInputValue('')
    setOpen(false)
  }

  return (
    <div className="flex-1" ref={containerRef}>
      <div className="relative">
        <Command className="w-full" shouldFilter={false}>
          <div className="flex items-center gap-1">
            <Search className="text-lg" />
            <Command.Input
              placeholder={placeholder}
              className="w-full bg-gray-500/10 rounded-md px-2 py-1 min-w-[200px] text-sm"
              value={inputValue}
              onValueChange={handleInputChange}
              onFocus={() => setOpen(true)}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={autoFocus}
            />
          </div>
          {searchQuery.isFetching && (
            <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
              <Spinner className="text-sm" />
            </div>
          )}
          {inputValue.length && open ? (
            <Command.List className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto divide-y divide-gray-500/10">
              {inputValue.length < 3 ? (
                <div className="px-3 py-2">Keep typing to search...</div>
              ) : searchQuery.isLoading ? (
                <div className="px-3 py-2 flex items-center gap-2">
                  Searching...
                </div>
              ) : !results?.length ? (
                <div className="px-3 py-2">No packages found</div>
              ) : null}
              {results?.map((item) => (
                <Command.Item
                  key={item.name}
                  value={item.name}
                  onSelect={handleSelect}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-500/20 data-[selected=true]:bg-gray-500/20"
                >
                  <div className="font-medium">{item.label || item.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {item.description}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {item.version ? `v${item.version}• ` : ''}
                    {item.publisher?.username}
                  </div>
                </Command.Item>
              ))}
            </Command.List>
          ) : null}
        </Command>
      </div>
    </div>
  )
}

const defaultRangeBinTypes: Record<TimeRange, BinType> = {
  '7-days': 'daily',
  '30-days': 'daily',
  '90-days': 'weekly',
  '180-days': 'weekly',
  '365-days': 'weekly',
  '730-days': 'monthly',
  '1825-days': 'monthly',
  'all-time': 'monthly',
}

// Add a function to check if a binning option is valid for a time range
function isBinningOptionValidForRange(
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

const transformOptions = [
  { value: 'none', label: 'Actual Values' },
  { value: 'normalize-y', label: 'Relative Change' },
] as const

const facetOptions = [
  { value: 'name', label: 'Package' },
  // Add more options here in the future
] as const

type FacetValue = (typeof facetOptions)[number]['value']

interface NpmStatsComponentProps {
  packageGroups: z.infer<typeof packageGroupSchema>[]
  onPackageGroupsChange: (
    packageGroups: z.infer<typeof packageGroupSchema>[],
  ) => void
  range?: TimeRange
  onRangeChange?: (range: TimeRange) => void
  transform?: TransformMode
  onTransformChange?: (transform: TransformMode) => void
  facetX?: FacetValue
  onFacetXChange?: (facetX: FacetValue | undefined) => void
  facetY?: FacetValue
  onFacetYChange?: (facetY: FacetValue | undefined) => void
  binType?: BinType
  onBinTypeChange?: (binType: BinType) => void
  showDataMode?: ShowDataMode
  onShowDataModeChange?: (showDataMode: ShowDataMode) => void
  height?: number
  onHeightChange?: (height: number) => void
  showPopularComparisons?: boolean
  competitors?: string[]
  frameworks?: string[]
  libraryId?: string
  getPackageName?: (framework: string, libraryId: string, library: any) => string
  library?: any
}

export function NpmStatsComponent({
  packageGroups,
  onPackageGroupsChange,
  range = '365-days',
  onRangeChange,
  transform = 'none',
  onTransformChange,
  facetX,
  onFacetXChange,
  facetY,
  onFacetYChange,
  binType: binTypeParam,
  onBinTypeChange,
  showDataMode = 'all',
  onShowDataModeChange,
  height = 400,
  onHeightChange,
  showPopularComparisons = true,
  competitors = [],
  frameworks = [],
  libraryId,
  getPackageName,
  library,
}: NpmStatsComponentProps) {
  const [combiningPackage, setCombiningPackage] = React.useState<string | null>(
    null,
  )
  const [colorPickerPackage, setColorPickerPackage] = React.useState<
    string | null
  >(null)
  const [colorPickerPosition, setColorPickerPosition] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const [openMenuPackage, setOpenMenuPackage] = React.useState<string | null>(
    null,
  )

  const binType = binTypeParam ?? defaultRangeBinTypes[range]
  const binOption = binningOptionsByType[binType]

  const handleBinnedChange = (value: BinType) => {
    onBinTypeChange?.(value)
  }

  const handleBaselineChange = (packageName: string) => {
    const newPackages = packageGroups.map((pkg) => {
      const baseline =
        pkg.packages[0].name === packageName ? !pkg.baseline : false

      return {
        ...pkg,
        baseline,
      }
    })
    onPackageGroupsChange(newPackages)
  }

  const handleShowDataModeChange = (mode: ShowDataMode) => {
    onShowDataModeChange?.(mode)
  }

  const togglePackageVisibility = (index: number, packageName: string) => {
    const newPackages = packageGroups.map((pkg, i) =>
      i === index
        ? {
            ...pkg,
            packages: pkg.packages.map((p) =>
              p.name === packageName ? { ...p, hidden: !p.hidden } : p,
            ),
          }
        : pkg,
    )
    onPackageGroupsChange(newPackages)
  }

  const npmQuery = useQuery(
    npmQueryOptions({
      packageGroups: packageGroups,
      range,
    }),
  )

  const handleRemoveFromGroup = (mainPackage: string, subPackage: string) => {
    // Find the package group
    const packageGroup = packageGroups.find((pkg) =>
      pkg.packages.some((p) => p.name === mainPackage),
    )
    if (!packageGroup) return

    // Remove the subpackage
    const updatedPackages = packageGroup.packages.filter(
      (p) => p.name !== subPackage,
    )

    // Update the packages array
    const newPackages = packageGroups
      .map((pkg) =>
        pkg === packageGroup ? { ...pkg, packages: updatedPackages } : pkg,
      )
      .filter((pkg) => pkg.packages.length > 0)

    onPackageGroupsChange(newPackages)
  }

  const handleRemovePackageName = (packageGroupIndex: number) => {
    const newPackages = packageGroups.filter((_, i) => i !== packageGroupIndex)
    onPackageGroupsChange(newPackages)
  }

  const setBinningOption = (newBinningOption: BinType) => {
    onBinTypeChange?.(newBinningOption)
  }

  const handleRangeChange = (newRange: TimeRange) => {
    // Set default binning option based on the new range
    setBinningOption(defaultRangeBinTypes[newRange])
    onRangeChange?.(newRange)
  }

  const handleTransformChange = (mode: TransformMode) => {
    onTransformChange?.(mode)
  }

  const handleCombinePackage = (packageName: string) => {
    setCombiningPackage(packageName)
  }

  const handleColorClick = (packageName: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setColorPickerPosition({ x: rect.left, y: rect.bottom + 5 })
    setColorPickerPackage(packageName)
  }

  const handleColorChange = useThrottledCallback(
    (packageName: string, color: string | null) => {
      const packageGroup = packageGroups.find((pkg) =>
        pkg.packages.some((p) => p.name === packageName),
      )
      if (!packageGroup) return

      const newPackages = packageGroups.map((pkg) =>
        pkg === packageGroup
          ? color === null
            ? { packages: pkg.packages }
            : { ...pkg, color }
          : pkg,
      )

      onPackageGroupsChange(newPackages)
    },
    {
      wait: 100,
    },
  )

  const onHeightChangeThrottled = useThrottledCallback(
    (height: number) => {
      onHeightChange?.(height)
    },
    {
      wait: 16,
    },
  )

  const handleMenuOpenChange = (packageName: string, open: boolean) => {
    if (!open) {
      setOpenMenuPackage(null)
    } else {
      setOpenMenuPackage(packageName)
    }
  }

  const handleFacetXChange = (value: FacetValue | undefined) => {
    onFacetXChange?.(value)
  }

  const handleFacetYChange = (value: FacetValue | undefined) => {
    onFacetYChange?.(value)
  }

  const handleAddPackage = (packageName: string) => {
    const newPackages = [
      ...packageGroups,
      {
        packages: [{ name: packageName }],
      },
    ]
    onPackageGroupsChange(newPackages)
  }

  const handleAddToGroup = (packageName: string) => {
    if (!combiningPackage) return

    // Find the package group that contains the combining package
    const packageGroup = packageGroups.find((pkg) =>
      pkg.packages.some((p) => p.name === combiningPackage),
    )

    if (packageGroup) {
      // Update existing package group
      const newPackages = packageGroups.map((pkg) =>
        pkg === packageGroup
          ? {
              ...pkg,
              packages: [...pkg.packages, { name: packageName }],
            }
          : pkg,
      )

      onPackageGroupsChange(newPackages)
    } else {
      // Create new package group
      const newPackages = [
        ...packageGroups,
        {
          packages: [{ name: combiningPackage }, { name: packageName }],
        },
      ]
      onPackageGroupsChange(newPackages)
    }

    setCombiningPackage(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <PackageSearch onSelect={handleAddPackage} />
        <DropdownMenu>
          <Tooltip content="Select time range">
            <DropdownMenuTrigger asChild>
              <button className={twMerge(dropdownButtonStyles.base)}>
                {timeRanges.find((r) => r.value === range)?.label}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Time Range</span>
            </div>
            {timeRanges.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleRangeChange(value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  value === range ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip content="Select binning interval">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  binType !== 'weekly' && dropdownButtonStyles.active,
                )}
              >
                {binningOptions.find((b) => b.value === binType)?.label}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Binning Interval</span>
            </div>
            {binningOptions.map(({ label, value }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleBinnedChange(value)}
                disabled={!isBinningOptionValidForRange(range, value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  binType === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                  !isBinningOptionValidForRange(range, value)
                    ? 'opacity-50 cursor-not-allowed'
                    : '',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip content="Transform the Y-axis to show relative changes between packages. 'None' shows actual download numbers, while 'Normalize Y' shows percentage changes relative to the first data point.">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  transform !== 'none' && dropdownButtonStyles.active,
                )}
              >
                {transformOptions.find((opt) => opt.value === transform)?.label}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Y-Axis Transform</span>
            </div>
            {transformOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleTransformChange(value as TransformMode)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  transform === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip content="Split the visualization horizontally by package">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  facetX && dropdownButtonStyles.active,
                )}
              >
                {facetX
                  ? `Facet X by ${
                      facetOptions.find((opt) => opt.value === facetX)?.label
                    }`
                  : 'No Facet X'}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Horizontal Facet</span>
            </div>
            <DropdownMenuItem
              onSelect={() => handleFacetXChange(undefined)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                !facetX ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              No Facet
            </DropdownMenuItem>
            {facetOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleFacetXChange(value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  facetX === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip content="Split the visualization vertically by package">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  facetY && dropdownButtonStyles.active,
                )}
              >
                {facetY
                  ? `Facet Y by ${
                      facetOptions.find((opt) => opt.value === facetY)?.label
                    }`
                  : 'No Facet Y'}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Vertical Facet</span>
            </div>
            <DropdownMenuItem
              onSelect={() => handleFacetYChange(undefined)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                !facetY ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              No Facet
            </DropdownMenuItem>
            {facetOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleFacetYChange(value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  facetY === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip
            content={
              transform === 'normalize-y'
                ? 'Only complete data is shown when using relative change'
                : 'Control how data is displayed'
            }
          >
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  showDataMode !== 'all' && dropdownButtonStyles.active,
                  transform === 'normalize-y' &&
                    'opacity-50 cursor-not-allowed',
                )}
                disabled={transform === 'normalize-y'}
              >
                {
                  showDataModeOptions.find((opt) => opt.value === showDataMode)
                    ?.label
                }
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Data Display Mode</span>
            </div>
            {showDataModeOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => handleShowDataModeChange(value)}
                disabled={transform === 'normalize-y'}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  showDataMode === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                  transform === 'normalize-y'
                    ? 'opacity-50 cursor-not-allowed'
                    : '',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-1 sm:gap-2">
        {packageGroups.map((pkg, index) => {
          const mainPackage = pkg.packages[0]
          const packageList = pkg.packages
          const isCombined = packageList.length > 1
          const subPackages = packageList.filter(
            (p) => p.name !== mainPackage.name,
          )
          const color = getPackageColor(mainPackage.name, packageGroups)

          // Get error for this package if any
          const packageError = npmQuery.data?.[index]?.error

          return (
            <div
              key={mainPackage.name}
              className={`flex flex-col items-start
                rounded-md text-gray-900
                px-1 py-0.5
                sm:px-2 sm:py-1
                dark:text-gray-100 text-xs sm:text-sm`}
              style={{
                backgroundColor: `${color}20`,
              }}
            >
              <div className="flex items-center gap-1 w-full">
                {pkg.baseline ? (
                  <>
                    <Tooltip content="Remove baseline">
                      <button
                        onClick={() => handleBaselineChange(mainPackage.name)}
                        className="hover:text-blue-500"
                      >
                        <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                      </button>
                    </Tooltip>
                    <span>{mainPackage.name}</span>
                  </>
                ) : (
                  <>
                    <Tooltip content="Change color">
                      <button
                        onClick={(e) => handleColorClick(mainPackage.name, e)}
                        className="hover:opacity-80"
                      >
                        <div
                          className="w-3 h-3 sm:w-4 sm:h-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                      </button>
                    </Tooltip>
                    <Tooltip content="Toggle package visibility">
                      <button
                        onClick={() =>
                          togglePackageVisibility(index, mainPackage.name)
                        }
                        className={twMerge(
                          'hover:text-blue-500 flex items-center gap-1',
                          mainPackage.hidden ? 'opacity-50' : '',
                        )}
                      >
                        {mainPackage.name}
                        {mainPackage.hidden ? (
                          <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                        ) : null}
                      </button>
                    </Tooltip>
                  </>
                )}
                {isCombined ? (
                  <span className="text-black/70 dark:text-white/70 text-[.7em] font-black py-0.5 px-1 leading-none rounded-md border-[1.5px] border-current opacity-80">
                    + {subPackages.length}
                  </span>
                ) : null}
                <div className="relative flex items-center">
                  <DropdownMenu
                    open={openMenuPackage === mainPackage.name}
                    onOpenChange={(open) =>
                      handleMenuOpenChange(mainPackage.name, open)
                    }
                  >
                    <Tooltip content="More options">
                      <DropdownMenuTrigger asChild>
                        <button className="px-0.5 sm:px-1 hover:text-blue-500">
                          <EllipsisVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent
                      className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50"
                      sideOffset={5}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Options</span>
                      </div>
                      <div className="space-y-1">
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            togglePackageVisibility(index, mainPackage.name)
                          }}
                          className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                        >
                          {mainPackage.hidden ? (
                            <EyeOff className="text-sm" />
                          ) : (
                            <Eye className="text-sm" />
                          )}
                          {mainPackage.hidden ? 'Show Package' : 'Hide Package'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleBaselineChange(mainPackage.name)
                          }}
                          className={twMerge(
                            'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                            pkg.baseline ? 'text-blue-500' : '',
                          )}
                        >
                          <Pin className="text-sm" />
                          {pkg.baseline ? 'Remove Baseline' : 'Set as Baseline'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleColorClick(
                              mainPackage.name,
                              e as unknown as React.MouseEvent,
                            )
                          }}
                          className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          Change Color
                        </DropdownMenuItem>
                        {isCombined && (
                          <>
                            <div className="h-px bg-gray-500/20 my-1" />
                            <div className="px-2 py-1 text-xs font-medium text-gray-500">
                              Sub-packages
                            </div>
                            {subPackages.map((subPackage) => (
                              <DropdownMenuItem
                                key={subPackage.name}
                                onSelect={(e) => {
                                  e.preventDefault()
                                  togglePackageVisibility(
                                    index,
                                    subPackage.name,
                                  )
                                }}
                                className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                              >
                                <div className="flex-1 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {subPackage.hidden ? (
                                      <EyeOff className="text-sm" />
                                    ) : (
                                      <Eye className="text-sm" />
                                    )}
                                    <span
                                      className={
                                        subPackage.hidden ? 'opacity-50' : ''
                                      }
                                    >
                                      {subPackage.name}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveFromGroup(
                                        mainPackage.name,
                                        subPackage.name,
                                      )
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleCombinePackage(mainPackage.name)
                          }}
                          className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                        >
                          <Plus className="text-sm" />
                          Add Packages
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button
                  onClick={() => handleRemovePackageName(index)}
                  className="ml-auto pl-0.5 sm:pl-1 text-gray-500 hover:text-red-500"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
              {packageError && (
                <div className="mt-1 text-xs font-mono text-red-500 px-1 font-medium bg-red-500/10 rounded">
                  {packageError}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Combine Package Dialog */}
      {combiningPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-4 w-full max-w-md">
            <div className="flex justify-between items-center mb-2 sm:mb-4">
              <h3 className="text-base sm:text-lg font-medium">
                Add packages to {combiningPackage}
              </h3>
              <button
                onClick={() => setCombiningPackage(null)}
                className="p-0.5 sm:p-1 hover:text-red-500"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <PackageSearch
              onSelect={handleAddToGroup}
              placeholder="Search for packages to add..."
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={true}
            />
          </div>
        </div>
      )}

      {/* Color Picker Popover */}
      {colorPickerPackage && colorPickerPosition && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2"
          style={{
            left: colorPickerPosition.x,
            top: colorPickerPosition.y,
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Pick a color</span>
          </div>
          <HexColorPicker
            color={getPackageColor(colorPickerPackage, packageGroups)}
            onChange={(color: string) =>
              handleColorChange(colorPickerPackage, color)
            }
          />
          <div className="flex justify-between mt-2">
            <button
              onClick={() => {
                handleColorChange(colorPickerPackage, null)
                setColorPickerPackage(null)
                setColorPickerPosition(null)
              }}
              className="px-2 py-1 text-sm text-gray-500 hover:text-red-500"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setColorPickerPackage(null)
                setColorPickerPosition(null)
              }}
              className="px-2 py-1 text-sm text-blue-500 hover:text-blue-600"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {Object.keys(packageGroups).length ? (
        <div className="">
          <div className="space-y-2 sm:space-y-4">
            <div className="relative">
              {npmQuery.isFetching && npmQuery.data ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30 z-10 rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <Spinner />
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Updating...
                    </div>
                  </div>
                </div>
              ) : null}
              <Resizable
                height={height}
                onHeightChange={onHeightChangeThrottled}
              >
                {npmQuery.isLoading ? (
                  <div
                    className="flex items-center justify-center"
                    style={{ height }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <Spinner />
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Loading download statistics...
                      </div>
                    </div>
                  </div>
                ) : (
                  <NpmStatsChartVisualization
                    range={range}
                    queryData={npmQuery.data}
                    transform={transform}
                    binType={binType}
                    packages={packageGroups}
                    facetX={facetX}
                    facetY={facetY}
                    showDataMode={showDataMode}
                  />
                )}
              </Resizable>
            </div>
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full">
                <thead className="bg-gray-500/10">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Package Name
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Period Downloads
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Downloads last {binOption.single}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-500/5 divide-y divide-gray-500/10">
                  {npmQuery.data
                    ?.map((packageGroupDownloads, index) => {
                      if (
                        !packageGroupDownloads.packages.some(
                          (p) => p.downloads.length,
                        )
                      ) {
                        return null
                      }

                      const firstPackage = packageGroupDownloads.packages[0]

                      // Sort downloads by date
                      const sortedDownloads = packageGroupDownloads.packages
                        .flatMap((p) => p.downloads)
                        .sort(
                          (a, b) =>
                            d3.utcDay(a.day).getTime() -
                            d3.utcDay(b.day).getTime(),
                        )

                      // Get the binning unit and calculate partial bin boundaries
                      const binUnit = binOption.bin
                      const now = d3.utcDay(new Date())
                      const partialBinEnd = binUnit.floor(now)

                      // Filter downloads based on showDataMode for total downloads
                      const filteredDownloads = sortedDownloads.filter(
                        (d) => d3.utcDay(new Date(d.day)) < partialBinEnd,
                      )

                      // Group downloads by bin using d3
                      const binnedDownloads = d3.sort(
                        d3.rollup(
                          filteredDownloads,
                          (v) => d3.sum(v, (d) => d.downloads),
                          (d) => binUnit.floor(new Date(d.day)),
                        ),
                        (d) => d[0],
                      )

                      const color = getPackageColor(
                        firstPackage.name,
                        packageGroups,
                      )

                      const firstBin = binnedDownloads[0]
                      const lastBin =
                        binnedDownloads[binnedDownloads.length - 1]

                      const growth = lastBin[1] - firstBin[1]
                      const growthPercentage = growth / firstBin[1]

                      return {
                        package: firstPackage.name,
                        totalDownloads: d3.sum(binnedDownloads, (d) => d[1]),
                        binDownloads: lastBin[1],
                        growth,
                        growthPercentage,
                        color,
                        hidden: firstPackage.hidden,
                        index,
                      }
                    })
                    .filter(Boolean)
                    .sort((a, b) =>
                      transform === 'normalize-y'
                        ? b!.growth - a!.growth
                        : b!.binDownloads - a!.binDownloads,
                    )
                    .map((stat) => (
                      <tr key={stat!.package}>
                        <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            <Tooltip content="Change color">
                              <button
                                onClick={(e) =>
                                  handleColorClick(stat!.package, e)
                                }
                                className="hover:opacity-80"
                              >
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: stat!.color }}
                                />
                              </button>
                            </Tooltip>
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                <Tooltip content="Toggle visibility">
                                  <button
                                    onClick={() =>
                                      togglePackageVisibility(
                                        stat!.index,
                                        stat!.package,
                                      )
                                    }
                                    className="p-0.5 hover:text-blue-500 flex items-center gap-1"
                                  >
                                    <span
                                      className={
                                        stat!.hidden ? 'opacity-50' : ''
                                      }
                                    >
                                      {stat!.package}
                                    </span>
                                    {stat!.hidden ? (
                                      <EyeOff className="" />
                                    ) : null}
                                  </button>
                                </Tooltip>
                                <Tooltip content="Remove package">
                                  <button
                                    onClick={() =>
                                      handleRemovePackageName(stat!.index)
                                    }
                                    className="p-0.5 text-gray-500 hover:text-red-500"
                                  >
                                    <X className="" />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-right">
                          {formatNumber(stat!.totalDownloads)}
                        </td>
                        <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-right">
                          {formatNumber(stat!.binDownloads)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Framework Adapters Section */}
      {frameworks && frameworks.length > 0 && libraryId && getPackageName && library && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Add Framework Adapters
          </h2>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((framework) => {
              const frameworkPackageName = getPackageName(framework, libraryId, library)
              const isAlreadyAdded = packageGroups.some((pg) =>
                pg.packages.some((pkg) => pkg.name === frameworkPackageName),
              )
              
              return (
                <button
                  key={framework}
                  onClick={() => {
                    if (!isAlreadyAdded) {
                      const newPackageGroups = [
                        ...packageGroups,
                        {
                          packages: [{ name: frameworkPackageName }],
                          // Don't set color - let default color assignment work
                        },
                      ]
                      onPackageGroupsChange(newPackageGroups)
                    }
                  }}
                  disabled={isAlreadyAdded}
                  className={twMerge(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                    isAlreadyAdded
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30',
                  )}
                >
                  {isAlreadyAdded ? '✓ ' : '+ '}
                  {framework === 'vanilla' ? 'Vanilla (Core)' : framework}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Competitor Packages Section */}
      {competitors && competitors.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Compare with Similar Packages
          </h2>
          <div className="flex flex-wrap gap-2">
            {competitors.map((competitor) => {
              const isAlreadyAdded = packageGroups.some((pg) =>
                pg.packages.some((pkg) => pkg.name === competitor),
              )
              return (
                <button
                  key={competitor}
                  onClick={() => {
                    if (!isAlreadyAdded) {
                      const newPackageGroups = [
                        ...packageGroups,
                        {
                          packages: [{ name: competitor }],
                          // Don't set color - let default color assignment work
                        },
                      ]
                      onPackageGroupsChange(newPackageGroups)
                    }
                  }}
                  disabled={isAlreadyAdded}
                  className={twMerge(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    isAlreadyAdded
                      ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:border-blue-500/30',
                  )}
                >
                  {isAlreadyAdded ? '✓ ' : '+ '}
                  {competitor}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Popular Comparisons Section */}
      {showPopularComparisons && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Popular Comparisons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getPopularComparisons().map((comparison) => {
              const baselinePackage = comparison.packageGroups.find(
                (pg) => pg.baseline,
              )
              return (
                <button
                  key={comparison.title}
                  onClick={() => {
                    onPackageGroupsChange(comparison.packageGroups)
                    window.scrollTo({
                      top: 0,
                      behavior: 'smooth',
                    })
                  }}
                  className="block p-4 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors space-y-4 text-left w-full"
                >
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-medium">{comparison.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comparison.packageGroups
                        .filter((d) => !d.baseline)
                        .map((packageGroup) => (
                          <div
                            key={packageGroup.packages[0].name}
                            className="flex items-center gap-1.5 text-sm"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  packageGroup.color || defaultColors[0],
                              }}
                            />
                            <span>{packageGroup.packages[0].name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {baselinePackage && (
                    <div className="flex items-center gap-1 text-sm">
                      <div className="font-medium">Baseline:</div>
                      <div className="bg-gray-500/10 rounded-md px-2 py-1 leading-none font-bold text-sm">
                        {baselinePackage.packages[0].name}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
