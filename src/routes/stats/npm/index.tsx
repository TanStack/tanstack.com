import * as Plot from '@observablehq/plot'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { useDebouncedValue, useThrottledCallback } from '@tanstack/react-pacer'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ParentSize } from '@visx/responsive'
import {
  GadFooter,
  GadLeftRailSquare,
  GadRightRailSquare,
} from '~/components/GoogleScripts'
import { Tooltip } from '~/components/Tooltip'
import logoColor100w from '~/images/logo-color-100w.png'
import { seo } from '~/utils/seo'
import { Command } from 'cmdk'
import * as d3 from 'd3'
import * as React from 'react'
import { HexColorPicker } from 'react-colorful'
import { FaAngleRight, FaSpinner } from 'react-icons/fa'
import {
  MdAdd,
  MdClose,
  MdMoreVert,
  MdPushPin,
  MdSearch,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md'
import { twMerge } from 'tailwind-merge'
import { z } from 'zod'
import { getPopularComparisons } from './-comparisons'

export const packageGroupSchema = z.object({
  packages: z.array(
    z.object({
      name: z.string(),
      hidden: z.boolean().optional(),
    }),
  ),
  color: z.string().nullable().optional(),
  baseline: z.boolean().optional(),
})

export const packageComparisonSchema = z.object({
  title: z.string(),
  packageGroups: z.array(packageGroupSchema),
  baseline: z.string().optional(),
})

const transformModeSchema = z.enum(['none', 'normalize-y'])
const binTypeSchema = z.enum(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = z.enum(['all', 'complete'])
export const Route = createFileRoute({
  validateSearch: z.object({
    packageGroups: z
      .array(packageGroupSchema)
      .optional()
      .default(getPopularComparisons()[0].packageGroups)
      .catch(getPopularComparisons()[0].packageGroups),
    range: z
      .enum([
        '7-days',
        '30-days',
        '90-days',
        '180-days',
        '365-days',
        '730-days',
        '1825-days',
        'all-time',
      ])
      .optional()
      .default('365-days')
      .catch('365-days'),
    transform: transformModeSchema.optional().default('none').catch('none'),
    facetX: z.enum(['name']).optional().catch(undefined),
    facetY: z.enum(['name']).optional().catch(undefined),
    binType: binTypeSchema.optional().default('weekly').catch('weekly'),
    showDataMode: showDataModeSchema.optional().default('all').catch('all'),
    height: z.number().optional().default(400).catch(400),
  }),
  loaderDeps: ({ search }) => ({
    packageList: search.packageGroups
      ?.map((p) => p.packages[0].name)
      .join(' vs '),
  }),
  loader: async ({ deps }) => {
    return deps
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: `NPM Download Stats and Trends — Track and Compare Packages Instantly: ${loaderData.packageList}`,
      description: `Get real-time npm download statistics, compare package popularity, spot trends, and make better choices for your projects. Faster and more detailed than npm-stat, npmtrends, and others.`,
    }),
  }),
  component: RouteComponent,
})

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

type NpmPackage = {
  name: string
  description: string
  version: string
  publisher: {
    username: string
  }
  time?: {
    created: string
    modified: string
  }
}

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

type NpmQueryData = {
  packages: {
    downloads: any[]
    name: string
    hidden?: boolean | undefined
  }[]
  baseline?: boolean
  start: string
  end: string
  color?: string | null | undefined
  error?: string | null
}[]

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
  let endDate = now

  // Function to get package creation date
  const getPackageCreationDate = async (packageName: string): Promise<Date> => {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`)
      if (!response.ok) return d3.utcDay(new Date('2010-01-12')) // Fallback date
      const data = await response.json()
      return d3.utcDay(new Date(data.time?.created || '2010-01-12'))
    } catch (error) {
      console.error(`Error fetching creation date for ${packageName}:`, error)
      return d3.utcDay(new Date('2010-01-12')) // Fallback date
    }
  }

  // Get the earliest creation date among all packages
  const getEarliestCreationDate = async () => {
    const packageNames = packageGroups.flatMap((pkg) =>
      pkg.packages.filter((p) => !p.hidden).map((p) => p.name),
    )

    const creationDates = await Promise.all(
      packageNames.map(getPackageCreationDate),
    )
    return new Date(Math.min(...creationDates.map((date) => date.getTime())))
  }

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
        // We'll handle this in the queryFn
        return d3.utcDay(new Date('2010-01-12')) // This will be overridden
    }
  })()

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  return queryOptions({
    queryKey: ['npm-stats', packageGroups, range],
    queryFn: async (): Promise<NpmQueryData> => {
      // For all-time range, get the earliest creation date
      if (range === 'all-time') {
        startDate = await getEarliestCreationDate()
      }

      return Promise.all(
        packageGroups.map(async (packageGroup) => {
          try {
            const packages = await Promise.all(
              packageGroup.packages.map(async (pkg) => {
                let currentEnd = endDate
                let currentStart = startDate

                const chunkRanges: { start: Date; end: Date }[] = []

                while (currentStart < currentEnd) {
                  const chunkEnd = d3.utcDay(new Date(currentEnd))
                  const chunkStart = d3.utcDay.offset(currentEnd, -365)

                  // Move the end date to the day before the start of the current chunk
                  currentEnd = d3.utcDay.offset(chunkStart, -1)

                  chunkRanges.push({ start: chunkStart, end: chunkEnd })
                }

                const chunks = await Promise.all(
                  chunkRanges.map(async (chunk) => {
                    const url = `https://api.npmjs.org/downloads/range/${formatDate(
                      chunk.start,
                    )}:${formatDate(chunk.end)}/${pkg.name}`
                    const response = await fetch(url)
                    if (!response.ok) {
                      if (response.status === 404) {
                        throw new Error('not_found')
                      }
                      throw new Error('fetch_failed')
                    }
                    return response.json()
                  }),
                )

                // Combine all chunks and ensure no gaps
                const downloads = chunks
                  .flatMap((chunk) => chunk.downloads || [])
                  .sort(
                    (a, b) =>
                      new Date(a.day).getTime() - new Date(b.day).getTime(),
                  )

                // Find the earliest non-zero download
                const firstNonZero = downloads.find((d) => d.downloads > 0)
                if (firstNonZero) {
                  startDate = d3.utcDay(new Date(firstNonZero.day))
                }

                return { ...pkg, downloads }
              }),
            )

            return {
              ...packageGroup,
              packages,
              start: formatDate(startDate),
              end: formatDate(endDate),
              error: null,
            }
          } catch (error) {
            return {
              ...packageGroup,
              packages: packageGroup.packages.map((pkg) => ({
                ...pkg,
                downloads: [],
              })),
              start: formatDate(startDate),
              end: formatDate(endDate),
              error:
                error instanceof Error && error.message === 'not_found'
                  ? `Package "${packageGroup.packages[0].name}" not found on npm`
                  : 'Failed to fetch package data (see console for details)',
            }
          }
        }),
      )
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
  onHeightChangeRef.current = onHeightChange

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
        className={`absolute right-0 bottom-0 left-0 flex h-2 cursor-ns-resize items-center justify-center select-none ${
          isDragging ? 'bg-blue-500' : 'hover:bg-gray-500/20'
        }`}
      >
        <div className="h-1 w-8 rounded-full bg-gray-400" />
      </div>
    </div>
  )
}

const showDataModeOptions = [
  { value: 'all', label: 'All Data' },
  { value: 'complete', label: 'Hide Partial Data' },
] as const

type ShowDataMode = z.infer<typeof showDataModeSchema>

function NpmStatsChart({
  queryData,
  transform,
  binType,
  packages,
  range,
  facetX,
  facetY,
  showDataMode,
}: {
  queryData: undefined | NpmQueryData
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
        return d3.utcDay(new Date('2010-01-12'))
    }
  })()

  startDate = binOption.bin.floor(startDate)

  const combinedPackageGroups = queryData.map((packageGroup) => {
    // Filter out any sub packages that are hidden before
    // summing them into a unified downloads count
    const visiblePackages = packageGroup.packages.filter(
      (p, i) => !i || !p.hidden,
    )

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
      ...packageGroup,
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

  const baselinePackage = binnedPackageData.find((pkg) => {
    return pkg.baseline
  })

  const baseLineCorrectionsByDate =
    baselinePackage && binnedPackageData.length
      ? (() => {
          const firstValue = baselinePackage.downloads[0].downloads

          return new Map(
            baselinePackage.downloads.map((d) => {
              return [
                d.date.getTime(),
                firstValue === 0 ? 1 : firstValue / d.downloads,
              ]
            }),
          )
        })()
      : undefined

  const correctedPackageData = binnedPackageData.map((packageGroup) => {
    const first = packageGroup.downloads[0]

    return {
      ...packageGroup,
      downloads: packageGroup.downloads.map((d) => {
        if (baseLineCorrectionsByDate) {
          d.downloads =
            d.downloads * (baseLineCorrectionsByDate.get(d.date.getTime()) || 1)
        }

        return {
          ...d,
          change: d.downloads - first.downloads,
        }
      }),
    }
  })

  // Filter out any top-level hidden packages
  const filteredPackageData = correctedPackageData.filter(
    (pkg) => !pkg.baseline && !pkg.packages[0].hidden,
  )

  const plotData = filteredPackageData.flatMap((d) => d.downloads)

  let baseOptions: Plot.LineYOptions = {
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
      if (!debouncedInputValue || debouncedInputValue.length <= 2) return []

      const response = await fetch(
        `https://api.npms.io/v2/search?q=${encodeURIComponent(
          debouncedInputValue,
        )}&size=10`,
      )
      const data = await response.json()
      const hasInputValue = data.results.find(
        (r: any) => r.package.name === debouncedInputValue,
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
        ...data.results.map((r: any) => r.package),
      ]
    },
    enabled: debouncedInputValue.length > 2,
    placeholderData: keepPreviousData,
  })

  const handleInputChange = (value: string) => {
    setInputValue(value)
  }

  const handleSelect = (value: string) => {
    const selectedItem = searchQuery.data?.find((item) => item.name === value)
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
            <MdSearch className="text-lg" />
            <Command.Input
              placeholder={placeholder}
              className="w-full min-w-[200px] rounded-md bg-gray-500/10 px-2 py-1 text-sm"
              value={inputValue}
              onValueChange={handleInputChange}
              onFocus={() => setOpen(true)}
              autoFocus={autoFocus}
            />
          </div>
          {searchQuery.isLoading && (
            <div className="absolute top-0 right-2 bottom-0 flex items-center justify-center">
              <FaSpinner className="h-4 w-4 animate-spin" />
            </div>
          )}
          {inputValue.length && open ? (
            <Command.List className="absolute z-10 mt-1 max-h-60 w-full divide-y divide-gray-500/10 overflow-auto rounded-md bg-white shadow-lg dark:bg-gray-800">
              {inputValue.length < 3 ? (
                <div className="px-3 py-2">Keep typing to search...</div>
              ) : searchQuery.isLoading ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <FaSpinner className="h-4 w-4 animate-spin" /> Searching...
                </div>
              ) : !searchQuery.data?.length ? (
                <div className="px-3 py-2">No packages found</div>
              ) : null}
              {searchQuery.data?.map((item) => (
                <Command.Item
                  key={item.name}
                  value={item.name}
                  onSelect={handleSelect}
                  className="cursor-pointer px-3 py-2 hover:bg-gray-500/20 data-[selected=true]:bg-gray-500/20"
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

function RouteComponent() {
  const {
    packageGroups,
    range = '7-days',
    transform,
    facetX,
    facetY,
    binType: binTypeParam,
    showDataMode: showDataModeParam = 'all',
    height = 400,
  } = Route.useSearch()
  const [combiningPackage, setCombiningPackage] = React.useState<string | null>(
    null,
  )
  const navigate = Route.useNavigate()
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
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binType: value,
      }),
      resetScroll: false,
    })
  }

  const handleBaselineChange = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => {
        return {
          ...prev,
          packageGroups: prev.packageGroups.map((pkg) => {
            const baseline =
              pkg.packages[0].name === packageName ? !pkg.baseline : false

            return {
              ...pkg,
              baseline,
            }
          }),
        }
      },
      resetScroll: false,
    })
  }

  const handleShowDataModeChange = (mode: ShowDataMode) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        showDataMode: mode,
      }),
      resetScroll: false,
    })
  }

  const togglePackageVisibility = (index: number, packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: prev.packageGroups.map((pkg, i) =>
          i === index
            ? {
                ...pkg,
                packages: pkg.packages.map((p) =>
                  p.name === packageName ? { ...p, hidden: !p.hidden } : p,
                ),
              }
            : pkg,
        ),
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const npmQuery = useQuery(
    npmQueryOptions({
      packageGroups: packageGroups,
      range,
    }),
  )

  const handleCombineSelect = (selectedPackage: NpmPackage) => {
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
              packages: [
                ...pkg.packages,
                { name: selectedPackage.name, hidden: true },
              ],
            }
          : pkg,
      )

      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          packageGroups: newPackages,
        }),
        resetScroll: false,
      })
    } else {
      // Create new package group
      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          packageGroups: [
            ...packageGroups,
            {
              packages: [
                { name: combiningPackage },
                { name: selectedPackage.name },
              ],
            },
          ],
        }),
        resetScroll: false,
      })
    }

    setCombiningPackage(null)
  }

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

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: newPackages,
      }),
      resetScroll: false,
    })
  }

  const handleRemovePackageName = (packageGroupIndex: number) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: prev.packageGroups.filter(
          (_, i) => i !== packageGroupIndex,
        ),
      }),
      resetScroll: false,
    })
  }

  const setBinningOption = (newBinningOption: BinType) => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, binType: newBinningOption }),
      resetScroll: false,
    })
  }

  const handleRangeChange = (newRange: TimeRange) => {
    // Set default binning option based on the new range
    setBinningOption(defaultRangeBinTypes[newRange])

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        range: newRange,
      }),
    })
  }

  const handleTransformChange = (mode: TransformMode) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        transform: mode,
      }),
      resetScroll: false,
    })
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
      navigate({
        to: '.',
        search: (prev) => {
          const packageGroup = packageGroups.find((pkg) =>
            pkg.packages.some((p) => p.name === packageName),
          )
          if (!packageGroup) return prev

          const newPackages = packageGroups.map((pkg) =>
            pkg === packageGroup
              ? color === null
                ? { packages: pkg.packages }
                : { ...pkg, color }
              : pkg,
          )

          return {
            ...prev,
            packageGroups: newPackages,
          }
        },
        replace: true,
        resetScroll: false,
      })
    },
    {
      wait: 100,
    },
  )

  const onHeightChange = useThrottledCallback(
    (height: number) => {
      navigate({
        to: '.',
        search: (prev) => ({ ...prev, height }),
        resetScroll: false,
      })
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
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        facetX: value,
      }),
      resetScroll: false,
    })
  }

  const handleFacetYChange = (value: FacetValue | undefined) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        facetY: value,
      }),
      resetScroll: false,
    })
  }

  const handleAddPackage = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: [
          ...prev.packageGroups,
          {
            packages: [{ name: packageName }],
          },
        ],
      }),
      resetScroll: false,
    })
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

      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          packageGroups: newPackages,
        }),
        resetScroll: false,
      })
    } else {
      // Create new package group
      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          packageGroups: [
            ...packageGroups,
            {
              packages: [{ name: combiningPackage }, { name: packageName }],
            },
          ],
        }),
        resetScroll: false,
      })
    }

    setCombiningPackage(null)
  }

  return (
    <div className="min-h-dvh space-y-2 p-2 sm:space-y-4 sm:p-4">
      <div className="flex items-center gap-2 rounded-lg bg-white p-2 text-lg shadow-xl sm:p-4 sm:text-xl dark:bg-black/50">
        <Link to="/" className={twMerge(`flex items-center gap-1.5`)}>
          <img
            src={logoColor100w}
            alt=""
            className="w-[30px] overflow-hidden rounded-full border-2 border-black dark:border-none"
          />
          <div className="text-xl font-black uppercase">TanStack</div>
        </Link>
        <FaAngleRight />
        <Link to="." className="flex items-center gap-2 hover:text-blue-500">
          NPM Stats{' '}
          <span className="rounded bg-gradient-to-r from-blue-500 to-cyan-500 px-2 py-0.5 text-xs font-bold text-white">
            BETA
          </span>
        </Link>
      </div>
      <div className="flex gap-4">
        <div className="max-w-full flex-1 space-y-4 rounded-lg bg-white p-4 shadow-xl dark:bg-black/50">
          <div className="flex flex-wrap gap-2">
            <PackageSearch onSelect={handleAddPackage} />
            <DropdownMenu>
              <Tooltip content="Select time range">
                <DropdownMenuTrigger asChild>
                  <button className={twMerge(dropdownButtonStyles.base)}>
                    {timeRanges.find((r) => r.value === range)?.label}
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Time Range</span>
                </div>
                {timeRanges.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => handleRangeChange(value)}
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      value === range ? 'bg-blue-500/10 text-blue-500' : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
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
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Binning Interval</span>
                </div>
                {binningOptions.map(({ label, value }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => handleBinnedChange(value)}
                    disabled={!isBinningOptionValidForRange(range, value)}
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      binType === value ? 'bg-blue-500/10 text-blue-500' : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
                      !isBinningOptionValidForRange(range, value)
                        ? 'cursor-not-allowed opacity-50'
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
                    {
                      transformOptions.find((opt) => opt.value === transform)
                        ?.label
                    }
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Y-Axis Transform</span>
                </div>
                {transformOptions.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() =>
                      handleTransformChange(value as TransformMode)
                    }
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      transform === value ? 'bg-blue-500/10 text-blue-500' : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
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
                          facetOptions.find((opt) => opt.value === facetX)
                            ?.label
                        }`
                      : 'No Facet X'}
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Horizontal Facet</span>
                </div>
                <DropdownMenuItem
                  onSelect={() => handleFacetXChange(undefined)}
                  className={twMerge(
                    'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                    !facetX ? 'bg-blue-500/10 text-blue-500' : '',
                    'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
                  )}
                >
                  No Facet
                </DropdownMenuItem>
                {facetOptions.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => handleFacetXChange(value)}
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      facetX === value ? 'bg-blue-500/10 text-blue-500' : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
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
                          facetOptions.find((opt) => opt.value === facetY)
                            ?.label
                        }`
                      : 'No Facet Y'}
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Vertical Facet</span>
                </div>
                <DropdownMenuItem
                  onSelect={() => handleFacetYChange(undefined)}
                  className={twMerge(
                    'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                    !facetY ? 'bg-blue-500/10 text-blue-500' : '',
                    'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
                  )}
                >
                  No Facet
                </DropdownMenuItem>
                {facetOptions.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => handleFacetYChange(value)}
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      facetY === value ? 'bg-blue-500/10 text-blue-500' : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
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
                      showDataModeParam !== 'all' &&
                        dropdownButtonStyles.active,
                      transform === 'normalize-y' &&
                        'cursor-not-allowed opacity-50',
                    )}
                    disabled={transform === 'normalize-y'}
                  >
                    {
                      showDataModeOptions.find(
                        (opt) => opt.value === showDataModeParam,
                      )?.label
                    }
                    <MdMoreVert className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Data Display Mode</span>
                </div>
                {showDataModeOptions.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => handleShowDataModeChange(value)}
                    disabled={transform === 'normalize-y'}
                    className={twMerge(
                      'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                      showDataModeParam === value
                        ? 'bg-blue-500/10 text-blue-500'
                        : '',
                      'data-[highlighted]:bg-gray-500/20 data-[highlighted]:text-blue-500',
                      transform === 'normalize-y'
                        ? 'cursor-not-allowed opacity-50'
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
                  className={`flex flex-col items-start rounded-md px-1 py-0.5 text-xs text-gray-900 sm:px-2 sm:py-1 sm:text-sm dark:text-gray-100`}
                  style={{
                    backgroundColor: `${color}20`,
                  }}
                >
                  <div className="flex w-full items-center gap-1">
                    {pkg.baseline ? (
                      <>
                        <Tooltip content="Remove baseline">
                          <button
                            onClick={() =>
                              handleBaselineChange(mainPackage.name)
                            }
                            className="hover:text-blue-500"
                          >
                            <MdPushPin className="h-3 w-3 text-blue-500 sm:h-4 sm:w-4" />
                          </button>
                        </Tooltip>
                        <span>{mainPackage.name}</span>
                      </>
                    ) : (
                      <>
                        <Tooltip content="Change color">
                          <button
                            onClick={(e) =>
                              handleColorClick(mainPackage.name, e)
                            }
                            className="hover:opacity-80"
                          >
                            <div
                              className="h-3 w-3 rounded sm:h-4 sm:w-4"
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
                              'flex items-center gap-1 hover:text-blue-500',
                              mainPackage.hidden ? 'opacity-50' : '',
                            )}
                          >
                            {mainPackage.name}
                            {mainPackage.hidden ? (
                              <MdVisibilityOff className="h-3 w-3 sm:h-4 sm:w-4" />
                            ) : null}
                          </button>
                        </Tooltip>
                      </>
                    )}
                    {isCombined ? (
                      <span className="rounded-md border-[1.5px] border-current px-1 py-0.5 text-[.7em] leading-none font-black text-black/70 opacity-80 dark:text-white/70">
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
                            <button className="px-0.5 hover:text-blue-500 sm:px-1">
                              <MdMoreVert className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          </DropdownMenuTrigger>
                        </Tooltip>
                        <DropdownMenuContent
                          className="z-50 min-w-[200px] rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800"
                          sideOffset={5}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium">Options</span>
                          </div>
                          <div className="space-y-1">
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                togglePackageVisibility(index, mainPackage.name)
                              }}
                              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20"
                            >
                              {mainPackage.hidden ? (
                                <MdVisibilityOff className="text-sm" />
                              ) : (
                                <MdVisibility className="text-sm" />
                              )}
                              {mainPackage.hidden
                                ? 'Show Package'
                                : 'Hide Package'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                handleBaselineChange(mainPackage.name)
                              }}
                              className={twMerge(
                                'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20',
                                pkg.baseline ? 'text-blue-500' : '',
                              )}
                            >
                              <MdPushPin className="text-sm" />
                              {pkg.baseline
                                ? 'Remove Baseline'
                                : 'Set as Baseline'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                handleColorClick(
                                  mainPackage.name,
                                  e as unknown as React.MouseEvent,
                                )
                              }}
                              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              Change Color
                            </DropdownMenuItem>
                            {isCombined && (
                              <>
                                <div className="my-1 h-px bg-gray-500/20" />
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
                                    className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20"
                                  >
                                    <div className="flex flex-1 items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {subPackage.hidden ? (
                                          <MdVisibilityOff className="text-sm" />
                                        ) : (
                                          <MdVisibility className="text-sm" />
                                        )}
                                        <span
                                          className={
                                            subPackage.hidden
                                              ? 'opacity-50'
                                              : ''
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
                                        <MdClose className="h-3 w-3" />
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
                              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm outline-none hover:bg-gray-500/20"
                            >
                              <MdAdd className="text-sm" />
                              Add Packages
                            </DropdownMenuItem>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <button
                      onClick={() => handleRemovePackageName(index)}
                      className="ml-auto pl-0.5 text-gray-500 hover:text-red-500 sm:pl-1"
                    >
                      <MdClose className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                  {packageError && (
                    <div className="mt-1 rounded bg-red-500/10 px-1 font-mono text-xs font-medium text-red-500">
                      {packageError}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Combine Package Dialog */}
          {combiningPackage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-2 sm:p-4 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between sm:mb-4">
                  <h3 className="text-base font-medium sm:text-lg">
                    Add packages to {combiningPackage}
                  </h3>
                  <button
                    onClick={() => setCombiningPackage(null)}
                    className="p-0.5 hover:text-red-500 sm:p-1"
                  >
                    <MdClose className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
                <PackageSearch
                  onSelect={handleAddToGroup}
                  placeholder="Search for packages to add..."
                  autoFocus={true}
                />
              </div>
            </div>
          )}

          {/* Color Picker Popover */}
          {colorPickerPackage && colorPickerPosition && (
            <div
              className="fixed z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-gray-800"
              style={{
                left: colorPickerPosition.x,
                top: colorPickerPosition.y,
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Pick a color</span>
              </div>
              <HexColorPicker
                color={getPackageColor(colorPickerPackage, packageGroups)}
                onChange={(color: string) =>
                  handleColorChange(colorPickerPackage, color)
                }
              />
              <div className="mt-2 flex justify-between">
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
                <Resizable height={height} onHeightChange={onHeightChange}>
                  <NpmStatsChart
                    range={range}
                    queryData={npmQuery.data}
                    transform={transform}
                    binType={binType}
                    packages={packageGroups}
                    facetX={facetX}
                    facetY={facetY}
                    showDataMode={showDataModeParam}
                  />
                </Resizable>
                <div className="overflow-x-auto rounded-xl">
                  <table className="min-w-full">
                    <thead className="bg-gray-500/10">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase sm:px-6 sm:py-3 dark:text-gray-300">
                          Package Name
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium tracking-wider text-gray-500 uppercase sm:px-6 sm:py-3 dark:text-gray-300">
                          Total Period Downloads
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium tracking-wider text-gray-500 uppercase sm:px-6 sm:py-3 dark:text-gray-300">
                          Downloads last {binOption.single}
                        </th>
                        {/* <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Period Growth
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Period Growth %
                        </th> */}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/10 bg-gray-500/5">
                      {npmQuery.data
                        ?.map((packageGroupDownloads, index) => {
                          if (
                            !packageGroupDownloads.packages.some(
                              (p) => p.downloads.length,
                            )
                          ) {
                            return null
                          }

                          // const flooredStartData =
                          //   binOption.bin.floor(startDate)

                          const firstPackage = packageGroupDownloads.packages[0]

                          // const rangeFilteredDownloads =
                          //   packageGroupDownloads.packages.map((p) => {
                          //     return {
                          //       ...p,
                          //       downloads: p.downloads.filter(
                          //         (d) => d.day >= startDate
                          //       ),
                          //     }
                          //   })

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
                            totalDownloads: d3.sum(
                              binnedDownloads,
                              (d) => d[1],
                            ),
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
                            <td className="px-3 py-1 text-xs font-medium whitespace-nowrap text-gray-900 sm:px-6 sm:py-2 sm:text-sm dark:text-gray-100">
                              <div className="flex items-center gap-2">
                                <Tooltip content="Change color">
                                  <button
                                    onClick={(e) =>
                                      handleColorClick(stat!.package, e)
                                    }
                                    className="hover:opacity-80"
                                  >
                                    <div
                                      className="h-4 w-4 rounded"
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
                                        className="flex items-center gap-1 p-0.5 hover:text-blue-500"
                                      >
                                        <span
                                          className={
                                            stat!.hidden ? 'opacity-50' : ''
                                          }
                                        >
                                          {stat!.package}
                                        </span>
                                        {stat!.hidden ? (
                                          <MdVisibilityOff className="" />
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
                                        <MdClose className="" />
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-1 text-right text-xs whitespace-nowrap text-gray-500 sm:px-6 sm:py-2 sm:text-sm dark:text-gray-400">
                              {formatNumber(stat!.totalDownloads)}
                            </td>
                            <td className="px-3 py-1 text-right text-xs whitespace-nowrap text-gray-500 sm:px-6 sm:py-2 sm:text-sm dark:text-gray-400">
                              {formatNumber(stat!.binDownloads)}
                            </td>
                            {/* <td
                              className={`px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-right ${
                                stat!.growth > 0
                                  ? 'text-green-500'
                                  : stat!.growth < 0
                                  ? 'text-red-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {stat!.growth > 0 ? (
                                  <MdArrowUpward />
                                ) : (
                                  <MdArrowDownward />
                                )}
                                {formatNumber(Math.abs(stat!.growth))}
                              </div>
                            </td>
                            <td
                              className={`px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-right ${
                                stat!.growthPercentage > 0
                                  ? 'text-green-500'
                                  : stat!.growthPercentage < 0
                                  ? 'text-red-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              <div className="inline-flex items-center gap-1">
                                {stat!.growthPercentage > 0 ? (
                                  <MdArrowUpward />
                                ) : (
                                  <MdArrowDownward />
                                )}
                                {Math.abs(stat!.growthPercentage).toFixed(1)}%
                              </div>
                            </td> */}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {/* Popular Comparisons Section */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Popular Comparisons</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getPopularComparisons().map((comparison) => {
                const baselinePackage = comparison.packageGroups.find(
                  (pg) => pg.baseline,
                )
                return (
                  <Link
                    key={comparison.title}
                    to="."
                    search={(prev) => ({
                      ...prev,
                      packageGroups: comparison.packageGroups,
                      baseline: comparison.packageGroups.find(
                        (pg) => pg.baseline,
                      )?.packages[0].name,
                    })}
                    resetScroll={false}
                    onClick={(e) => {
                      window.scrollTo({
                        top: 0,
                        behavior: 'smooth',
                      })
                    }}
                    className="block space-y-4 rounded-lg bg-gray-500/10 p-4 transition-colors hover:bg-gray-500/20"
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
                                className="h-3 w-3 rounded-full"
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
                        <div className="rounded-md bg-gray-500/10 px-2 py-1 text-sm leading-none font-bold">
                          {baselinePackage.packages[0].name}
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
        <div className="hidden w-[290px] shrink-0 lg:block xl:w-[332px]">
          <div className="sticky top-4 space-y-4">
            <div className="flex flex-col space-y-2 rounded-lg bg-white p-4 shadow-xl dark:bg-black/40">
              <div className="text-center font-black uppercase opacity-50">
                Our Partners
              </div>
              <div className="transition-colors hover:bg-gray-500/10 dark:hover:bg-gray-500/10">
                <a
                  href="mailto:partners@tanstack.com?subject=TanStack NPM Stats Partnership"
                  className="block p-2 text-xs"
                >
                  <span className="italic opacity-50">
                    Wow, it looks like you could be our first partner for this
                    tool!
                  </span>{' '}
                  <span className="font-black text-blue-500">
                    Chat with us!
                  </span>
                </a>
              </div>
            </div>
            <div className="flex flex-col space-y-2 rounded-lg bg-white p-4 shadow-xl dark:bg-black/40">
              <div className="w-[258px] overflow-x-hidden xl:w-[300px]">
                <GadRightRailSquare />
              </div>
            </div>

            <div className="flex flex-col space-y-2 rounded-lg bg-white p-4 shadow-xl dark:bg-black/40">
              <div className="w-[258px] overflow-x-hidden xl:w-[300px]">
                <GadLeftRailSquare />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto !mt-24 max-w-full overflow-x-hidden">
        <GadFooter />
      </div>
    </div>
  )
}
