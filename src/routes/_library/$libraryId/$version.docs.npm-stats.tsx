import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { useThrottledCallback, useThrottler } from '@tanstack/react-pacer'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'

import { getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import { Tooltip } from '~/components/Tooltip'
import { Spinner } from '~/components/Spinner'
import { BaselineSection } from '~/components/npm-stats/BaselineSection'
import { ChartControls } from '~/components/npm-stats/ChartControls'
import { ColorPickerPopover } from '~/components/npm-stats/ColorPickerPopover'
import { DisabledChartActions } from '~/components/npm-stats/DisabledChartActions'
import { NPMSummary } from '~/components/npm-stats/NPMSummary'
import { PackagePills } from '~/components/npm-stats/PackagePills'
import { PackageSearch } from '~/components/npm-stats/PackageSearch'
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
  barOrientationSchema,
  chartTypeSchema,
  defaultRangeBinTypes,
  defaultPlaybackIntervalMs,
  getDefaultChartTypeForViewMode,
  getPackageColor,
  isChartTypeValidForViewMode,
  latestBarSortSchema,
  playbackIntervalMsSchema,
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
import {
  getLibraryNpmPackages,
  getAvailableFrameworkAdapters,
  getAvailableCompetitors,
  frameworkMeta,
  defaultColors,
} from '~/utils/npm-packages'
import {
  getBaselinePresets,
  packageGroupsSchema,
  type BaselinePreset,
} from '~/routes/stats/npm/-comparisons'
import { chartHeightSchema, chartWidthSchema } from '~/utils/schemas'

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

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/npm-stats',
)({
  validateSearch: v.object({
    packageGroups: v.fallback(v.optional(packageGroupsSchema), undefined),
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
        '365-days',
      ),
      '365-days',
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
    height: v.fallback(v.optional(chartHeightSchema, 400), 400),
    width: v.fallback(v.optional(chartWidthSchema), undefined),
    timelineStart: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
    timelineEnd: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
  }),
  component: RouteComponent,
  staticData: {
    includeSearchInCanonical: true,
  },
})

type NpmStatsSearch = {
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
  playbackLoop?: boolean
  playbackPlaying?: boolean
  showDataMode?: ShowDataMode
  normalizeBaseline?: boolean
  showBaseline?: boolean
  height?: number
  width?: number
  timelineStart?: number
  timelineEnd?: number
}

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // Get library-specific packages (without competitors - they're shown as suggestions)
  const libraryPackages = getLibraryNpmPackages(library)

  // Use search params or default to library packages
  const packageGroups: PackageGroup[] = search.packageGroups ?? libraryPackages
  const range: TimeRange = search.range ?? '365-days'
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
  const bucketOffsetParam: number = search.bucketOffset ?? 0
  const playbackIntervalMs: number =
    search.playbackIntervalMs ?? defaultPlaybackIntervalMs
  const playbackLoop: boolean = search.playbackLoop ?? false
  const playbackPlaying: boolean = search.playbackPlaying ?? false
  const height: number = search.height ?? 400
  const width: number | undefined = search.width
  const timelineStart: number | undefined = search.timelineStart
  const timelineEnd: number | undefined = search.timelineEnd

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

  const handleRangeChange = (newRange: TimeRange) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
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

  const handleBinnedChange = (value: BinType) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        barSort: nextBarSort,
      }),
      resetScroll: false,
    })
  }

  const handleBarOrientationChange = (nextBarOrientation: BarOrientation) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
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
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        playbackLoop: nextPlaybackLoop,
      }),
      resetScroll: false,
    })
  }

  const handlePlaybackPlayingChange = (nextPlaybackPlaying: boolean) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        playbackPlaying: nextPlaybackPlaying,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handleTransformChange = (mode: TransformMode) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        transform: mode,
      }),
      resetScroll: false,
    })
  }

  const handleShowDataModeChange = (mode: ShowDataMode) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        showDataMode: mode,
      }),
      resetScroll: false,
    })
  }

  const handleTimelineRangeChange = React.useCallback(
    (nextRange: { end: number | undefined; start: number | undefined }) => {
      navigate({
        to: '.',
        search: (prev: NpmStatsSearch) => ({
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

  const togglePackageVisibility = (index: number, packageName: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
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

  const handleRemovePackageName = (packageGroupIndex: number) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        packageGroups: prev.packageGroups?.filter(
          (_, i: number) => i !== packageGroupIndex,
        ),
      }),
      resetScroll: false,
    })
  }

  const handleLabelChange = (packageGroupIndex: number, label: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => {
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

  const handleAddPackage = (packageName: string, color?: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => {
        // Get the next default color based on existing package count
        const existingCount = (prev.packageGroups ?? packageGroups).length
        const nextColor =
          color ?? defaultColors[existingCount % defaultColors.length]

        return {
          ...prev,
          packageGroups: [
            ...(prev.packageGroups ?? packageGroups),
            { packages: [{ name: packageName }], color: nextColor },
          ],
        }
      },
      resetScroll: false,
    })
  }

  // Get available framework adapters that aren't already in the chart
  const availableAdapters = getAvailableFrameworkAdapters(
    library,
    packageGroups,
  )

  // Get available competitor packages that aren't already in the chart
  const availableCompetitors = getAvailableCompetitors(library, packageGroups)

  const handleAddBaseline = (packageName: string, color?: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => {
        const groups = prev.packageGroups ?? packageGroups
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
      search: (prev: NpmStatsSearch) => {
        const nonBaseline = (prev.packageGroups ?? packageGroups).filter(
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
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        packageGroups: (prev.packageGroups ?? packageGroups).filter(
          (pg) => !pg.baseline,
        ),
        showBaseline: false,
      }),
      resetScroll: false,
    })
  }

  const handleToggleShowBaseline = () => {
    if (!canToggleShowBaseline) return

    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        showBaseline: !prev.showBaseline,
      }),
      resetScroll: false,
    })
  }

  const handleToggleNormalizeBaseline = () => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        normalizeBaseline: !(prev.normalizeBaseline ?? true),
      }),
      resetScroll: false,
    })
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
        search: (prev: NpmStatsSearch) => {
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
        search: (prev: NpmStatsSearch) => ({
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

  const handleMenuOpenChange = (packageName: string, open: boolean) => {
    if (!open) {
      setOpenMenuPackage(null)
    } else {
      setOpenMenuPackage(packageName)
    }
  }

  return (
    <DocContainer>
      <div
        className={twMerge(
          'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[1500px]',
        )}
      >
        <div
          className={twMerge('flex overflow-auto flex-col w-full p-4 lg:p-6')}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            NPM Stats for {library.name}
          </h2>
          <NPMSummary library={library} />

          <div className="mb-4 flex flex-wrap items-center gap-1">
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
          </div>

          {/* Package Pills */}
          <div className="mb-4">
            <PackagePills
              packageGroups={packageGroups}
              queryData={packagePillQueryData}
              onColorClick={handleColorClick}
              onToggleVisibility={togglePackageVisibility}
              onRemove={handleRemovePackageName}
              onLabelChange={handleLabelChange}
              openMenuPackage={openMenuPackage}
              onMenuOpenChange={handleMenuOpenChange}
            />
          </div>

          {/* Baseline Section */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {viewMode === 'history' ? (
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
            </div>
            <div
              className="ml-auto flex min-h-6 items-center justify-end"
              ref={setChartActionsContainer}
            >
              {chartActionsMounted ? null : <DisabledChartActions />}
            </div>
          </div>

          {/* Suggested Framework Adapters */}
          {availableAdapters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Add adapter:
              </span>
              {availableAdapters.map(({ framework, packageName, color }) => (
                <Tooltip key={framework} content={`Add ${packageName}`}>
                  <button
                    onClick={() => handleAddPackage(packageName, color)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-gray-500/10 hover:bg-gray-500/20 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="font-medium" style={{ color }}>
                      🌴 {frameworkMeta[framework]?.name ?? framework}-
                      {library.id.charAt(0).toUpperCase() + library.id.slice(1)}
                    </span>
                  </button>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Suggested Competitor Packages */}
          {availableCompetitors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Compare with:
              </span>
              {availableCompetitors.map((competitor) => {
                const mainPackage = competitor.packages[0]?.name
                if (!mainPackage) return null
                const color = competitor.color ?? defaultColors[0]
                return (
                  <Tooltip key={mainPackage} content={`Add ${mainPackage}`}>
                    <button
                      onClick={() => handleAddPackage(mainPackage, color)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-gray-500/10 hover:bg-gray-500/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span className="font-medium" style={{ color }}>
                        {mainPackage}
                      </span>
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          )}

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

          {/* Chart */}
          {queryPackageGroups.length > 0 && (
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
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        animationQueryData={npmQuery.data}
                        animationBucketOffsetBounds={latestBucketBounds}
                        animationFrameIntervalMs={playbackIntervalMs}
                        onTimelineRangeChange={handleTimelineRangeChange}
                      />
                    </React.Suspense>
                  )}
                </Resizable>
              </div>

              {/* Stats Table */}
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
          )}

          <div className="h-24" />
        </div>
      </div>
    </DocContainer>
  )
}
