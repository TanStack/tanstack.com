import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import {
  MdArrowBack,
  MdClose,
  MdLock,
  MdLockOpen,
  MdVisibility,
  MdVisibilityOff,
  MdAdd,
} from 'react-icons/md'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import * as Plot from '@observablehq/plot'
import { ParentSize } from '@visx/responsive'
import { Tooltip } from '~/components/Tooltip'
import * as d3 from 'd3'
import { useCombobox } from 'downshift'
import { FaAngleRight, FaArrowLeft, FaSpinner } from 'react-icons/fa'

type NpmStats = {
  start: string
  end: string
  package: string
  downloads: Array<{
    downloads: number
    day: string
  }>
}

type NpmResponse = {
  downloads: Array<{
    downloads: number
    day: string
  }>
  start: string
  end: string
  package: string
}

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

type BinningOption = 'monthly' | 'weekly' | 'daily'

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

// Define package aliases that should be combined
const packageAliases: Record<string, string[]> = {
  '@tanstack/react-query': ['react-query'],
  // Add more aliases as needed
}

function npmQueryOptions({
  packages,
  range,
  hiddenSubPackages,
}: {
  packages: Record<string, string[]>
  range: TimeRange
  hiddenSubPackages: Set<string>
}) {
  const now = new Date()
  // Set to start of today to avoid timezone issues
  now.setHours(0, 0, 0, 0)
  let startDate: Date
  let endDate = now

  // Function to get package creation date
  const getPackageCreationDate = async (packageName: string): Promise<Date> => {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`)
      if (!response.ok) return new Date('2010-01-12') // Fallback date
      const data = await response.json()
      return new Date(data.time?.created || '2010-01-12')
    } catch (error) {
      console.error(`Error fetching creation date for ${packageName}:`, error)
      return new Date('2010-01-12') // Fallback date
    }
  }

  // Get the earliest creation date among all packages
  const getEarliestCreationDate = async () => {
    const packageNames = Object.entries(packages).flatMap(
      ([packageName, groupPackages]) => {
        const subPackages = groupPackages.filter(
          (p) => p !== packageName && !hiddenSubPackages.has(p)
        )
        return [packageName, ...subPackages]
      }
    )

    const creationDates = await Promise.all(
      packageNames.map(getPackageCreationDate)
    )
    return new Date(Math.min(...creationDates.map((date) => date.getTime())))
  }

  switch (range) {
    case '7-days':
      startDate = d3.timeDay.offset(now, -7)
      break
    case '30-days':
      startDate = d3.timeDay.offset(now, -30)
      break
    case '90-days':
      startDate = d3.timeDay.offset(now, -90)
      break
    case '180-days':
      startDate = d3.timeDay.offset(now, -180)
      break
    case '365-days':
      startDate = d3.timeDay.offset(now, -365)
      break
    case '730-days':
      startDate = d3.timeDay.offset(now, -730)
      break
    case '1825-days':
      startDate = d3.timeDay.offset(now, -1825)
      break
    case 'all-time':
      // We'll handle this in the queryFn
      startDate = new Date('2010-01-12') // This will be overridden
      break
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Expand package names to include aliases, but exclude hidden sub-packages
  const expandedPackageNames = Object.entries(packages).flatMap(
    ([packageName, groupPackages]) => {
      const subPackages = groupPackages.filter(
        (p) => p !== packageName && !hiddenSubPackages.has(p)
      )
      return [packageName, ...subPackages]
    }
  )

  return queryOptions({
    queryKey: expandedPackageNames.map((packageName) => [
      'npm-stats',
      packageName,
      range,
    ]),
    queryFn: async () => {
      // For all-time range, get the earliest creation date
      if (range === 'all-time') {
        startDate = await getEarliestCreationDate()
      }

      const results = await Promise.all(
        expandedPackageNames.map(async (packageName) => {
          // For longer ranges, we need to make multiple requests
          if (range === '1825-days' || range === 'all-time') {
            const chunks: NpmStats[] = []
            let currentEnd = endDate
            let currentStart = startDate

            while (currentStart < currentEnd) {
              const chunkEnd = new Date(currentEnd)
              const chunkStart = new Date(
                Math.max(
                  currentStart.getTime(),
                  currentEnd.getTime() - 365 * 24 * 60 * 60 * 1000
                )
              )

              const url = `https://api.npmjs.org/downloads/range/${formatDate(
                chunkStart
              )}:${formatDate(chunkEnd)}/${packageName}`
              const response = await fetch(url)
              if (!response.ok) break
              const data = await response.json()
              chunks.push(data)

              // Move the end date to the day before the start of the current chunk
              currentEnd = new Date(chunkStart.getTime() - 24 * 60 * 60 * 1000)
            }

            // Combine all chunks and ensure no gaps
            const combinedDownloads = chunks
              .flatMap((chunk) => chunk.downloads || [])
              .sort(
                (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
              )

            // Find the earliest non-zero download
            const firstNonZero = combinedDownloads.find((d) => d.downloads > 0)
            if (firstNonZero) {
              startDate = new Date(firstNonZero.day)
            }

            // Fill in any gaps with zero downloads
            const filledDownloads = []
            let currentDate = new Date(startDate)
            const endDateObj = new Date(endDate)

            while (currentDate <= endDateObj) {
              const dateStr = formatDate(currentDate)
              const existingData = combinedDownloads.find(
                (d) => d.day === dateStr
              )
              filledDownloads.push(
                existingData || { day: dateStr, downloads: 0 }
              )
              currentDate = new Date(
                currentDate.getTime() + 24 * 60 * 60 * 1000
              )
            }

            return {
              package: packageName,
              downloads: filledDownloads,
              start: formatDate(startDate),
              end: formatDate(endDate),
            } as NpmStats
          }

          // For shorter ranges, use a single request
          const url = `https://api.npmjs.org/downloads/range/${formatDate(
            startDate
          )}:${formatDate(endDate)}/${packageName}`
          const response = await fetch(url)
          if (!response.ok) return null
          const data = await response.json()

          return {
            ...data,
            downloads: data.downloads || [],
          } as NpmStats
        })
      )

      // Combine results for aliased packages
      const combinedResults = Object.entries(packages).map(
        ([packageName, aliases]) => {
          const allPackages = [packageName, ...aliases]
          const packageResults = results.filter(
            (r) => r && allPackages.includes(r.package)
          )

          if (!packageResults.length) return null

          // Combine downloads from all packages
          const combinedDownloads = packageResults.reduce((acc, curr) => {
            if (!curr) return acc
            curr.downloads.forEach((d) => {
              const existing = acc.find((a) => a.day === d.day)
              if (existing) {
                existing.downloads += d.downloads
              } else {
                acc.push({ ...d })
              }
            })
            return acc
          }, [] as Array<{ day: string; downloads: number }>)

          // Sort by date
          combinedDownloads.sort(
            (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
          )

          return {
            package: packageName,
            downloads: combinedDownloads,
            start: formatDate(startDate),
            end: formatDate(endDate),
          } as NpmStats
        }
      )

      return combinedResults
    },
    placeholderData: keepPreviousData,
  })
}

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
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

function NpmStatsChart({
  stats,
  baseline,
  viewMode,
  hiddenPackages,
  onTogglePackageVisibility,
  binningOption,
  alignStartDates,
}: {
  stats: NpmStats[]
  baseline?: string
  viewMode: 'absolute' | 'relative'
  hiddenPackages: Set<string>
  onTogglePackageVisibility: (packageName: string) => void
  binningOption: BinningOption
  alignStartDates: boolean
}) {
  // Get the range from the URL
  const { range = '7-days' } = Route.useSearch()
  const [height, setHeight] = React.useState(400)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef<HTMLDivElement>(null)
  const startYRef = React.useRef<number>(0)
  const startHeightRef = React.useRef<number>(0)

  React.useEffect(() => {
    if (!dragRef.current) return

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
      startYRef.current = e.clientY
      startHeightRef.current = height

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startYRef.current
        setHeight(Math.max(300, startHeightRef.current + deltaY))
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    dragRef.current.addEventListener('mousedown', handleMouseDown)
    return () => {
      dragRef.current?.removeEventListener('mousedown', handleMouseDown)
    }
  }, [height])

  if (!stats.length) return null

  // Filter data based on selected range
  const filteredStats = stats.map((stat) => {
    const now = new Date()
    let cutoffDate: Date

    switch (range) {
      case '7-days':
        cutoffDate = d3.timeWeek.offset(d3.timeWeek.floor(now), -1)
        break
      case '30-days':
        cutoffDate = d3.timeWeek.offset(d3.timeWeek.floor(now), -4)
        break
      case '90-days':
        cutoffDate = d3.timeWeek.offset(d3.timeWeek.floor(now), -13)
        break
      case '180-days':
        cutoffDate = d3.timeMonth.offset(d3.timeMonth.floor(now), -6)
        break
      case '365-days':
        cutoffDate = d3.timeMonth.offset(d3.timeMonth.floor(now), -12)
        break
      case '730-days':
        cutoffDate = d3.timeMonth.offset(d3.timeMonth.floor(now), -24)
        break
      case '1825-days':
        cutoffDate = d3.timeMonth.offset(d3.timeMonth.floor(now), -60)
        break
      case 'all-time':
        cutoffDate = new Date('2010-01-12')
        break
      default:
        return stat
    }

    // Compare dates at the start of the day
    cutoffDate.setHours(0, 0, 0, 0)
    return {
      ...stat,
      downloads: stat.downloads.filter((d) => {
        const downloadDate = new Date(d.day)
        downloadDate.setHours(0, 0, 0, 0)
        return downloadDate >= cutoffDate
      }),
    }
  })

  // Find the latest first non-zero date across all packages if aligning start dates
  let latestFirstNonZero: Date | null = null
  if (alignStartDates) {
    latestFirstNonZero = new Date(
      Math.max(
        ...filteredStats.map((stat) => {
          const firstNonZero = stat.downloads.find((d) => d.downloads > 0)
          return firstNonZero ? new Date(firstNonZero.day).getTime() : 0
        })
      )
    )
  }

  // Bin the data first
  const binnedStats = filteredStats.map((stat) => {
    const binnedDownloads = stat.downloads.map((d) => {
      const date = new Date(d.day)
      let binnedDate = date

      switch (binningOption) {
        case 'monthly':
          binnedDate = d3.timeMonth.floor(date)
          break
        case 'weekly':
          binnedDate = d3.timeWeek.floor(date)
          break
        case 'daily':
          binnedDate = d3.timeDay.floor(date)
          break
      }

      return {
        ...d,
        day: binnedDate.toISOString().split('T')[0],
      }
    })

    // Aggregate downloads by binned date
    const aggregatedDownloads = d3.rollup(
      binnedDownloads,
      (v) => ({
        day: v[0].day,
        downloads: d3.sum(v, (d) => d.downloads),
      }),
      (d) => d.day
    )

    return {
      ...stat,
      downloads: Array.from(aggregatedDownloads.values()),
    }
  })

  // Find the baseline stats
  const baselineStats = baseline
    ? binnedStats.find((s) => s.package === baseline)
    : null

  const baselineByDate = new Map(
    baselineStats?.downloads.map((d) => [d.day, d.downloads]) || []
  )

  // Flatten the data for the plot using binned stats
  const plotData = binnedStats.flatMap((stat) => {
    const processed: {
      pkg: string
      date: Date
      downloads: number
      normalizedDownloads: number
    }[] = []

    stat.downloads.forEach((d) => {
      const baselineDecimal = baseline ? baselineByDate.get(d.day) ?? 1 : 1
      const normalizedDownloads = d.downloads / baselineDecimal

      processed.push({
        ...d,
        pkg: stat.package,
        date: new Date(d.day),
        downloads: d.downloads,
        normalizedDownloads: normalizedDownloads,
      })
    })

    // Calculate relative growth if in relative mode
    if (viewMode === 'relative') {
      return processed.map((d) => {
        const firstValue =
          processed.find((p) => p.pkg === d.pkg)?.normalizedDownloads ?? 0

        return {
          ...d,
          normalizedDownloads: (d.normalizedDownloads / firstValue - 1) * 100,
        }
      })
    }

    return processed
  })

  // Filter out hidden packages for display
  const visibleData = plotData.filter((d) => !hiddenPackages.has(d.pkg))

  // Shift dates if aligning start dates
  const shiftedData =
    alignStartDates && latestFirstNonZero
      ? visibleData.map((d) => {
          const firstNonZero = visibleData.find(
            (p) => p.pkg === d.pkg && p.downloads > 0
          )
          if (!firstNonZero) return d

          const daysSinceFirstNonZero = Math.floor(
            (d.date.getTime() - firstNonZero.date.getTime()) /
              (24 * 60 * 60 * 1000)
          )
          const newDate = new Date(latestFirstNonZero)
          newDate.setDate(newDate.getDate() + daysSinceFirstNonZero)

          return {
            ...d,
            date: newDate,
          }
        })
      : visibleData

  return (
    <div className="relative">
      <ParentSize>
        {({ width }) => (
          <PlotFigure
            options={{
              marginLeft: 70,
              marginRight: 10,
              marginBottom: 70,
              width,
              height,
              marks: [
                Plot.ruleY([0], {
                  stroke: 'currentColor',
                  strokeWidth: 1.5,
                  strokeOpacity: 0.5,
                }),
                Plot.line(shiftedData, {
                  x: 'date',
                  y: 'normalizedDownloads',
                  stroke: 'pkg',
                  strokeWidth: 2,
                  curve: 'monotone-x',
                  tip: 'x',
                }),
                Plot.dot(shiftedData, {
                  x: 'date',
                  y: 'normalizedDownloads',
                  fill: 'pkg',
                  r: 3,
                  title: (d: (typeof shiftedData)[0]) => {
                    const value = d.normalizedDownloads
                    const label =
                      viewMode === 'relative'
                        ? 'growth'
                        : baseline
                        ? 'of baseline'
                        : 'downloads'
                    return `${
                      d.pkg
                    }\n${d.date.toLocaleDateString()}\n${formatNumber(
                      d.downloads
                    )} downloads\n${value?.toFixed(1) ?? '0'}% ${label}`
                  },
                }),
              ],
              x: {
                type: 'time',
                label: alignStartDates ? 'Days Since First Download' : 'Date',
                labelOffset: 35,
                tickFormat: (d: Date) => {
                  if (alignStartDates) {
                    const days = Math.floor(
                      (d.getTime() - latestFirstNonZero!.getTime()) /
                        (24 * 60 * 60 * 1000)
                    )
                    return `Day ${days}`
                  }
                  switch (range) {
                    case '365-days':
                    case '180-days':
                      return d3.timeFormat('%b %Y')(d)
                    case '30-days':
                    case '90-days':
                      return d3.timeFormat('%b %d')(d)
                    case '7-days':
                      return d3.timeFormat('%a')(d)
                    default:
                      return d3.timeFormat('%x')(d)
                  }
                },
              },
              y: {
                label:
                  viewMode === 'relative'
                    ? 'Growth (%)'
                    : baseline
                    ? 'Downloads (% of baseline)'
                    : 'Downloads',
                labelOffset: 35,
                tickFormat: (d: number) => {
                  if (viewMode === 'relative' || baseline) {
                    return `${d.toFixed(1)}%`
                  }
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
                domain: plotData.map((d) => d.pkg),
                legendLabel: (d: string) => (
                  <button
                    onClick={() => onTogglePackageVisibility(d)}
                    className={`flex items-center gap-1 ${
                      hiddenPackages.has(d) ? 'opacity-50' : ''
                    }`}
                  >
                    {hiddenPackages.has(d) ? (
                      <MdVisibilityOff className="w-4 h-4" />
                    ) : (
                      <MdVisibility className="w-4 h-4" />
                    )}
                    {d}
                  </button>
                ),
              },
            }}
          />
        )}
      </ParentSize>
      <div
        ref={dragRef}
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center ${
          isDragging ? 'bg-blue-500' : 'hover:bg-gray-500/20'
        }`}
      >
        <div className="w-8 h-1 bg-gray-400 rounded-full" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stats/npm/')({
  validateSearch: z.object({
    packages: z.record(z.array(z.string())).optional().default({}),
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
      .default('7-days'),
    baseline: z.string().optional(),
    viewMode: z.enum(['absolute', 'relative']).optional(),
    binningOption: z.enum(['monthly', 'weekly', 'daily']).optional(),
    alignStartDates: z.boolean().optional().default(false),
  }),
  loaderDeps: ({ search }) => ({
    packages: search.packages,
    range: search.range,
  }),
  component: RouteComponent,
})

function PackageSearch() {
  const [items, setItems] = React.useState<NpmPackage[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = Route.useNavigate()

  const {
    isOpen,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    reset,
    inputValue,
  } = useCombobox({
    items,
    defaultHighlightedIndex: 0,
    onInputValueChange: ({ inputValue }) => {
      if (inputValue && inputValue.length > 2) {
        setIsLoading(true)
        setItems([
          {
            name: inputValue,
            description: '',
            version: '',
            publisher: { username: '' },
          },
        ])

        fetch(
          `https://api.npms.io/v2/search?q=${encodeURIComponent(
            inputValue
          )}&size=10`
        )
          .then((res) => res.json())
          .then((data) => {
            const hasInputValue = data.results.find(
              (r: any) => r.package.name === inputValue
            )

            setItems([
              ...(hasInputValue ? [] : [{ name: inputValue }]),
              ...data.results.map((r: any) => r.package),
            ])
            setIsLoading(false)
          })
          .catch(() => {
            setIsLoading(false)
          })
      } else {
        setItems([])
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) return

      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          packages: {
            ...prev.packages,
            [selectedItem.name]: [selectedItem.name],
          },
        }),
        resetScroll: false,
      })
      reset()
      setItems([])
    },
  })

  return (
    <div className="flex-1">
      <div className="relative">
        <div>
          <input
            {...getInputProps()}
            placeholder="Search for a package..."
            className="w-full bg-gray-500/10 rounded-md px-3 py-2 min-w-[200px]"
          />
          {isLoading ? (
            <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
              <FaSpinner className="w-4 h-4 animate-spin" />
            </div>
          ) : null}
        </div>
        <ul
          {...getMenuProps()}
          className={`absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto ${
            isOpen ? '' : 'hidden'
          }`}
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">No packages found</li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.name}
                {...getItemProps({ item, index })}
                className={`px-3 py-2 cursor-pointer ${
                  highlightedIndex === index
                    ? 'bg-gray-500/20 '
                    : 'hover:bg-gray-500/20'
                }`}
              >
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {item.version ? `v${item.version}• ` : ''}
                  {item.publisher?.username}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

function RouteComponent() {
  const {
    packages,
    range = '7-days',
    baseline,
    viewMode = 'absolute',
    binningOption: binningOptionParam,
    alignStartDates = false,
  } = Route.useSearch()
  const [hiddenPackages, setHiddenPackages] = React.useState<Set<string>>(
    new Set()
  )
  const [hiddenSubPackages, setHiddenSubPackages] = React.useState<Set<string>>(
    new Set()
  )
  const [combiningPackage, setCombiningPackage] = React.useState<string | null>(
    null
  )
  const [combineSearchResults, setCombineSearchResults] = React.useState<
    NpmPackage[]
  >([])
  const [isCombining, setIsCombining] = React.useState(false)
  const navigate = Route.useNavigate()

  const binningOption =
    binningOptionParam ??
    (() => {
      switch (range) {
        case '7-days':
          return 'daily'
        case '30-days':
          return 'daily'
        case '90-days':
          return 'weekly'
        case '180-days':
          return 'monthly'
        case '365-days':
          return 'monthly'
        case '730-days':
          return 'monthly'
        case '1825-days':
          return 'monthly'
        case 'all-time':
          return 'monthly'
      }
    })()

  const togglePackageVisibility = (packageName: string) => {
    setHiddenPackages((prev) => {
      const next = new Set(prev)
      if (next.has(packageName)) {
        next.delete(packageName)
      } else {
        next.add(packageName)
      }
      return next
    })
  }

  const toggleSubPackageVisibility = (packageName: string) => {
    setHiddenSubPackages((prev) => {
      const next = new Set(prev)
      if (next.has(packageName)) {
        next.delete(packageName)
      } else {
        next.add(packageName)
      }
      return next
    })
  }

  const npmQuery = useQuery(
    npmQueryOptions({
      packages,
      range,
      hiddenSubPackages,
    })
  )

  const handleCombineSelect = (selectedPackage: NpmPackage) => {
    if (!combiningPackage) return

    // Update the packages object
    const newPackages = {
      ...packages,
      [combiningPackage]: [
        ...(packages[combiningPackage] || [combiningPackage]),
        selectedPackage.name,
      ],
    }

    // Update the URL with the new packages
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packages: newPackages,
      }),
      resetScroll: false,
    })

    setCombiningPackage(null)
    setCombineSearchResults([])
  }

  const handleRemoveFromGroup = (mainPackage: string, subPackage: string) => {
    // Update the packages object
    const newPackages = {
      ...packages,
      [mainPackage]: packages[mainPackage].filter((p) => p !== subPackage),
    }

    // If no more packages in the group, remove the entry
    if (newPackages[mainPackage].length === 0) {
      delete newPackages[mainPackage]
    }

    // Update the URL with the new packages
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packages: newPackages,
      }),
      resetScroll: false,
    })
  }

  const removePackageName = (packageName: string) => {
    // Update the packages object
    const newPackages = { ...packages }
    delete newPackages[packageName]

    // Update the URL with the new packages
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packages: newPackages,
      }),
      resetScroll: false,
    })
  }

  const setBinningOption = (newBinningOption: BinningOption) => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, binningOption: newBinningOption }),
      resetScroll: false,
    })
  }

  const handleRangeChange = (newRange: TimeRange) => {
    // Set default binning option based on the new range
    switch (newRange) {
      case '7-days':
        setBinningOption('daily')
        break
      case '30-days':
        setBinningOption('daily')
        break
      case '90-days':
        setBinningOption('weekly')
        break
      case '180-days':
        setBinningOption('monthly')
        break
      case '365-days':
        setBinningOption('monthly')
        break
      case '730-days':
        setBinningOption('monthly')
        break
      case '1825-days':
        setBinningOption('monthly')
        break
      case 'all-time':
        setBinningOption('monthly')
        break
    }

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        range: newRange,
      }),
    })
  }

  const handleViewModeChange = (mode: 'absolute' | 'relative') => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        viewMode: mode,
      }),
      resetScroll: false,
    })
  }

  const handleBinnedChange = (value: 'daily' | 'weekly' | 'monthly') => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binningOption: value,
      }),
      resetScroll: false,
    })
  }

  const handleBaselineChange = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        baseline: prev.baseline === packageName ? undefined : packageName,
      }),
      resetScroll: false,
    })
  }

  const handleAlignStartDatesChange = (value: boolean) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        alignStartDates: value,
      }),
      resetScroll: false,
    })
  }

  const handleCombinePackage = (packageName: string) => {
    setCombiningPackage(packageName)
    setCombineSearchResults([])
  }

  const handleCombineSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setCombineSearchResults([])
      return
    }

    setIsCombining(true)
    try {
      const response = await fetch(
        `https://api.npms.io/v2/search?q=${encodeURIComponent(query)}&size=10`
      )
      const data = await response.json()
      setCombineSearchResults(data.results.map((r: any) => r.package))
    } catch (error) {
      console.error('Error searching packages:', error)
    } finally {
      setIsCombining(false)
    }
  }

  const validStats = (npmQuery.data ?? [])?.filter((data): data is NpmStats => {
    if (!data) return false
    return Array.isArray(data.downloads) && data.downloads.length > 0
  })

  return (
    <div className="min-h-dvh p-4 space-y-4">
      <div className="bg-white dark:bg-black/50 rounded-lg p-4 flex items-center gap-2 text-xl">
        <Link to="/" className="hover:text-blue-500">
          Home
        </Link>
        <FaAngleRight />
        <Link to="." className="hover:text-blue-500">
          NPM Stats
        </Link>
      </div>
      <div className="bg-white dark:bg-black/50 rounded-lg space-y-4 p-4">
        <div className="flex gap-4 flex-wrap">
          <PackageSearch />
          <select
            value={range}
            onChange={(e) => handleRangeChange(e.target.value as TimeRange)}
            className="bg-gray-500/10 rounded-md px-3 py-2"
          >
            {timeRanges.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex items-stretch bg-gray-500/10 rounded-md">
            <Tooltip content="Show absolute download numbers">
              <button
                onClick={() => handleViewModeChange('absolute')}
                className={`px-3 py-1.5 rounded-l ${
                  viewMode === 'absolute'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Absolute
              </button>
            </Tooltip>
            <Tooltip content="Show growth relative to each package's starting point">
              <button
                onClick={() => handleViewModeChange('relative')}
                className={`px-3 py-1.5 rounded-r ${
                  viewMode === 'relative'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Relative
              </button>
            </Tooltip>
          </div>
          <div className="flex items-stretch bg-gray-500/10 rounded-md">
            <Tooltip content="Group data by month">
              <button
                onClick={() => handleBinnedChange('monthly')}
                className={`px-3 py-1.5 rounded-l ${
                  binningOption === 'monthly'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Monthly
              </button>
            </Tooltip>
            <Tooltip content="Group data by week">
              <button
                onClick={() => handleBinnedChange('weekly')}
                className={`px-3 py-1.5 ${
                  binningOption === 'weekly'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Weekly
              </button>
            </Tooltip>
            <Tooltip content="Show daily data points">
              <button
                onClick={() => handleBinnedChange('daily')}
                className={`px-3 py-1.5 rounded-r ${
                  binningOption === 'daily'
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Daily
              </button>
            </Tooltip>
          </div>
          <div className="flex items-stretch bg-gray-500/10 rounded-md">
            <Tooltip content="Align all packages to start from their first non-zero download">
              <button
                onClick={() => handleAlignStartDatesChange(!alignStartDates)}
                className={`px-3 py-1.5 rounded ${
                  alignStartDates
                    ? 'bg-cyan-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Align Start Dates
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(packages).map(([packageName, groupPackages]) => {
            const isCombined = groupPackages.length > 1
            const subPackages = groupPackages.filter((p) => p !== packageName)

            return (
              <div
                key={packageName}
                className={`flex flex-col pl-2 py-1 rounded-md ${
                  baseline === packageName
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'bg-gray-500/20'
                } text-sm`}
              >
                <div className="flex items-center">
                  <Tooltip content="Toggle package visibility">
                    <button
                      onClick={() => togglePackageVisibility(packageName)}
                      className={`p-1 hover:text-blue-500`}
                    >
                      {hiddenPackages.has(packageName) ? (
                        <MdVisibilityOff />
                      ) : (
                        <MdVisibility />
                      )}
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => togglePackageVisibility(packageName)}
                    className={`px-1 hover:text-blue-500 ${
                      hiddenPackages.has(packageName) ? 'opacity-50' : ''
                    }`}
                  >
                    {packageName}
                  </button>
                  <Tooltip content="Use as baseline for comparison">
                    <button
                      onClick={() => handleBaselineChange(packageName)}
                      className="p-1 hover:text-blue-500"
                    >
                      {baseline === packageName ? <MdLock /> : <MdLockOpen />}
                    </button>
                  </Tooltip>
                  <Tooltip content="Add packages to this group">
                    <button
                      onClick={() => handleCombinePackage(packageName)}
                      className="p-1 hover:text-blue-500"
                    >
                      <MdAdd />
                    </button>
                  </Tooltip>
                  <button
                    onClick={() => removePackageName(packageName)}
                    className="p-1 text-gray-500 hover:text-red-500"
                  >
                    <MdClose />
                  </button>
                </div>
                {isCombined && (
                  <div className="mt-1 space-y-1">
                    {subPackages.map((subPackage) => (
                      <div
                        key={subPackage}
                        className="flex items-center text-gray-500"
                      >
                        <Tooltip content="Toggle sub-package visibility">
                          <button
                            onClick={() =>
                              toggleSubPackageVisibility(subPackage)
                            }
                            className={`px-1 hover:text-blue-500 ${
                              hiddenSubPackages.has(subPackage)
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            {hiddenSubPackages.has(subPackage) ? (
                              <MdVisibilityOff />
                            ) : (
                              <MdVisibility />
                            )}
                          </button>
                        </Tooltip>
                        <button
                          onClick={() => toggleSubPackageVisibility(subPackage)}
                          className={`px-1 hover:text-blue-500 ${
                            hiddenSubPackages.has(subPackage)
                              ? 'opacity-50'
                              : ''
                          }`}
                        >
                          {subPackage}
                        </button>
                        <button
                          onClick={() =>
                            handleRemoveFromGroup(packageName, subPackage)
                          }
                          className="ml-1 p-0.5 text-gray-400 hover:text-red-500"
                        >
                          <MdClose className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Combine Package Dialog */}
        {combiningPackage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">
                  Add packages to {combiningPackage}
                </h3>
                <button
                  onClick={() => setCombiningPackage(null)}
                  className="p-1 hover:text-red-500"
                >
                  <MdClose />
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for packages..."
                  className="w-full bg-gray-500/10 rounded-md px-3 py-2"
                  onChange={(e) => handleCombineSearch(e.target.value)}
                  autoFocus
                />
                {isCombining && (
                  <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  </div>
                )}
              </div>
              <div className="mt-4 max-h-60 overflow-auto">
                {combineSearchResults.map((pkg) => (
                  <button
                    key={pkg.name}
                    onClick={() => handleCombineSelect(pkg)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-500/20 rounded-md"
                  >
                    <div className="font-medium">{pkg.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {pkg.description}
                    </div>
                  </button>
                ))}
                {combineSearchResults.length === 0 && (
                  <div className="px-3 py-2 text-gray-500">
                    No matching packages found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {Object.keys(packages).length ? (
          <div className="">
            <div className="space-y-4">
              <NpmStatsChart
                stats={validStats}
                baseline={baseline}
                viewMode={viewMode}
                hiddenPackages={hiddenPackages}
                onTogglePackageVisibility={togglePackageVisibility}
                binningOption={binningOption}
                alignStartDates={alignStartDates}
              />
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Package Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Downloads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Growth
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      % Growth
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900">
                  {npmQuery.data
                    ?.map((stats) => {
                      if (!stats?.downloads?.length) return null

                      // Sort downloads by date
                      const sortedDownloads = [...stats.downloads].sort(
                        (a, b) =>
                          new Date(a.day).getTime() - new Date(b.day).getTime()
                      )

                      // Get the latest week of downloads
                      const latestWeek = sortedDownloads.slice(-7)
                      const latestWeeklyDownloads = latestWeek.reduce(
                        (sum, day) => sum + day.downloads,
                        0
                      )

                      // Calculate growth metrics
                      const firstWeek = sortedDownloads.slice(0, 7)
                      const firstWeeklyDownloads = firstWeek.reduce(
                        (sum, day) => sum + day.downloads,
                        0
                      )

                      const growth =
                        latestWeeklyDownloads - firstWeeklyDownloads
                      const growthPercentage =
                        firstWeeklyDownloads > 0
                          ? ((latestWeeklyDownloads - firstWeeklyDownloads) /
                              firstWeeklyDownloads) *
                            100
                          : 0

                      return {
                        package: stats.package,
                        totalDownloads: latestWeeklyDownloads,
                        growth,
                        growthPercentage,
                      }
                    })
                    .filter(Boolean)
                    .sort((a, b) => b!.totalDownloads - a!.totalDownloads)
                    .map((stat) => (
                      <tr key={stat!.package}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {stat!.package}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatNumber(stat!.totalDownloads)}/week
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm ${
                            stat!.growth > 0
                              ? 'text-green-500'
                              : stat!.growth < 0
                              ? 'text-red-500'
                              : 'text-gray-500'
                          }`}
                        >
                          {stat!.growth > 0 ? '+' : ''}
                          {formatNumber(stat!.growth)}/week
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm ${
                            stat!.growthPercentage > 0
                              ? 'text-green-500'
                              : stat!.growthPercentage < 0
                              ? 'text-red-500'
                              : 'text-gray-500'
                          }`}
                        >
                          {stat!.growthPercentage > 0 ? '+' : ''}
                          {stat!.growthPercentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
