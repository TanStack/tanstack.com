import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import * as v from 'valibot'

import { Spinner } from '~/components/Spinner'
import {
  npmQueryOptions,
  selectLatestBucketQueryData,
} from '~/components/npm-stats/npmQueryOptions'
import { getLatestBucketOffsetBounds } from '~/components/npm-stats/binning'
import {
  barOrientationSchema,
  chartTypeSchema,
  defaultPlaybackIntervalMs,
  defaultRangeBinTypes,
  getDefaultChartTypeForViewMode,
  isChartTypeValidForViewMode,
  latestBarSortSchema,
  playbackIntervalMsSchema,
  type BarOrientation,
  type BinType,
  type ChartType,
  type LatestBarSort,
  type PackageGroup,
  type ShowDataMode,
  type TimeRange,
  type TransformMode,
  type ViewMode,
  viewModeSchema,
} from '~/components/npm-stats/shared'
import { chartWidthSchema } from '~/utils/schemas'
import { seo } from '~/utils/seo'
import { defaultPackageGroups, packageGroupsSchema } from './-comparisons'

const LazyNPMStatsChart = React.lazy(() =>
  import('~/components/npm-stats/NPMStatsChart').then((m) => ({
    default: m.NPMStatsChart,
  })),
)

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

export const Route = createFileRoute('/stats/npm/embed')({
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
    showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
    normalizeBaseline: v.fallback(v.optional(v.boolean(), true), true),
    showBaseline: v.fallback(v.optional(v.boolean(), true), true),
    showLegend: v.fallback(v.optional(v.boolean(), false), false),
    width: v.fallback(v.optional(chartWidthSchema), undefined),
    timelineStart: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
    timelineEnd: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
  }),
  head: () => ({
    meta: seo({
      title: 'TanStack NPM Stats Chart Embed',
      description: 'Embeddable npm download statistics chart from TanStack.',
      noindex: true,
    }),
  }),
  component: NpmStatsEmbed,
  staticData: {
    baseParent: true,
    includeSearchInCanonical: true,
    showNavbar: false,
  },
})

type NpmStatsEmbedSearch = {
  packageGroups?: PackageGroup[]
  range?: TimeRange
  transform?: TransformMode
  binType?: BinType
  viewMode?: ViewMode
  chartType?: ChartType
  barOrientation?: BarOrientation
  barSort?: LatestBarSort
  bucketOffset?: number
  playbackIntervalMs?: number
  showDataMode?: ShowDataMode
  normalizeBaseline?: boolean
  showBaseline?: boolean
  showLegend?: boolean
  width?: number
  timelineStart?: number
  timelineEnd?: number
}

function useElementHeight() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState(0)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const setMeasuredHeight = (nextHeight: number) => {
      setHeight((previousHeight) =>
        previousHeight === nextHeight ? previousHeight : nextHeight,
      )
    }

    const updateHeight = () => {
      setMeasuredHeight(Math.round(container.getBoundingClientRect().height))
    }

    updateHeight()

    const ownerWindow = container.ownerDocument.defaultView
    if (!ownerWindow?.ResizeObserver) {
      ownerWindow?.addEventListener('resize', updateHeight)
      return () => {
        ownerWindow?.removeEventListener('resize', updateHeight)
      }
    }

    const resizeObserver = new ownerWindow.ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      setMeasuredHeight(Math.round(entry.contentRect.height))
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return { containerRef, height }
}

function ChartFallback({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded bg-gray-100 dark:bg-gray-900"
      style={{ height }}
    />
  )
}

function NpmStatsEmbed() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { containerRef, height: measuredHeight } = useElementHeight()

  const packageGroups: PackageGroup[] = search.packageGroups ?? []
  const range: TimeRange = search.range ?? '1825-days'
  const transform: TransformMode = search.transform ?? 'none'
  const binTypeParam: BinType | undefined = search.binType
  const viewMode: ViewMode = search.viewMode ?? 'history'
  const chartTypeParam: ChartType = search.chartType ?? 'line'
  const barOrientationParam: BarOrientation =
    search.barOrientation ??
    (chartTypeParam === 'horizontal-bar' ? 'horizontal' : 'vertical')
  const barSort: LatestBarSort = search.barSort ?? 'value'
  const showDataMode: ShowDataMode = search.showDataMode ?? 'all'
  const normalizeBaseline: boolean = search.normalizeBaseline ?? true
  const showBaseline: boolean = search.showBaseline ?? true
  const showLegend: boolean = search.showLegend ?? false
  const bucketOffsetParam: number = search.bucketOffset ?? 0
  const playbackIntervalMs: number =
    search.playbackIntervalMs ?? defaultPlaybackIntervalMs
  const timelineStart: number | undefined = search.timelineStart
  const timelineEnd: number | undefined = search.timelineEnd
  const width: number | undefined = search.width

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
  const queryPackageGroups = packageGroups.filter(
    (packageGroup) => viewMode === 'history' || !packageGroup.baseline,
  )

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

  const handleTimelineRangeChange = React.useCallback(
    (nextRange: { end: number | undefined; start: number | undefined }) => {
      navigate({
        to: '.',
        search: (prev: NpmStatsEmbedSearch) => ({
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

  const chartHeight = measuredHeight || 400
  const chartWidthStyle = width
    ? {
        maxWidth: '100%',
        width,
      }
    : undefined

  return (
    <div className="relative flex h-dvh w-screen overflow-hidden bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50">
      <style
        dangerouslySetInnerHTML={{
          __html: `
html, body {
  background: transparent !important;
  height: 100%;
  margin: 0 !important;
  overflow: hidden;
  width: 100%;
}
`,
        }}
      />
      <div
        className={
          width
            ? 'min-h-0 min-w-0 flex-1'
            : 'min-h-0 min-w-0 flex-1 self-stretch'
        }
        ref={containerRef}
        style={chartWidthStyle}
      >
        {queryPackageGroups.length ? (
          npmQuery.isLoading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: chartHeight }}
            >
              <div className="flex flex-col items-center gap-3">
                <Spinner />
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Loading download statistics...
                </div>
              </div>
            </div>
          ) : (
            <React.Suspense fallback={<ChartFallback height={chartHeight} />}>
              <LazyNPMStatsChart
                range={range}
                queryData={displayQueryData}
                height={chartHeight}
                viewMode={viewMode}
                chartType={chartType}
                barSort={barSort}
                barOrientation={barOrientation}
                transform={transform}
                binType={binType}
                packages={queryPackageGroups}
                showDataMode={showDataMode}
                normalizeBaseline={viewMode === 'history' && normalizeBaseline}
                showBaseline={viewMode === 'history' && showBaseline}
                showLegend={showLegend}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                animationQueryData={npmQuery.data}
                animationBucketOffsetBounds={latestBucketBounds}
                animationFrameIntervalMs={playbackIntervalMs}
                onTimelineRangeChange={handleTimelineRangeChange}
              />
            </React.Suspense>
          )
        ) : null}
      </div>
      <a
        className="absolute top-1 right-1 z-10 rounded bg-white/75 px-1.5 py-0.5 text-[9px] leading-none font-medium text-gray-500 ring-1 ring-gray-200/80 backdrop-blur hover:text-gray-950 dark:bg-gray-950/75 dark:text-gray-500 dark:ring-gray-800/80 dark:hover:text-gray-50"
        href="/stats/npm"
        rel="noreferrer"
        target="_blank"
      >
        Powered by TanStack NPM Stats
      </a>
    </div>
  )
}
