import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import {
  parsePackagesFromUrl,
  transformModeSchema,
  binTypeSchema,
  showDataModeSchema,
  timeRangeSchema,
} from './-utils'
import { Spinner } from '~/components/Spinner'

export const Route = createFileRoute('/stats/npm/$packages')({
  validateSearch: z.object({
    range: timeRangeSchema.optional().default('365-days').catch('365-days'),
    transform: transformModeSchema.optional().default('none').catch('none'),
    facetX: z.enum(['name']).optional().catch(undefined),
    facetY: z.enum(['name']).optional().catch(undefined),
    binType: binTypeSchema.optional().default('weekly').catch('weekly'),
    showDataMode: showDataModeSchema.optional().default('all').catch('all'),
    height: z.number().optional().default(400).catch(400),
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
})

function RouteComponent() {
  const { packages } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Navigate to the main page with packages as search params
  // This happens client-side after SSR renders the meta tags
  React.useEffect(() => {
    navigate({
      to: '/stats/npm',
      search: {
        packageGroups: packages.map((name) => ({
          packages: [{ name }],
        })),
        ...search,
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
