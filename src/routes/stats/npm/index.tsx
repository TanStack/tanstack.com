import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { useThrottledCallback, useThrottler } from '@tanstack/react-pacer'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Question, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '~/components/Card'
import { Tooltip } from '~/components/Tooltip'
import { seo } from '~/utils/seo'
import { chartHeightSchema, chartWidthSchema } from '~/utils/schemas'
import {
  getPopularComparisons,
  getBaselinePresets,
  packageGroupsSchema,
  defaultPackageGroups,
  type BaselinePreset,
} from './-comparisons'
import { Spinner } from '~/components/Spinner'
import { BaselineSection } from '~/components/npm-stats/BaselineSection'
import { ChartControls } from '~/components/npm-stats/ChartControls'
import { ColorPickerPopover } from '~/components/npm-stats/ColorPickerPopover'
import { DisabledChartActions } from '~/components/npm-stats/DisabledChartActions'
import type { NpmStatsChartEmbedOptions } from '~/components/npm-stats/NPMStatsChart'
import { PackagePills } from '~/components/npm-stats/PackagePills'
import { PackageSearch } from '~/components/npm-stats/PackageSearch'
import { PopularComparisons } from '~/components/npm-stats/PopularComparisons'
import {
  Resizable,
  type ResizableSizeChange,
  type ResizeChangeOptions,
} from '~/components/npm-stats/Resizable'
import { StatsTable } from '~/components/npm-stats/StatsTable'
import { LatestBucketNavigator } from '~/components/npm-stats/LatestBucketNavigator'
import {
  npmQueryOptions,
  selectLatestBucketQueryData,
} from '~/components/npm-stats/npmQueryOptions'
import { getLatestBucketOffsetBounds } from '~/components/npm-stats/binning'
import {
  defaultRangeBinTypes,
  getPackageGroupLabel,
  getPackageColor,
  getDefaultChartTypeForViewMode,
  isChartTypeValidForViewMode,
  defaultPlaybackIntervalMs,
  playbackIntervalMsSchema,
  chartTypeSchema,
  barOrientationSchema,
  latestBarSortSchema,
  viewModeSchema,
  type BarOrientation,
  type BinType,
  type ChartType,
  type LatestBarSort,
  type PackageGroup,
  type ShowDataMode,
  type TimeRange,
  type TransformMode,
  type ViewMode,
} from '~/components/npm-stats/shared'

const LazyNPMStatsChart = React.lazy(() =>
  import('~/components/npm-stats/NPMStatsChart').then((m) => ({
    default: m.NPMStatsChart,
  })),
)

function ChartFallback({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded bg-gray-100 dark:bg-gray-800/40"
      style={{ height }}
    />
  )
}

const transformModeSchema = v.picklist(['none', 'normalize-y'])
const binTypeSchema = v.picklist(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = v.picklist(['all', 'complete'])
const bucketOffsetSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(-5000),
  v.maxValue(0),
)
const timelineZoomTimeSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
export const Route = createFileRoute('/stats/npm/')({
  validateSearch: v.object({
    packageGroups: v.fallback(
      v.optional(packageGroupsSchema, defaultPackageGroups),
      defaultPackageGroups,
    ),
    range: v.fallback(
      v.optional(
        v.picklist([
          '7-days',
          '30-days',
          '90-days',
          '180-days',
          '365-days',
          '730-days',
          '1825-days',
          'all-time',
        ]),
        '1825-days',
      ),
      '1825-days',
    ),
    transform: v.fallback(v.optional(transformModeSchema, 'none'), 'none'),
    binType: v.fallback(v.optional(binTypeSchema, 'weekly'), 'weekly'),
    viewMode: v.fallback(v.optional(viewModeSchema, 'history'), 'history'),
    chartType: v.fallback(v.optional(chartTypeSchema, 'line'), 'line'),
    barOrientation: v.fallback(v.optional(barOrientationSchema), undefined),
    barSort: v.fallback(v.optional(latestBarSortSchema, 'value'), 'value'),
    bucketOffset: v.fallback(v.optional(bucketOffsetSchema, 0), 0),
    playbackIntervalMs: v.fallback(
      v.optional(playbackIntervalMsSchema, defaultPlaybackIntervalMs),
      defaultPlaybackIntervalMs,
    ),
    playbackLoop: v.fallback(v.optional(v.boolean(), false), false),
    playbackPlaying: v.fallback(v.optional(v.boolean(), false), false),
    showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
    normalizeBaseline: v.fallback(v.optional(v.boolean(), true), true),
    showBaseline: v.fallback(v.optional(v.boolean(), false), false),
    showLegend: v.fallback(v.optional(v.boolean(), false), false),
    height: v.fallback(v.optional(chartHeightSchema, 400), 400),
    width: v.fallback(v.optional(chartWidthSchema), undefined),
    timelineStart: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
    timelineEnd: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
  }),
  loaderDeps: ({ search }) => ({
    packageList: search.packageGroups?.map(getPackageGroupLabel).join(' vs '),
    packageNames: search.packageGroups?.map(getPackageGroupLabel) ?? [],
  }),
  loader: async ({ deps }) => {
    return deps
  },
  head: ({ loaderData }) => {
    const packageList = loaderData?.packageList ?? ''
    const packageNames = loaderData?.packageNames ?? []
    const hasPackages = packageNames.length > 0

    // Create SEO-optimized title - lead with the comparison for better CTR
    const title = hasPackages
      ? `${packageList} - NPM Download Stats & Trends | Compare Packages`
      : 'NPM Download Stats & Trends - Compare Package Popularity | TanStack'

    // Dynamic description based on packages being compared
    const description = hasPackages
      ? `Compare ${packageList} npm downloads side-by-side. View download trends, weekly stats, and historical data. Free npm package comparison tool - faster than npmtrends.`
      : 'Compare npm package downloads with interactive charts. Track download trends, analyze package popularity, and make informed decisions. Free alternative to npmtrends and npm-stat.'

    // Keywords for better discoverability
    const keywords = hasPackages
      ? `${packageNames.join(', ')}, npm downloads, npm stats, package comparison, npm trends, download statistics`
      : 'npm downloads, npm statistics, npm trends, compare npm packages, package popularity, npm download stats, javascript packages'

    // JSON-LD structured data for better search appearance
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TanStack NPM Stats',
      description:
        'Compare npm package downloads with interactive charts and historical data',
      url: 'https://tanstack.com/stats/npm',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      creator: {
        '@type': 'Organization',
        name: 'TanStack',
        url: 'https://tanstack.com',
      },
    }

    // FAQ structured data for rich results
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How are npm download statistics calculated?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'NPM download statistics are sourced from the official npm registry API. Downloads are counted each time a package is installed via npm, yarn, or pnpm. These numbers include downloads from CI/CD pipelines, development machines, and production deployments.',
          },
        },
        {
          '@type': 'Question',
          name: "What's the difference between weekly and daily downloads?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Daily downloads show the exact number of downloads per day, useful for spotting short-term trends. Weekly downloads aggregate 7 days of data, smoothing out variations and making it easier to identify long-term growth patterns.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does TanStack NPM Stats compare to npmtrends?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'TanStack NPM Stats offers faster load times with cached data, flexible time ranges up to all-time history, advanced features like baseline comparisons and relative growth charts, plus the ability to combine multiple packages into a single trend line.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I compare any npm package?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! You can compare any public package on the npm registry. Search for packages by name and add them to your comparison. You can compare multiple packages simultaneously and group related packages together for accurate historical tracking.',
          },
        },
      ],
    }

    return {
      meta: seo({
        title,
        description,
        keywords,
      }),
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify(jsonLd),
        },
        {
          type: 'application/ld+json',
          children: JSON.stringify(faqJsonLd),
        },
      ],
    }
  },
  component: RouteComponent,
  staticData: {
    includeSearchInCanonical: true,
    Title: () => {
      return (
        <Link
          to="."
          className="hover:text-blue-500 flex items-center gap-2 text-gray-500"
        >
          NPM Stats
        </Link>
      )
    },
  },
})

type _NpmStatsSearch = {
  packageGroups?: Array<{
    name?: string
    label?: string
    hidden?: boolean
    color?: string
    baseline?: boolean
    baselineLabel?: string
    packages: Array<{ name?: string; hidden?: boolean }>
  }>
  range?: TimeRange
  transform?: 'none' | 'normalize-y'
  binType?: BinType
  viewMode?: ViewMode
  chartType?: ChartType
  barOrientation?: BarOrientation
  barSort?: LatestBarSort
  bucketOffset?: number
  playbackIntervalMs?: number
  playbackLoop?: boolean
  playbackPlaying?: boolean
  showDataMode?: 'all' | 'complete'
  showLegend?: boolean
  height?: number
  width?: number
  timelineStart?: number
  timelineEnd?: number
}

function RouteComponent() {
  const search = Route.useSearch()
  const packageGroups: PackageGroup[] =
    search.packageGroups ?? defaultPackageGroups
  const range: TimeRange = search.range ?? '1825-days'
  const transform: TransformMode = search.transform ?? 'none'
  const binTypeParam: BinType | undefined = search.binType
  const viewMode: ViewMode = search.viewMode ?? 'history'
  const chartTypeParam: ChartType = search.chartType ?? 'line'
  const barOrientationParam: BarOrientation =
    search.barOrientation ??
    (chartTypeParam === 'horizontal-bar' ? 'horizontal' : 'vertical')
  const barSort: LatestBarSort = search.barSort ?? 'value'
  const showDataModeParam: ShowDataMode = search.showDataMode ?? 'all'
  const normalizeBaseline: boolean = search.normalizeBaseline ?? true
  const showBaseline: boolean = search.showBaseline ?? false
  const showLegend: boolean = search.showLegend ?? false
  const bucketOffsetParam: number = search.bucketOffset ?? 0
  const playbackIntervalMs: number =
    search.playbackIntervalMs ?? defaultPlaybackIntervalMs
  const playbackLoop: boolean = search.playbackLoop ?? false
  const playbackPlaying: boolean = search.playbackPlaying ?? false
  const height: number = search.height ?? 400
  const width: number | undefined = search.width
  const timelineStart: number | undefined = search.timelineStart
  const timelineEnd: number | undefined = search.timelineEnd
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
  const [chartActionsContainer, setChartActionsContainer] =
    React.useState<HTMLDivElement | null>(null)
  const [chartActionsMounted, setChartActionsMounted] = React.useState(false)

  const binType: BinType = binTypeParam ?? defaultRangeBinTypes[range]
  const chartType = isChartTypeValidForViewMode(viewMode, chartTypeParam)
    ? chartTypeParam
    : getDefaultChartTypeForViewMode(viewMode)
  const barOrientation: BarOrientation =
    viewMode === 'latest' &&
    (chartType === 'bar' || chartType === 'stacked-bar')
      ? barOrientationParam
      : 'vertical'
  const latestBucketBounds = getLatestBucketOffsetBounds({ binType, range })
  const bucketOffset = Math.max(
    latestBucketBounds.minOffset,
    Math.min(bucketOffsetParam, latestBucketBounds.maxOffset),
  )
  const queryPackageGroupEntries = packageGroups
    .map((packageGroup, index) => ({ packageGroup, index }))
    .filter(
      ({ packageGroup }) => viewMode === 'history' || !packageGroup.baseline,
    )
  const queryPackageGroups = queryPackageGroupEntries.map(
    ({ packageGroup }) => packageGroup,
  )
  const queryPackageGroupIndexes = queryPackageGroupEntries.map(
    ({ index }) => index,
  )
  const tableTransform: TransformMode =
    viewMode === 'history' && chartType === 'line' ? transform : 'none'
  const canToggleShowBaseline = viewMode === 'history' && chartType === 'line'

  const handleBinnedChange = (value: BinType) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binType: value,
        bucketOffset: 0,
        playbackPlaying: false,
        timelineStart: undefined,
        timelineEnd: undefined,
      }),
      resetScroll: false,
    })
  }

  const handleViewModeChange = (mode: ViewMode) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        viewMode: mode,
        chartType: isChartTypeValidForViewMode(mode, chartType)
          ? chartType
          : getDefaultChartTypeForViewMode(mode),
        transform: mode === 'latest' ? 'none' : prev.transform,
        barOrientation,
        showBaseline: mode === 'latest' ? false : prev.showBaseline,
        playbackPlaying: mode === 'latest' ? prev.playbackPlaying : false,
        bucketOffset: 0,
        timelineStart: undefined,
        timelineEnd: undefined,
      }),
      resetScroll: false,
    })
  }

  const handleChartTypeChange = (nextChartType: ChartType) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        chartType: nextChartType,
        barOrientation,
        transform: nextChartType === 'line' ? prev.transform : 'none',
      }),
      resetScroll: false,
    })
  }

  const handleBarSortChange = (nextBarSort: LatestBarSort) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        barSort: nextBarSort,
      }),
      resetScroll: false,
    })
  }

  const handleBarOrientationChange = (nextBarOrientation: BarOrientation) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        barOrientation: nextBarOrientation,
      }),
      resetScroll: false,
    })
  }

  const handleBucketOffsetChange = (nextBucketOffset: number) => {
    const nextOffset = Math.max(
      latestBucketBounds.minOffset,
      Math.min(nextBucketOffset, latestBucketBounds.maxOffset),
    )

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        bucketOffset: nextOffset,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handlePlaybackIntervalChange = (nextPlaybackIntervalMs: number) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        playbackIntervalMs: nextPlaybackIntervalMs,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handlePlaybackLoopChange = (nextPlaybackLoop: boolean) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        playbackLoop: nextPlaybackLoop,
      }),
      resetScroll: false,
    })
  }

  const handlePlaybackPlayingChange = (nextPlaybackPlaying: boolean) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        playbackPlaying: nextPlaybackPlaying,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handleAddBaseline = (packageName: string, color?: string) => {
    navigate({
      to: '.',
      search: (prev) => {
        const groups = prev.packageGroups ?? []
        const alreadyBaseline = groups.some(
          (pg) =>
            pg.baseline && pg.packages.some((p) => p.name === packageName),
        )
        if (alreadyBaseline) return prev
        return {
          ...prev,
          packageGroups: [
            ...groups,
            {
              packages: [{ name: packageName, hidden: true }],
              color,
              baseline: true,
            },
          ],
        }
      },
      resetScroll: false,
    })
  }

  const handleApplyBaselinePreset = (preset: BaselinePreset) => {
    navigate({
      to: '.',
      search: (prev) => {
        const nonBaseline = (prev.packageGroups ?? []).filter(
          (pg) => !pg.baseline,
        )
        return {
          ...prev,
          bucketOffset: 0,
          playbackPlaying: false,
          packageGroups: [
            ...nonBaseline,
            ...preset.packages.map((p) => ({
              packages: [{ name: p.name, hidden: true }],
              color: p.color,
              baseline: true,
              baselineLabel: preset.title,
            })),
          ],
        }
      },
      resetScroll: false,
    })
  }

  const handleClearBaselines = () => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: prev.packageGroups?.filter((pg) => !pg.baseline),
        showBaseline: false,
      }),
      resetScroll: false,
    })
  }

  const handleToggleShowBaseline = () => {
    if (!canToggleShowBaseline) return

    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        showBaseline: !prev.showBaseline,
      }),
      resetScroll: false,
    })
  }

  const handleToggleNormalizeBaseline = () => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        normalizeBaseline: !(prev.normalizeBaseline ?? true),
      }),
      resetScroll: false,
    })
  }

  const handleShowLegendChange = (nextShowLegend: boolean) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        showLegend: nextShowLegend,
      }),
      replace: true,
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
        packageGroups: prev.packageGroups?.map((pkg, i) =>
          i === index
            ? pkg.label === packageName
              ? { ...pkg, hidden: !pkg.hidden }
              : {
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
      packageGroups: queryPackageGroups,
      range,
      viewMode,
      binType,
      bucketOffset,
    }),
  )
  const displayQueryData = React.useMemo(
    () =>
      viewMode === 'latest'
        ? selectLatestBucketQueryData({
            queryData: npmQuery.data,
            binType,
            bucketOffset,
          })
        : npmQuery.data,
    [binType, bucketOffset, npmQuery.data, viewMode],
  )
  const packagePillQueryData = (() => {
    if (viewMode === 'history') return npmQuery.data

    let queryIndex = 0
    return packageGroups.map((packageGroup) => {
      if (packageGroup.baseline) return undefined

      const queryData = npmQuery.data?.[queryIndex]
      queryIndex++
      return queryData
    })
  })()

  const handleRemoveFromGroup = (mainPackage: string, subPackage: string) => {
    // Find the package group
    const packageGroup = packageGroups?.find((pkg) =>
      pkg.packages.some((p) => p.name === mainPackage),
    )
    if (!packageGroup) return

    // Remove the subpackage
    const updatedPackages = packageGroup.packages.filter(
      (p) => p.name !== subPackage,
    )

    // Update the packages array
    const newPackages = (packageGroups ?? [])
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
        packageGroups: prev.packageGroups?.filter(
          (_: unknown, i: number) => i !== packageGroupIndex,
        ),
      }),
      resetScroll: false,
    })
  }

  const handleLabelChange = (packageGroupIndex: number, label: string) => {
    navigate({
      to: '.',
      search: (prev) => {
        const nextLabel = label.slice(0, 80)
        const hasNextLabel = nextLabel.trim().length > 0
        const groups = prev.packageGroups ?? packageGroups

        return {
          ...prev,
          packageGroups: groups.map((pkg, i) => {
            if (i !== packageGroupIndex) return pkg

            const nextPackageGroup = { ...pkg }
            if (hasNextLabel) {
              nextPackageGroup.label = nextLabel
            } else {
              delete nextPackageGroup.label
              delete nextPackageGroup.hidden
            }

            return nextPackageGroup
          }),
        }
      },
      replace: true,
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
        bucketOffset: 0,
        playbackPlaying: false,
        timelineStart: undefined,
        timelineEnd: undefined,
      }),
      resetScroll: false,
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
          const packageGroup = packageGroups.find(
            (pkg) =>
              pkg.label === packageName ||
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

  const navigateChartSize = React.useCallback(
    (size: ResizableSizeChange, replace: boolean) => {
      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          ...('height' in size ? { height: size.height } : {}),
          ...('width' in size ? { width: size.width } : {}),
        }),
        replace,
        resetScroll: false,
      })
    },
    [navigate],
  )

  const chartSizeThrottler = useThrottler(
    (size: ResizableSizeChange) => navigateChartSize(size, true),
    {
      wait: 16,
    },
  )

  const onSizeChange = React.useCallback(
    (size: ResizableSizeChange, options: ResizeChangeOptions) => {
      if (options.replace) {
        chartSizeThrottler.maybeExecute(size)
        return
      }

      chartSizeThrottler.cancel()
      if (!('height' in size) && !('width' in size)) return

      navigateChartSize(size, false)
    },
    [chartSizeThrottler, navigateChartSize],
  )

  const handleTimelineRangeChange = React.useCallback(
    (nextRange: { end: number | undefined; start: number | undefined }) => {
      navigate({
        to: '.',
        search: (prev) => ({
          ...prev,
          timelineStart: nextRange.start,
          timelineEnd: nextRange.end,
        }),
        replace: true,
        resetScroll: false,
      })
    },
    [navigate],
  )

  const buildEmbedUrl = React.useCallback(
    (options: NpmStatsChartEmbedOptions) => {
      const params = new URLSearchParams()

      params.set('packageGroups', JSON.stringify(packageGroups))
      params.set('range', range)
      params.set('transform', transform)
      params.set('binType', binType)
      params.set('viewMode', viewMode)
      params.set('chartType', chartType)
      params.set('barOrientation', barOrientation)
      params.set('barSort', barSort)
      params.set('bucketOffset', `${bucketOffset}`)
      params.set('playbackIntervalMs', `${playbackIntervalMs}`)
      params.set('showDataMode', showDataModeParam)
      params.set('normalizeBaseline', `${normalizeBaseline}`)
      params.set('showBaseline', `${viewMode === 'history'}`)
      params.set('showLegend', `${options.showLegend}`)

      if (
        options.includeTimelineRange &&
        timelineStart !== undefined &&
        timelineEnd !== undefined
      ) {
        params.set('timelineStart', `${timelineStart}`)
        params.set('timelineEnd', `${timelineEnd}`)
      }

      if (options.lockWidth && width !== undefined) {
        params.set('width', `${width}`)
      }

      return `/stats/npm/embed?${params}`
    },
    [
      barOrientation,
      barSort,
      binType,
      bucketOffset,
      chartType,
      normalizeBaseline,
      packageGroups,
      playbackIntervalMs,
      range,
      showDataModeParam,
      timelineEnd,
      timelineStart,
      transform,
      viewMode,
      width,
    ],
  )

  const embedConfig = React.useMemo(
    () => ({
      buildUrl: buildEmbedUrl,
      hasTimelineRange:
        timelineStart !== undefined && timelineEnd !== undefined,
      hasWidth: width !== undefined,
    }),
    [buildEmbedUrl, timelineEnd, timelineStart, width],
  )

  const handleMenuOpenChange = (packageName: string, open: boolean) => {
    if (!open) {
      setOpenMenuPackage(null)
    } else {
      setOpenMenuPackage(packageName)
    }
  }

  const handleAddPackage = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        packageGroups: [
          ...(prev.packageGroups ?? []),
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

  // Generate dynamic H1 based on packages being compared
  const packageListForH1 = packageGroups.map(getPackageGroupLabel).join(' vs ')

  return (
    <div className="min-h-dvh p-2 sm:p-4 space-y-2 sm:space-y-4">
      <header className="sr-only">
        <h1>
          NPM Download Comparison
          {packageGroups.length > 0 ? `: ${packageListForH1}` : ''}
        </h1>
        <p>
          Compare npm package downloads with interactive charts. Track trends
          and make data-driven decisions.
        </p>
      </header>

      <div className="flex gap-4">
        <Card className="flex-1 space-y-4 p-4 max-w-full">
          <div className="flex flex-wrap items-center gap-1">
            <PackageSearch onSelect={handleAddPackage} />
            <ChartControls
              viewMode={viewMode}
              chartType={chartType}
              range={range}
              binType={binType}
              transform={transform}
              showDataMode={showDataModeParam}
              barSort={barSort}
              barOrientation={barOrientation}
              onViewModeChange={handleViewModeChange}
              onChartTypeChange={handleChartTypeChange}
              onRangeChange={handleRangeChange}
              onBinTypeChange={handleBinnedChange}
              onTransformChange={handleTransformChange}
              onShowDataModeChange={handleShowDataModeChange}
              onBarSortChange={handleBarSortChange}
              onBarOrientationChange={handleBarOrientationChange}
            />
            <Tooltip
              content="Compare npm package downloads with interactive charts. Track trends and make data-driven decisions."
              placement="bottom"
            >
              <button
                aria-label="About NPM download comparison"
                className="flex size-6 items-center justify-center rounded bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 hover:text-blue-500"
                type="button"
              >
                <Question className="size-3" />
              </button>
            </Tooltip>
          </div>
          <PackagePills
            packageGroups={packageGroups}
            queryData={packagePillQueryData}
            onColorClick={handleColorClick}
            onToggleVisibility={togglePackageVisibility}
            onRemove={handleRemovePackageName}
            onCombinePackage={handleCombinePackage}
            onLabelChange={handleLabelChange}
            onRemoveFromGroup={handleRemoveFromGroup}
            openMenuPackage={openMenuPackage}
            onMenuOpenChange={handleMenuOpenChange}
          />

          <div
            className={
              viewMode === 'history'
                ? 'flex flex-wrap items-center justify-between gap-2'
                : 'flex flex-wrap items-center gap-2'
            }
          >
            {viewMode === 'history' ? (
              <div className="min-w-0 flex-1">
                <BaselineSection
                  packageGroups={packageGroups}
                  presets={getBaselinePresets()}
                  canToggleShowBaseline={canToggleShowBaseline}
                  normalizeBaseline={normalizeBaseline}
                  showBaseline={showBaseline}
                  onToggleNormalizeBaseline={handleToggleNormalizeBaseline}
                  onToggleShowBaseline={handleToggleShowBaseline}
                  onAddBaseline={handleAddBaseline}
                  onApplyPreset={handleApplyBaselinePreset}
                  onClearBaselines={handleClearBaselines}
                />
              </div>
            ) : (
              <LatestBucketNavigator
                binType={binType}
                range={range}
                bucketOffset={bucketOffset}
                isLooping={playbackLoop}
                isPlaying={playbackPlaying}
                playbackIntervalMs={playbackIntervalMs}
                onBucketOffsetChange={handleBucketOffsetChange}
                onLoopingChange={handlePlaybackLoopChange}
                onPlaybackIntervalChange={handlePlaybackIntervalChange}
                onPlayingChange={handlePlaybackPlayingChange}
              />
            )}
            <div
              className="ml-auto flex min-h-6 items-center justify-end"
              ref={setChartActionsContainer}
            >
              {chartActionsMounted ? null : <DisabledChartActions />}
            </div>
          </div>

          {/* Combine Package Dialog */}
          <DialogPrimitive.Root
            open={combiningPackage !== null}
            onOpenChange={(open) => {
              if (!open) setCombiningPackage(null)
            }}
          >
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm" />
              <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1000] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-xl outline-none">
                <div className="flex justify-between items-center mb-4">
                  <DialogPrimitive.Title className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">
                    Add packages to {combiningPackage}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </DialogPrimitive.Close>
                </div>
                <DialogPrimitive.Description className="sr-only">
                  Search for additional npm packages to combine with{' '}
                  {combiningPackage}.
                </DialogPrimitive.Description>
                {combiningPackage && (
                  <PackageSearch
                    onSelect={handleAddToGroup}
                    placeholder="Search for packages to add..."
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={true}
                  />
                )}
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          {/* Color Picker Popover */}
          {colorPickerPackage && colorPickerPosition && (
            <ColorPickerPopover
              packageName={colorPickerPackage}
              position={colorPickerPosition}
              currentColor={getPackageColor(colorPickerPackage, packageGroups)}
              onColorChange={handleColorChange}
              onReset={(pkgName) => handleColorChange(pkgName, null)}
              onClose={() => {
                setColorPickerPackage(null)
                setColorPickerPosition(null)
              }}
            />
          )}

          {queryPackageGroups.length ? (
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
                    width={width}
                    onSizeChange={onSizeChange}
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
                      <React.Suspense
                        fallback={<ChartFallback height={height} />}
                      >
                        <LazyNPMStatsChart
                          actionsContainer={chartActionsContainer}
                          embedConfig={embedConfig}
                          onActionsMountedChange={setChartActionsMounted}
                          range={range}
                          queryData={displayQueryData}
                          height={height}
                          viewMode={viewMode}
                          chartType={chartType}
                          barSort={barSort}
                          barOrientation={barOrientation}
                          transform={transform}
                          binType={binType}
                          packages={queryPackageGroups}
                          showDataMode={showDataModeParam}
                          normalizeBaseline={
                            viewMode === 'history' && normalizeBaseline
                          }
                          showBaseline={viewMode === 'history' && showBaseline}
                          showLegend={showLegend}
                          timelineStart={timelineStart}
                          timelineEnd={timelineEnd}
                          animationQueryData={npmQuery.data}
                          animationBucketOffsetBounds={latestBucketBounds}
                          animationFrameIntervalMs={playbackIntervalMs}
                          onShowLegendChange={handleShowLegendChange}
                          onTimelineRangeChange={handleTimelineRangeChange}
                        />
                      </React.Suspense>
                    )}
                  </Resizable>
                </div>
                <StatsTable
                  queryData={displayQueryData}
                  packageGroups={queryPackageGroups}
                  packageGroupIndexes={queryPackageGroupIndexes}
                  binType={binType}
                  transform={tableTransform}
                  viewMode={viewMode}
                  onColorClick={handleColorClick}
                  onToggleVisibility={togglePackageVisibility}
                  onRemove={handleRemovePackageName}
                />
              </div>
            </div>
          ) : null}

          {/* Popular Comparisons Section */}
          <PopularComparisons comparisons={getPopularComparisons()} />
        </Card>
      </div>

      {/* FAQ Section for SEO */}
      <section className="max-w-4xl mt-8 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <details className="group bg-gray-500/5 rounded-lg p-4">
            <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
              How are npm download statistics calculated?
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              NPM download statistics are sourced from the official npm registry
              API. Downloads are counted each time a package is installed via
              npm, yarn, or pnpm. These numbers include downloads from CI/CD
              pipelines, development machines, and production deployments.
            </p>
          </details>

          <details className="group bg-gray-500/5 rounded-lg p-4">
            <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
              What's the difference between weekly and daily downloads?
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Daily downloads show the exact number of downloads per day, useful
              for spotting short-term trends and anomalies. Weekly downloads
              aggregate 7 days of data, smoothing out day-to-day variations and
              making it easier to identify long-term growth patterns.
            </p>
          </details>

          <details className="group bg-gray-500/5 rounded-lg p-4">
            <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
              How does TanStack NPM Stats compare to npmtrends?
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              TanStack NPM Stats offers faster load times with cached data,
              flexible time ranges up to all-time history, advanced features
              like baseline comparisons and relative growth charts, plus the
              ability to combine multiple packages into a single trend line for
              tracking package migrations (e.g., react-query to
              @tanstack/react-query).
            </p>
          </details>

          <details className="group bg-gray-500/5 rounded-lg p-4">
            <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
              Why do some packages show zero downloads before a certain date?
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              NPM download statistics are only available from January 10, 2015
              onwards. Additionally, packages will show zero downloads before
              their initial publish date. Some packages may also be renamed or
              scoped (e.g., react-query became @tanstack/react-query), so
              historical data may appear under different package names.
            </p>
          </details>

          <details className="group bg-gray-500/5 rounded-lg p-4">
            <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
              Can I compare any npm package?
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Yes! You can compare any public package on the npm registry.
              Simply search for packages by name and add them to your
              comparison. You can compare multiple packages simultaneously and
              even group related packages together (like combining legacy and
              new package names) for accurate historical tracking.
            </p>
          </details>
        </div>
      </section>
    </div>
  )
}
