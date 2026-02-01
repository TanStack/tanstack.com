import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { useThrottledCallback } from '@tanstack/react-pacer'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '~/components/Card'
import { seo } from '~/utils/seo'
import {
  getPopularComparisons,
  packageGroupSchema,
  defaultPackageGroups,
} from './-comparisons'
import { GamHeader, GamVrec1 } from '~/components/Gam'
import { AdGate } from '~/contexts/AdsContext'
import { Spinner } from '~/components/Spinner'
import {
  NPMStatsChart,
  PackageSearch,
  Resizable,
  ColorPickerPopover,
  StatsTable,
  PopularComparisons,
  ChartControls,
  PackagePills,
  npmQueryOptions,
  type PackageGroup,
  type TimeRange,
  type BinType,
  type TransformMode,
  type ShowDataMode,
  type FacetValue,
  binningOptionsByType,
  defaultRangeBinTypes,
  getPackageColor,
} from '~/components/npm-stats'

const transformModeSchema = v.picklist(['none', 'normalize-y'])
const binTypeSchema = v.picklist(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = v.picklist(['all', 'complete'])
export const Route = createFileRoute('/stats/npm/')({
  validateSearch: v.object({
    packageGroups: v.fallback(
      v.optional(v.array(packageGroupSchema), defaultPackageGroups),
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
        '365-days',
      ),
      '365-days',
    ),
    transform: v.fallback(v.optional(transformModeSchema, 'none'), 'none'),
    facetX: v.fallback(v.optional(v.picklist(['name'])), undefined),
    facetY: v.fallback(v.optional(v.picklist(['name'])), undefined),
    binType: v.fallback(v.optional(binTypeSchema, 'weekly'), 'weekly'),
    showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
    height: v.fallback(v.optional(v.number(), 400), 400),
  }),
  loaderDeps: ({ search }) => ({
    packageList: search.packageGroups
      ?.map((p) => p.packages[0].name)
      .join(' vs '),
    packageNames: search.packageGroups?.map((p) => p.packages[0].name) ?? [],
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
    color?: string
    baseline?: boolean
    packages: Array<{ name?: string; hidden?: boolean }>
  }>
  range?: TimeRange
  transform?: 'none' | 'normalize-y'
  facetX?: 'name'
  facetY?: 'name'
  binType?: BinType
  showDataMode?: 'all' | 'complete'
  height?: number
}

function RouteComponent() {
  const search = Route.useSearch()
  const packageGroups: PackageGroup[] = search.packageGroups ?? []
  const range: TimeRange = search.range ?? '7-days'
  const transform: TransformMode = search.transform ?? 'none'
  const facetX: FacetValue | undefined = search.facetX
  const facetY: FacetValue | undefined = search.facetY
  const binTypeParam: BinType | undefined = search.binType
  const showDataModeParam: ShowDataMode = search.showDataMode ?? 'all'
  const height: number = search.height ?? 400
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

  const binType: BinType = binTypeParam ?? defaultRangeBinTypes[range]
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
          packageGroups: prev.packageGroups?.map((pkg) => {
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

  const npmQuery = useQuery(
    npmQueryOptions({
      packageGroups: packageGroups,
      range,
    }),
  )

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

  const setBinningOption = (newBinningOption: BinType) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binType: newBinningOption,
      }),
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
  const packageListForH1 = packageGroups
    .map((p) => p.packages[0].name)
    .join(' vs ')

  return (
    <div className="min-h-dvh p-2 sm:p-4 space-y-2 sm:space-y-4">
      {/* SEO Header Section */}
      <header className="max-w-4xl">
        <h1>
          <span className="block text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            NPM Download Comparison
          </span>
          {packageGroups.length > 0 && (
            <span className="block text-base sm:text-lg font-normal text-gray-600 dark:text-gray-400 mt-0.5">
              {packageListForH1}
            </span>
          )}
        </h1>
        <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
          Compare npm package downloads with interactive charts. Track trends
          and make data-driven decisions.
        </p>
      </header>

      <div className="flex gap-4">
        <Card className="flex-1 space-y-4 p-4 max-w-full">
          <div className="flex gap-2 flex-wrap items-center">
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
              facetX={facetX}
              facetY={facetY}
              onFacetXChange={handleFacetXChange}
              onFacetYChange={handleFacetYChange}
            />
          </div>
          <PackagePills
            packageGroups={packageGroups}
            queryData={npmQuery.data}
            onColorClick={handleColorClick}
            onToggleVisibility={togglePackageVisibility}
            onRemove={handleRemovePackageName}
            onBaselineChange={handleBaselineChange}
            onCombinePackage={handleCombinePackage}
            onRemoveFromGroup={handleRemoveFromGroup}
            openMenuPackage={openMenuPackage}
            onMenuOpenChange={handleMenuOpenChange}
          />

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
                        facetX={facetX}
                        facetY={facetY}
                        showDataMode={showDataModeParam}
                      />
                    )}
                  </Resizable>
                </div>
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
            </div>
          ) : null}

          {/* Popular Comparisons Section */}
          <PopularComparisons comparisons={getPopularComparisons()} />
        </Card>
        <div className="hidden lg:block w-[290px] xl:w-[332px] shrink-0">
          <div className="sticky top-4 space-y-4">
            <AdGate>
              <GamVrec1
                className="flex justify-center rounded-xl overflow-hidden shadow-xs shadow-black/5 max-w-full"
                adClassName="rounded-xl overflow-hidden"
              />
            </AdGate>
          </div>
        </div>
      </div>
      <AdGate>
        <GamHeader />
      </AdGate>

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
