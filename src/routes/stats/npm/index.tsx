import * as React from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { getPopularComparisons, packageGroupSchema } from './-comparisons'
import { GamHeader, GamVrec1 } from '~/components/Gam'
import { AdGate } from '~/contexts/AdsContext'
import { NpmStatsComponent } from '~/components/NpmStatsComponent'

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

export const Route = createFileRoute('/stats/npm/')({
  validateSearch: z.object({
    packageGroups: z
      .array(packageGroupSchema)
      .optional()
      .default(getPopularComparisons()[0].packageGroups)
      .catch(getPopularComparisons()[0].packageGroups),
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

function RouteComponent() {
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
        <div className="flex-1 bg-white dark:bg-black/50 rounded-lg space-y-4 p-4 shadow-xl max-w-full">
          <NpmStatsComponent
            packageGroups={packageGroups}
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
            showPopularComparisons={true}
          />
        </div>
        <div className="hidden lg:block w-[290px] xl:w-[332px] shrink-0">
          <div className="sticky top-4 space-y-4">
            <AdGate>
              <GamVrec1
                className="flex justify-center rounded-xl overflow-hidden shadow-xl shadow-black/5 max-w-full"
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
