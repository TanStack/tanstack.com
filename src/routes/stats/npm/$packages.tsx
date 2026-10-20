import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import {
  parsePackagesFromUrl,
  transformModeSchema,
  binTypeSchema,
  chartTypeSchema,
  barOrientationSchema,
  latestBarSortSchema,
  defaultPlaybackIntervalMs,
  playbackIntervalMsSchema,
  showDataModeSchema,
  timeRangeSchema,
  viewModeSchema,
} from './-utils'
import { Spinner } from '~/components/Spinner'
import { chartHeightSchema, chartWidthSchema } from '~/utils/schemas'

const timelineZoomTimeSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const Route = createFileRoute('/stats/npm/$packages')({
  validateSearch: v.object({
    range: v.fallback(v.optional(timeRangeSchema, '365-days'), '365-days'),
    transform: v.fallback(v.optional(transformModeSchema, 'none'), 'none'),
    binType: v.fallback(v.optional(binTypeSchema, 'weekly'), 'weekly'),
    viewMode: v.fallback(v.optional(viewModeSchema, 'history'), 'history'),
    chartType: v.fallback(v.optional(chartTypeSchema, 'line'), 'line'),
    barOrientation: v.fallback(v.optional(barOrientationSchema), undefined),
    barSort: v.fallback(v.optional(latestBarSortSchema, 'value'), 'value'),
    bucketOffset: v.fallback(
      v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(-5000), v.maxValue(0)),
        0,
      ),
      0,
    ),
    playbackIntervalMs: v.fallback(
      v.optional(playbackIntervalMsSchema, defaultPlaybackIntervalMs),
      defaultPlaybackIntervalMs,
    ),
    playbackLoop: v.fallback(v.optional(v.boolean(), false), false),
    playbackPlaying: v.fallback(v.optional(v.boolean(), false), false),
    showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
    showLegend: v.fallback(v.optional(v.boolean(), false), false),
    height: v.fallback(v.optional(chartHeightSchema, 400), 400),
    width: v.fallback(v.optional(chartWidthSchema), undefined),
    timelineStart: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
    timelineEnd: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
  }),
  loader: ({ params }) => {
    const packages = parsePackagesFromUrl(params.packages)
    return { packages }
  },
  head: ({ loaderData }) => {
    const packages = loaderData?.packages || []
    const packageList = packages.join(' vs ')

    // SEO-optimized title and description
    const title =
      packages.length === 1
        ? `${packages[0]} - NPM Download Statistics & Trends`
        : `${packageList} - NPM Download Comparison`

    const description =
      packages.length === 1
        ? `View npm download statistics and trends for ${packages[0]}. Track weekly downloads, historical data, and growth patterns.`
        : `Compare npm downloads for ${packageList}. View download trends, weekly statistics, and historical data to choose the best package for your project.`

    const keywords = `${packages.join(', ')}, npm downloads, npm stats, package comparison, npm trends, download statistics`

    // JSON-LD structured data
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: `https://tanstack.com/stats/npm/${packages.join('-vs-')}`,
      isPartOf: {
        '@type': 'WebApplication',
        name: 'TanStack NPM Stats',
        url: 'https://tanstack.com/stats/npm',
      },
      about: packages.map((pkg) => ({
        '@type': 'SoftwareApplication',
        name: pkg,
        applicationCategory: 'DeveloperApplication',
      })),
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
      ],
    }
  },
  component: RouteComponent,
  staticData: {
    includeSearchInCanonical: true,
  },
})

function RouteComponent() {
  const { packages } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // Navigate to the main page with packages as search params
  // This happens client-side after SSR renders the meta tags
  React.useEffect(() => {
    navigate({
      to: '/stats/npm',
      search: {
        ...search,
        packageGroups: packages.map((name: string) => ({
          packages: [{ name }],
        })),
      },
      replace: true,
    })
  }, [navigate, packages, search])

  // Show loading while navigating
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Loading {packages.join(' vs ')}...
        </div>
      </div>
    </div>
  )
}
