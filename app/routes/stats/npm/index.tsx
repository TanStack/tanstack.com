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
} from 'react-icons/md'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import * as Plot from '@observablehq/plot'
import { ParentSize } from '@visx/responsive'
import { Tooltip } from '~/components/Tooltip'
import * as d3 from 'd3'
import { useCombobox } from 'downshift'
import { FaAngleRight, FaArrowLeft } from 'react-icons/fa'

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

const timeIntervals = [
  { value: '7-days', label: '7 Days' },
  { value: '30-days', label: '30 Days' },
  { value: '90-days', label: '90 Days' },
  { value: '180-days', label: '6 Months' },
  { value: '365-days', label: '1 Year' },
] as const

type TimeInterval = '7-days' | '30-days' | '90-days' | '180-days' | '365-days'

type BinningOption = 'monthly' | 'weekly' | 'daily'

type NpmPackage = {
  name: string
  description: string
  version: string
  publisher: {
    username: string
  }
}

function npmQueryOptions({
  packageNames,
  interval,
}: {
  packageNames: string[]
  interval: TimeInterval
}) {
  return queryOptions({
    queryKey: (packageNames || []).map((packageName) => [
      'npm-stats',
      packageName,
      interval,
    ]),
    queryFn: async () => {
      return Promise.all(
        (packageNames || []).map(async (packageName) => {
          const url = `https://api.npmjs.org/downloads/range/last-year/${packageName}`
          const response = await fetch(url)
          if (!response.ok) return null
          const data = await response.json()

          return {
            ...data,
            downloads: data.downloads || [],
          } as NpmStats
        })
      )
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
}: {
  stats: NpmStats[]
  baseline?: string
  viewMode: 'absolute' | 'relative'
  hiddenPackages: Set<string>
  onTogglePackageVisibility: (packageName: string) => void
  binningOption: BinningOption
}) {
  // Get the interval from the URL
  const { interval = '7-days' } = Route.useSearch()
  const [height, setHeight] = React.useState(400)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!dragRef.current) return

    const handleMouseDown = (e: MouseEvent) => {
      setIsDragging(true)
      const startY = e.clientY
      const startHeight = height

      const handleMouseMove = (e: MouseEvent) => {
        const deltaY = e.clientY - startY
        setHeight(Math.max(300, startHeight + deltaY))
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

  // Filter data based on selected interval
  const filteredStats = stats.map((stat) => {
    const now = new Date()
    let cutoffDate: Date

    switch (interval) {
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
                Plot.line(visibleData, {
                  x: 'date',
                  y: 'normalizedDownloads',
                  stroke: 'pkg',
                  strokeWidth: 2,
                  curve: 'monotone-x',
                  tip: 'x',
                }),
                Plot.dot(visibleData, {
                  x: 'date',
                  y: 'normalizedDownloads',
                  fill: 'pkg',
                  r: 3,
                  title: (d: (typeof visibleData)[0]) => {
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
                label: 'Date',
                labelOffset: 35,
                tickFormat: (d: Date) => {
                  switch (interval) {
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
    packageNames: z.array(z.string()).optional().default([]),
    interval: z
      .enum(['7-days', '30-days', '90-days', '180-days', '365-days'])
      .optional()
      .default('7-days'),
    baseline: z.string().optional(),
    viewMode: z.enum(['absolute', 'relative']).optional(),
    binningOption: z.enum(['monthly', 'weekly', 'daily']).optional(),
  }),
  loaderDeps: ({ search }) => ({
    packageNames: search.packageNames,
    interval: search.interval,
  }),
  // loader: async ({ context, deps }) => {
  //   await context.queryClient.ensureQueryData(
  //     npmQueryOptions({
  //       packageNames: deps.packageNames,
  //       interval: deps.interval,
  //     })
  //   )
  // },
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
    onInputValueChange: ({ inputValue }) => {
      if (inputValue && inputValue.length > 2) {
        setIsLoading(true)
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
          packageNames: [...(prev.packageNames || []), selectedItem.name],
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
        <input
          {...getInputProps()}
          placeholder="Search for a package..."
          className="w-full bg-gray-500/10 rounded-md px-3 py-2"
        />
        <ul
          {...getMenuProps()}
          className={`absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-auto ${
            isOpen ? '' : 'hidden'
          }`}
        >
          {isLoading ? (
            <li className="px-3 py-2 text-gray-500">Loading...</li>
          ) : items.length === 0 ? (
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
    packageNames,
    interval = '7-days',
    baseline,
    viewMode = 'absolute',
    binningOption: binningOptionParam,
  } = Route.useSearch()
  const [hiddenPackages, setHiddenPackages] = React.useState<Set<string>>(
    new Set()
  )
  const navigate = Route.useNavigate()

  const binningOption =
    binningOptionParam ??
    (() => {
      switch (interval) {
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

  const npmQuery = useQuery(
    npmQueryOptions({
      packageNames: packageNames || [],
      interval,
    })
  )

  const removePackageName = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageNames: prev.packageNames?.filter((name) => name !== packageName),
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

  const handleIntervalChange = (newInterval: TimeInterval) => {
    // Set default binning option based on the new interval
    switch (newInterval) {
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
    }

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        interval: newInterval,
      }),
      resetScroll: false,
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
            value={interval}
            onChange={(e) =>
              handleIntervalChange(e.target.value as TimeInterval)
            }
            className="bg-gray-500/10 rounded-md px-3 py-2"
          >
            {timeIntervals.map(({ value, label }) => (
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
                    ? 'bg-blue-500 text-white'
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
                    ? 'bg-blue-500 text-white'
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
                    ? 'bg-blue-500 text-white'
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
                    ? 'bg-blue-500 text-white'
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
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-500/20'
                }`}
              >
                Daily
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {packageNames?.map((packageName) => (
            <div
              key={packageName}
              className={`flex items-center pl-2 py-1 rounded-md ${
                baseline === packageName
                  ? 'bg-blue-500/20 text-blue-500'
                  : 'bg-gray-500/20'
              } text-sm`}
            >
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
              <button
                onClick={() => removePackageName(packageName)}
                className="p-1 text-gray-500 hover:text-red-500"
              >
                <MdClose />
              </button>
            </div>
          ))}
        </div>
        {packageNames?.length ? (
          <div className="">
            <div className="space-y-4">
              <NpmStatsChart
                stats={validStats}
                baseline={baseline}
                viewMode={viewMode}
                hiddenPackages={hiddenPackages}
                onTogglePackageVisibility={togglePackageVisibility}
                binningOption={binningOption}
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
                      const firstValue = sortedDownloads[0]?.downloads || 1
                      const lastValue =
                        sortedDownloads[sortedDownloads.length - 1]
                          ?.downloads || 1
                      const growth = lastValue - firstValue
                      const growthPercentage =
                        ((lastValue - firstValue) / firstValue) * 100

                      return {
                        package: stats.package,
                        totalDownloads: stats.downloads.reduce(
                          (sum, day) => sum + day.downloads,
                          0
                        ),
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
                          {formatNumber(stat!.totalDownloads)}
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
                          {formatNumber(stat!.growth)}
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
