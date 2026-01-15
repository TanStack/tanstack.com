import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import * as v from 'valibot'
import { useThrottledCallback } from '@tanstack/react-pacer'
import { X, Plus, EyeOff, Pin, EllipsisVertical } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'

import { getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import { Tooltip } from '~/components/Tooltip'
import { Spinner } from '~/components/Spinner'
import {
  NPMStatsChart,
  Resizable,
  ColorPickerPopover,
  StatsTable,
  PackageSearch,
  NPMSummary,
  npmQueryOptions,
  type PackageGroup,
  type TimeRange,
  type BinType,
  type TransformMode,
  type ShowDataMode,
  binningOptions,
  binningOptionsByType,
  timeRanges,
  defaultRangeBinTypes,
  getPackageColor,
  isBinningOptionValidForRange,
} from '~/components/npm-stats'
import {
  getLibraryComparisonPackages,
  getAvailableFrameworkAdapters,
  frameworkMeta,
  defaultColors,
} from '~/utils/npm-packages'
import { packageGroupSchema } from '~/routes/stats/npm/-comparisons'

const transformModeSchema = v.picklist(['none', 'normalize-y'])
const binTypeSchema = v.picklist(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = v.picklist(['all', 'complete'])

export const Route = createFileRoute('/$libraryId/$version/docs/npm-stats')({
  validateSearch: v.object({
    packageGroups: v.fallback(
      v.optional(v.array(packageGroupSchema)),
      undefined,
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
        '365-days',
      ),
      '365-days',
    ),
    transform: v.fallback(v.optional(transformModeSchema, 'none'), 'none'),
    binType: v.fallback(v.optional(binTypeSchema, 'weekly'), 'weekly'),
    showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
    height: v.fallback(v.optional(v.number(), 400), 400),
  }),
  component: RouteComponent,
})

type NpmStatsSearch = {
  packageGroups?: PackageGroup[]
  range?: TimeRange
  transform?: TransformMode
  binType?: BinType
  showDataMode?: ShowDataMode
  height?: number
}

const dropdownButtonStyles = {
  base: 'bg-gray-500/10 rounded-md px-2 py-1 text-sm flex items-center gap-1',
  active: 'bg-gray-500/20',
} as const

const transformOptions = [
  { value: 'none', label: 'Actual Values' },
  { value: 'normalize-y', label: 'Relative Change' },
] as const

const showDataModeOptions = [
  { value: 'all', label: 'All Data' },
  { value: 'complete', label: 'Hide Partial Data' },
] as const

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // Get library-specific packages with comparison packages
  const libraryPackages = getLibraryComparisonPackages(library)

  // Use search params or default to library packages
  const packageGroups: PackageGroup[] = search.packageGroups ?? libraryPackages
  const range: TimeRange = search.range ?? '365-days'
  const transform: TransformMode = search.transform ?? 'none'
  const binTypeParam: BinType | undefined = search.binType
  const showDataModeParam: ShowDataMode = search.showDataMode ?? 'all'
  const height: number = search.height ?? 400

  const binType: BinType = binTypeParam ?? defaultRangeBinTypes[range]
  const binOption = binningOptionsByType[binType]

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

  const npmQuery = useQuery(
    npmQueryOptions({
      packageGroups,
      range,
    }),
  )

  const handleRangeChange = (newRange: TimeRange) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        range: newRange,
        binType: defaultRangeBinTypes[newRange],
      }),
    })
  }

  const handleBinnedChange = (value: BinType) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        binType: value,
      }),
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

  const togglePackageVisibility = (index: number, packageName: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => ({
        ...prev,
        packageGroups: prev.packageGroups?.map((pkg, i) =>
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

  const handleBaselineChange = (packageName: string) => {
    navigate({
      to: '.',
      search: (prev: NpmStatsSearch) => {
        return {
          ...prev,
          packageGroups: prev.packageGroups?.map((pkg) => {
            const baseline =
              pkg.packages[0]?.name === packageName ? !pkg.baseline : false

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
        search: (prev: NpmStatsSearch) => ({ ...prev, height }),
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

          <div className="flex gap-2 flex-wrap items-center mb-4">
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
              <Tooltip content="Transform the Y-axis">
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
                    onSelect={() =>
                      handleTransformChange(value as TransformMode)
                    }
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
                        'opacity-50 cursor-not-allowed',
                    )}
                    disabled={transform === 'normalize-y'}
                  >
                    {
                      showDataModeOptions.find(
                        (opt) => opt.value === showDataModeParam,
                      )?.label
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
                      showDataModeParam === value
                        ? 'text-blue-500 bg-blue-500/10'
                        : '',
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

            <Link
              to="/stats/npm"
              search={{ packageGroups }}
              className="ml-auto text-sm text-blue-500 hover:text-blue-600 hover:underline"
            >
              Open in full stats page
            </Link>
          </div>

          {/* Package Pills */}
          <div className="flex flex-wrap gap-1 sm:gap-2 mb-4">
            {packageGroups.map((pkg, index) => {
              const mainPackage = pkg.packages[0]
              if (!mainPackage) return null
              const packageList = pkg.packages
              const isCombined = packageList.length > 1
              const subPackages = packageList.filter(
                (p) => p.name !== mainPackage.name,
              )
              const color = getPackageColor(mainPackage.name, packageGroups)
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
                            onClick={() =>
                              handleBaselineChange(mainPackage.name)
                            }
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
                            onClick={(e) =>
                              handleColorClick(mainPackage.name, e)
                            }
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
                      {frameworkMeta[framework]?.name ?? framework}
                    </span>
                  </button>
                </Tooltip>
              ))}
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
          {packageGroups.length > 0 && (
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
                <Resizable height={height} onHeightChange={onHeightChange}>
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
                    <NPMStatsChart
                      range={range}
                      queryData={npmQuery.data}
                      transform={transform}
                      binType={binType}
                      packages={packageGroups}
                      showDataMode={showDataModeParam}
                    />
                  )}
                </Resizable>
              </div>

              {/* Stats Table */}
              <StatsTable
                queryData={npmQuery.data}
                packageGroups={packageGroups}
                binOption={binOption}
                transform={transform}
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
