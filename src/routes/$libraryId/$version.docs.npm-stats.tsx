import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { NpmStatsComponent } from '~/components/NpmStatsComponent'
import { useWidthToggle } from '~/components/DocsLayout'
import { getLibrary, Library } from '~/libraries'
import { packageGroupSchema } from '~/routes/stats/npm/-comparisons'
import NpmStatsSummaryBar from '~/components/NpmStatsSummaryBar'

const transformModeSchema = z.enum(['none', 'normalize-y'])
const binTypeSchema = z.enum(['yearly', 'monthly', 'weekly', 'daily'])
const showDataModeSchema = z.enum(['all', 'complete'])

type TimeRange =
  | '7-days'
  | '30-days'
  | '90-days'
  | '180-days'
  | '365-days'
  | '730-days'
  | '1825-days'
  | 'all-time'

const facetOptions = [{ value: 'name', label: 'Package' }] as const

type FacetValue = (typeof facetOptions)[number]['value']

function getPackageName(
  frameworkValue: string,
  libraryId: string,
  library: Library,
): string {
  if (frameworkValue === 'vanilla') {
    // For vanilla, use corePackageName if provided, otherwise just libraryId
    const coreName = library.corePackageName || libraryId
    return `@tanstack/${coreName}`
  }
  // Special case: Angular Query uses experimental package
  if (frameworkValue === 'angular' && libraryId === 'query') {
    return `@tanstack/angular-query-experimental`
  }
  // For other frameworks, use {framework}-{libraryId} pattern (e.g., @tanstack/react-table)
  return `@tanstack/${frameworkValue}-${libraryId}`
}

export const Route = createFileRoute('/$libraryId/$version/docs/npm-stats')({
  validateSearch: z.object({
    packageGroups: z.array(packageGroupSchema).optional().catch(undefined),
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
    binType: binTypeSchema.optional().catch(undefined),
    showDataMode: showDataModeSchema.optional().default('all').catch('all'),
    height: z.number().optional().default(400).catch(400),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { libraryId } = Route.useParams()
  const {
    packageGroups,
    range,
    transform,
    facetX,
    facetY,
    binType,
    showDataMode,
    height,
  } = Route.useSearch()
  const navigate = useNavigate()
  const library = getLibrary(libraryId)
  const { setIsFullWidth } = useWidthToggle()

  // Set full width on mount for better chart viewing
  React.useEffect(() => {
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
      'text-lime-700': '#365314',
      // DB
      'text-orange-700': '#c2410c',
      // Devtools
      'text-slate-600': '#475569',
      // Legacy/fallback colors
      'text-red-500': '#ef4444',
    }
    return tailwindColors[textColor]
  }
  const libraryColor = getLibraryColor(library.textColor)

  // Get the core package name for this library
  const corePackageName = getPackageName('vanilla', libraryId, library)

  // Default package groups if none are set
  const defaultPackageGroups = React.useMemo(() => {
    if (packageGroups && packageGroups.length > 0) {
      return packageGroups
    }
    return [
      {
        packages: [{ name: corePackageName }],
        color: libraryColor || null, // Use library's theme color for core package
      },
    ]
  }, [packageGroups, corePackageName, libraryColor])

  const handlePackageGroupsChange = (
    newPackageGroups: z.infer<typeof packageGroupSchema>[],
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
      }),
      resetScroll: false,
    })
  }

  const handleTransformChange = (
    newTransform: z.infer<typeof transformModeSchema>,
  ) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        transform: newTransform,
      }),
      resetScroll: false,
    })
  }

  const handleFacetXChange = (newFacetX: FacetValue | undefined) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        facetX: newFacetX,
      }),
      resetScroll: false,
    })
  }

  const handleFacetYChange = (newFacetY: FacetValue | undefined) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        facetY: newFacetY,
      }),
      resetScroll: false,
    })
  }

  const handleBinTypeChange = (newBinType: z.infer<typeof binTypeSchema>) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        binType: newBinType,
      }),
      resetScroll: false,
    })
  }

  const handleShowDataModeChange = (
    newShowDataMode: z.infer<typeof showDataModeSchema>,
  ) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        showDataMode: newShowDataMode,
      }),
      resetScroll: false,
    })
  }

  const handleHeightChange = (newHeight: number) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        height: newHeight,
      }),
      resetScroll: false,
    })
  }

  return (
    <DocContainer>
      <div className="w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-full">
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

          <NpmStatsComponent
            packageGroups={defaultPackageGroups}
            onPackageGroupsChange={handlePackageGroupsChange}
            range={range}
            onRangeChange={handleRangeChange}
            transform={transform}
            onTransformChange={handleTransformChange}
            facetX={facetX}
            onFacetXChange={handleFacetXChange}
            facetY={facetY}
            onFacetYChange={handleFacetYChange}
            binType={binType}
            onBinTypeChange={handleBinTypeChange}
            showDataMode={showDataMode}
            onShowDataModeChange={handleShowDataModeChange}
            height={height}
            onHeightChange={handleHeightChange}
            showPopularComparisons={false}
            competitors={library.competitors}
            frameworks={library.frameworks}
            libraryId={libraryId}
            getPackageName={getPackageName}
            library={library}
          />

          <div className="h-24" />
        </div>
      </div>
    </DocContainer>
  )
}
