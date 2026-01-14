import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import * as React from 'react'
import { useEffect } from 'react'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import * as Plot from '@observablehq/plot'
import * as d3 from 'd3'
import { X, Eye, EyeOff } from 'lucide-react'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { getLibrary } from '~/libraries'
import NpmStatsSummaryBar from '~/components/NpmStatsSummaryBar'
import { useWidthToggle } from '~/components/DocsLayout'
import { ParentSize } from '~/components/ParentSize'
import { Spinner } from '~/components/Spinner'
import { twMerge } from 'tailwind-merge'

const transformModeSchema = v.enum_(['none', 'normalize-y'])
const binTypeSchema = v.enum_(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = v.enum_(['all', 'complete'])

const packageGroupSchema = v.object({
  packages: v.array(
    v.object({
      name: v.string(),
      hidden: v.optional(v.boolean()),
    }),
  ),
  color: v.optional(v.nullable(v.string())),
  baseline: v.optional(v.boolean()),
})

const facetValueSchema = v.union([v.literal('name'), v.undefined_()])

type TimeRange =
  | '7-days'
  | '30-days'
  | '90-days'
  | '180-days'
  | '365-days'
  | '730-days'
  | '1825-days'
  | 'all-time'

type BinType = v.InferOutput<typeof binTypeSchema>

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

function npmQueryOptions({
  packageGroups,
  range,
}: {
  packageGroups: (typeof packageGroupSchema)[]
  range: TimeRange
}) {
  const now = d3.utcDay(new Date())
  now.setHours(0, 0, 0, 0)
  const endDate = now

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
        const { fetchNpmDownloadsBulk } = await import('~/utils/stats.server')

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

        return results.map((result, groupIndex) => {
          let actualStartDate = startDate

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
        return packageGroups.map((packageGroup) => ({
          packages: packageGroup.packages.map((pkg) => ({
            ...pkg,
            downloads: [],
          })),
          start: formatDate(startDate),
          end: formatDate(endDate),
          error: 'Failed to fetch package data',
          actualStartDate: startDate,
        }))
      }
    },
    placeholderData: keepPreviousData,
  })
}

function getPackageColor(
  packageName: string,
  packages: v.InferOutput<typeof packageGroupSchema>[],
) {
  const packageInfo = packages.find((pkg) =>
    pkg.packages.some((p) => p.name === packageName),
  )
  if (packageInfo?.color) {
    return packageInfo.color
  }

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

type TransformMode = v.InferOutput<typeof transformModeSchema>

function NpmStatsChart({
  queryData,
  binType,
  packages,
  range,
  height = 400,
  transform = 'none',
}: {
  queryData:
    | undefined
    | Awaited<
        ReturnType<Required<ReturnType<typeof npmQueryOptions>>['queryFn']>
      >
  binType: BinType
  packages: v.InferOutput<typeof packageGroupSchema>[]
  range: TimeRange
  height?: number
  transform?: TransformMode
}) {
  if (!queryData?.length) return null

  const binOption = binningOptionsByType[binType]
  const binUnit = binOption.bin

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
        const earliestActualStartDate = queryData
          .map((pkg) => pkg.actualStartDate)
          .filter((d): d is Date => d !== undefined)
          .sort((a, b) => a.getTime() - b.getTime())[0]
        return earliestActualStartDate || d3.utcDay(new Date('2015-01-10'))
    }
  })()

  startDate = binOption.bin.floor(startDate)

  const combinedPackageGroups = queryData.map((queryPackageGroup, index) => {
    const packageGroupWithHidden = packages[index]

    const visiblePackages = queryPackageGroup.packages.filter((p, i) => {
      const hiddenState = packageGroupWithHidden?.packages.find(
        (pg) => pg.name === p.name,
      )?.hidden
      return !i || !hiddenState
    })

    const downloadsByDate: Map<number, number> = new Map()

    visiblePackages.forEach((pkg) => {
      pkg.downloads.forEach((d) => {
        const date = d3.utcDay(new Date(d.day))
        if (date < startDate) return

        downloadsByDate.set(
          date.getTime(),
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

  const binnedPackageData = combinedPackageGroups.map((packageGroup) => {
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
      change: 0, // Will be calculated below
    }))

    return {
      ...packageGroup,
      downloads,
    }
  })

  // Apply relative change calculation for normalize-y transform
  const correctedPackageData = binnedPackageData.map((packageGroup) => {
    const first = packageGroup.downloads[0]
    const firstDownloads = first?.downloads ?? 0

    return {
      ...packageGroup,
      downloads: packageGroup.downloads.map((d) => ({
        ...d,
        change: d.downloads - firstDownloads,
      })),
    }
  })

  const filteredPackageData = correctedPackageData.filter((_, index) => {
    const packageGroupWithHidden = packages[index]
    const isHidden = packageGroupWithHidden?.packages[0]?.hidden
    return !isHidden
  })

  const plotData = filteredPackageData.flatMap((d) => d.downloads)

  return (
    <ParentSize>
      {({ width = 1000 }) => (
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
              Plot.lineY(plotData, {
                x: 'date',
                y: transform === 'normalize-y' ? 'change' : 'downloads',
                stroke: 'name',
                strokeWidth: 2,
                curve: 'monotone-x',
              }),
              Plot.tip(
                plotData,
                Plot.pointer({
                  x: 'date',
                  y: transform === 'normalize-y' ? 'change' : 'downloads',
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
                transform === 'normalize-y' ? 'Downloads Growth' : 'Downloads',
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

export const Route = createFileRoute('/$libraryId/$version/docs/npm-stats')({
  validateSearch: v.object({
    packageGroups: v.fallback(
      v.optional(v.array(packageGroupSchema)),
      undefined,
    ),
    range: v.fallback(
      v.optional(
        v.enum_([
          '7-days',
          '30-days',
          '90-days',
          '180-days',
          '365-days',
          '730-days',
          '1825-days',
          'all-time',
        ]),
      ),
      '365-days',
    ),
    transform: v.fallback(v.optional(transformModeSchema), 'none'),
    facetX: v.fallback(v.optional(facetValueSchema), undefined),
    facetY: v.fallback(v.optional(facetValueSchema), undefined),
    binType: v.fallback(v.optional(binTypeSchema), 'weekly'),
    showDataMode: v.fallback(v.optional(showDataModeSchema), 'all'),
    height: v.fallback(v.optional(v.number()), 400),
  }),
  component: RouteComponent,
})

function getPackageName(
  frameworkValue: string,
  libraryId: string,
  library: ReturnType<typeof getLibrary>,
): string {
  if (frameworkValue === 'vanilla') {
    const coreName = library.corePackageName || libraryId
    return `@tanstack/${coreName}`
  }
  if (frameworkValue === 'angular' && libraryId === 'query') {
    return `@tanstack/angular-query-experimental`
  }
  return `@tanstack/${frameworkValue}-${libraryId}`
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

const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`
  }
  return num.toString()
}

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { setIsFullWidth } = useWidthToggle()

  const range: TimeRange = search.range ?? '365-days'
  const binTypeParam: BinType | undefined = search.binType
  const binType: BinType = binTypeParam ?? defaultRangeBinTypes[range]
  const height: number = search.height ?? 400
  const transform: TransformMode = search.transform ?? 'none'

  // Enable full-width mode for stats page
  useEffect(() => {
    setIsFullWidth(true)
    // Cleanup: reset to normal width when leaving the page
    return () => setIsFullWidth(false)
  }, [setIsFullWidth])

  // Convert library's textColor (Tailwind class) to actual hex color
  const getLibraryColor = (textColor: string): string | undefined => {
    const tailwindColors: Record<string, string> = {
      // Query
      'text-amber-500': '#f59e0b',
      // Table
      'text-blue-600': '#2563eb',
      'text-blue-500': '#3b82f6',
      // Router
      'text-emerald-500': '#10b981',
      // Form
      'text-yellow-600': '#d97706',
      // Virtual
      'text-purple-600': '#9333ea',
      'text-violet-700': '#6d28d9',
      'text-violet-400': '#a78bfa',
      // Start
      'text-cyan-600': '#0891b2',
      // Store
      'text-twine-600': '#8b5a3c',
      'text-twine-500': '#a0673f',
      'text-twine-700': '#7c5a47',
      // Config, Ranger
      'text-gray-700': '#374151',
      // AI
      'text-pink-700': '#be185d',
      // Pacer
      'text-lime-700': '#4d7c0f',
      'text-lime-600': '#65a30d',
      'text-lime-500': '#84cc16',
      // DB
      'text-orange-700': '#c2410c',
      // Devtools
      'text-slate-600': '#475569',
      // Legacy/fallback colors
      'text-red-500': '#ef4444',
    }
    return tailwindColors[textColor]
  }

  const libraryColor = getLibraryColor(library.textColor || '')

  // Get the core package name for this library
  const corePackageName = getPackageName('vanilla', libraryId, library)

  // Default package groups if none are set
  const defaultPackageGroups = search.packageGroups || [
    {
      packages: [{ name: corePackageName }],
      color: libraryColor || null, // Use library's theme color for core package
    },
  ]

  const handlePackageGroupsChange = (
    newPackageGroups: typeof defaultPackageGroups,
  ) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: newPackageGroups,
      }),
      resetScroll: false,
    })
  }

  const handleRangeChange = (newRange: TimeRange) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        range: newRange,
        binType: defaultRangeBinTypes[newRange],
      }),
      resetScroll: false,
    })
  }

  const handleBinTypeChange = (newBinType: BinType) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binType: newBinType,
      }),
      resetScroll: false,
    })
  }

  const handleTransformChange = (newTransform: TransformMode) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        transform: newTransform,
      }),
      resetScroll: false,
    })
  }

  const togglePackageVisibility = (index: number, packageName: string) => {
    const newPackageGroups = defaultPackageGroups.map((pkg, i) =>
      i === index
        ? {
            ...pkg,
            packages: pkg.packages.map((p) =>
              p.name === packageName ? { ...p, hidden: !p.hidden } : p,
            ),
          }
        : pkg,
    )
    handlePackageGroupsChange(newPackageGroups)
  }

  const handleRemovePackage = (index: number) => {
    const newPackageGroups = defaultPackageGroups.filter((_, i) => i !== index)
    handlePackageGroupsChange(newPackageGroups)
  }

  // Fetch chart data
  const npmQuery = useQuery(
    npmQueryOptions({
      packageGroups: defaultPackageGroups,
      range,
    }),
  )

  return (
    <DocContainer>
      <div className="w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl">
        <div className="flex overflow-auto flex-col w-full p-4 lg:p-6">
          <DocTitle>NPM Stats for {library.name}</DocTitle>
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-6" />

          <div className="max-w-4xl">
            <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">
              View download statistics for {library.name} packages. Compare
              different time periods and track usage trends.
            </p>
          </div>

          <NpmStatsSummaryBar library={library} />

          <div className="mb-4">
            <p className="ext-gray-500 dark:text-gray-500 text-sm italic">
              *These top summary stats account for core packages, legacy package
              names, and all framework adapters.
            </p>
          </div>

          {/* Current Packages List */}
          {defaultPackageGroups.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Current Packages
              </h2>
              <div className="flex flex-wrap gap-2">
                {defaultPackageGroups.map((pkg, index) => {
                  const mainPackage = pkg.packages[0]
                  const color = getPackageColor(
                    mainPackage.name,
                    defaultPackageGroups,
                  )

                  return (
                    <div
                      key={mainPackage.name}
                      className="flex items-center gap-2 rounded-md text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      style={{
                        backgroundColor: `${color}20`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: color }}
                      />
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
                          <EyeOff className="w-3 h-3" />
                        ) : null}
                      </button>
                      <button
                        onClick={() => handleRemovePackage(index)}
                        className="ml-auto text-gray-500 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Framework Adapters Section */}
          {library.frameworks && library.frameworks.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Add Framework Adapters
              </h2>
              <div className="flex flex-wrap gap-2">
                {library.frameworks.map((framework) => {
                  const frameworkPackageName = getPackageName(
                    framework,
                    libraryId,
                    library,
                  )
                  const isAlreadyAdded = defaultPackageGroups.some((pg) =>
                    pg.packages.some(
                      (pkg) => pkg.name === frameworkPackageName,
                    ),
                  )

                  return (
                    <button
                      key={framework}
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          const newPackageGroups = [
                            ...defaultPackageGroups,
                            {
                              packages: [{ name: frameworkPackageName }],
                              // No color - let default color cycling work
                            },
                          ]
                          handlePackageGroupsChange(newPackageGroups)
                        }
                      }}
                      disabled={isAlreadyAdded}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                        isAlreadyAdded
                          ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/30'
                      }`}
                    >
                      {isAlreadyAdded ? '✓ ' : '+ '}
                      {framework === 'vanilla' ? 'Vanilla (Core)' : framework}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Competitors Section */}
          {library.competitors && library.competitors.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Compare with Similar Packages
              </h2>
              <div className="flex flex-wrap gap-2">
                {library.competitors.map((competitor) => {
                  const isAlreadyAdded = defaultPackageGroups.some((pg) =>
                    pg.packages.some((pkg) => pkg.name === competitor),
                  )

                  return (
                    <button
                      key={competitor}
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          const newPackageGroups = [
                            ...defaultPackageGroups,
                            {
                              packages: [{ name: competitor }],
                              // No color - let default color cycling work
                            },
                          ]
                          handlePackageGroupsChange(newPackageGroups)
                        }
                      }}
                      disabled={isAlreadyAdded}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isAlreadyAdded
                          ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:border-blue-500/30'
                      }`}
                    >
                      {isAlreadyAdded ? '✓ ' : '+ '}
                      {competitor}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Chart Controls */}
          <div className="mb-4 flex flex-wrap gap-4 items-center">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Time Range:
              </label>
              <select
                value={range}
                onChange={(e) => handleRangeChange(e.target.value as TimeRange)}
                className="bg-gray-500/10 rounded-md px-3 py-1.5 text-sm border border-gray-500/20"
              >
                {timeRanges.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Grouping:
              </label>
              <select
                value={binType}
                onChange={(e) => handleBinTypeChange(e.target.value as BinType)}
                className="bg-gray-500/10 rounded-md px-3 py-1.5 text-sm border border-gray-500/20"
              >
                {binningOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                View:
              </label>
              <select
                value={transform}
                onChange={(e) =>
                  handleTransformChange(e.target.value as TransformMode)
                }
                className="bg-gray-500/10 rounded-md px-3 py-1.5 text-sm border border-gray-500/20"
              >
                <option value="none">Actual Values</option>
                <option value="normalize-y">Relative Growth</option>
              </select>
            </div>
          </div>

          {/* Chart */}
          <div
            className="mb-6 bg-white dark:bg-gray-900 rounded-lg p-4"
            style={{ height: height + 50 }}
          >
            {npmQuery.isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <Spinner />
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Loading download statistics...
                  </div>
                </div>
              </div>
            ) : npmQuery.isError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-red-600 dark:text-red-400">
                  Failed to load chart data
                </div>
              </div>
            ) : (
              <NpmStatsChart
                queryData={npmQuery.data}
                binType={binType}
                packages={defaultPackageGroups}
                range={range}
                height={height}
                transform={transform}
              />
            )}
          </div>

          {/* Statistics Table */}
          {npmQuery.data && npmQuery.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full">
                <thead className="bg-gray-500/10">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Package Name
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Period Downloads
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Downloads last {binningOptionsByType[binType].single}
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
                      if (!firstPackage?.name) return null

                      const sortedDownloads = packageGroupDownloads.packages
                        .flatMap((p) => p.downloads)
                        .sort(
                          (a, b) =>
                            d3.utcDay(a.day).getTime() -
                            d3.utcDay(b.day).getTime(),
                        )

                      const binUnit = binningOptionsByType[binType].bin
                      const now = d3.utcDay(new Date())
                      const partialBinEnd = binUnit.floor(now)

                      const filteredDownloads = sortedDownloads.filter(
                        (d) => d3.utcDay(new Date(d.day)) < partialBinEnd,
                      )

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
                        defaultPackageGroups,
                      )

                      const lastBin =
                        binnedDownloads[binnedDownloads.length - 1]
                      const totalDownloads = d3.sum(
                        binnedDownloads,
                        (d) => d[1],
                      )

                      return (
                        <tr
                          key={firstPackage.name}
                          className="hover:bg-gray-500/5"
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {firstPackage.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                            {formatNumber(totalDownloads)}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-100">
                            {lastBin ? formatNumber(lastBin[1]) : '-'}
                          </td>
                        </tr>
                      )
                    })
                    .filter(Boolean)}
                </tbody>
              </table>
            </div>
          )}

          <div className="h-24" />
        </div>
      </div>
    </DocContainer>
  )
}
