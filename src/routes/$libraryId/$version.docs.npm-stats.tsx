import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { useThrottledCallback } from '@tanstack/react-pacer'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { twMerge } from 'tailwind-merge'

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
  ChartControls,
  PackagePills,
  npmQueryOptions,
  type PackageGroup,
  type TimeRange,
  type BinType,
  type TransformMode,
  type ShowDataMode,
  binningOptionsByType,
  defaultRangeBinTypes,
  getPackageColor,
} from '~/components/npm-stats'
import {
  getLibraryNpmPackages,
  getAvailableFrameworkAdapters,
  getAvailableCompetitors,
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
  const [_openMenuPackage, setOpenMenuPackage] = React.useState<string | null>(
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

  // Get available competitor packages that aren't already in the chart
  const availableCompetitors = getAvailableCompetitors(library, packageGroups)

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

  const _handleMenuOpenChange = (packageName: string, open: boolean) => {
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
            <ChartControls
              range={range}
              binType={binType}
              transform={transform}
              showDataMode={showDataModeParam}
              onRangeChange={handleRangeChange}
              onBinTypeChange={handleBinnedChange}
              onTransformChange={handleTransformChange}
              onShowDataModeChange={handleShowDataModeChange}
            />
          </div>

          {/* Package Pills */}
          <div className="mb-4">
            <PackagePills
              packageGroups={packageGroups}
              queryData={npmQuery.data}
              onColorClick={handleColorClick}
              onToggleVisibility={togglePackageVisibility}
              onRemove={handleRemovePackageName}
              onBaselineChange={handleBaselineChange}
            />
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
