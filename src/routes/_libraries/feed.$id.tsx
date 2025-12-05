import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import { useCapabilities } from '~/hooks/useCapabilities'
import { FaArrowLeft } from 'react-icons/fa'
import { z } from 'zod'
import { format, formatDistanceToNow } from 'date-fns'
import { Markdown } from '~/components/Markdown'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { twMerge } from 'tailwind-merge'
import type { FeedEntry } from '~/components/FeedEntry'
import { getFeedEntryByIdQueryOptions } from '~/queries/feed'

export const Route = createFileRoute('/_libraries/feed/$id')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  loader: async ({ params, context: { queryClient } }) => {
    const entryId = params.id

    // Fetch the feed entry by id
    const entry = await queryClient.ensureQueryData(
      getFeedEntryByIdQueryOptions(entryId),
    )

    if (!entry) {
      throw notFound()
    }

    // Check if entry is visible (unless admin)
    // Note: We'll check capabilities client-side since they depend on auth
    // For SSR, we'll allow the entry to load and handle visibility client-side

    return {
      entry,
    }
  },
  headers: () => ({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    'Netlify-Vary': 'query=payload',
  }),
  component: FeedItemPage,
  validateSearch: z.object({}),
  head: ({ loaderData }) => {
    const entry = loaderData?.entry

    if (!entry) {
      return {
        meta: seo({
          title: 'Feed Entry Not Found',
        }),
      }
    }

    return {
      meta: seo({
        title: `${entry.title} | TanStack Feed`,
        description: entry.excerpt || entry.content.slice(0, 160),
      }),
    }
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Feed Entry Not Found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The feed entry you're looking for doesn't exist or isn't available.
        </p>
        <Link
          to="/feed"
          search={{
            releaseLevels: ['major', 'minor'] as const,
            includePrerelease: true,
            page: 1,
            pageSize: 20,
            viewMode: 'table' as const,
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-block"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  ),
})

function FeedItemPage() {
  const { entry } = Route.useLoaderData()
  const capabilities = useCapabilities()

  // Show not found if entry isn't visible (unless admin)
  if (!entry.isVisible && !capabilities.includes('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Feed Entry Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The feed entry you're looking for doesn't exist or isn't available.
          </p>
          <Link
            to="/feed"
            search={{
              releaseLevels: ['major', 'minor'] as const,
              includePrerelease: true,
              page: 1,
              pageSize: 20,
              viewMode: 'table' as const,
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-block"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  return <FeedEntryView entry={entry} />
}

function FeedEntryView({ entry }: { entry: FeedEntry }) {
  // Get library info
  const entryLibraries = entry.libraryIds
    .map((id) => libraries.find((lib) => lib.id === id))
    .filter(Boolean)

  // Get partner info
  const entryPartners = entry.partnerIds
    ? entry.partnerIds
        .map((id) => partners.find((p) => p.id === id))
        .filter(Boolean)
    : []

  // Determine entry type badge
  const getTypeBadge = () => {
    const isPrerelease = entry.tags.includes('release:prerelease')

    const badgeConfigs: Record<string, { label: string; className: string }> = {
      release: {
        label: 'Release',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      },
      prerelease: {
        label: 'Prerelease',
        className:
          'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      },
      blog: {
        label: 'Blog',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      },
      announcement: {
        label: 'Announcement',
        className:
          'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      },
      partner: {
        label: 'Partner',
        className:
          'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200',
      },
    }

    const category = entry.category
    const key = category === 'release' && isPrerelease ? 'prerelease' : category

    return (
      badgeConfigs[key] || {
        label: entry.source,
        className:
          'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      }
    )
  }

  const badge = getTypeBadge()

  // Get release level badge if present
  const getReleaseLevelBadge = () => {
    const releaseLevelTag = entry.tags.find(
      (tag) =>
        tag.startsWith('release:') &&
        tag !== 'release:prerelease' &&
        (tag === 'release:major' ||
          tag === 'release:minor' ||
          tag === 'release:patch'),
    )
    if (!releaseLevelTag) return null

    const level = releaseLevelTag.replace('release:', '')
    const badgeConfigs: Record<string, { label: string; className: string }> = {
      major: {
        label: 'Major',
        className:
          'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      },
      minor: {
        label: 'Minor',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      },
      patch: {
        label: 'Patch',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      },
    }

    return badgeConfigs[level] || null
  }

  const releaseLevelBadge = getReleaseLevelBadge()

  // Determine external link if available
  const getExternalLink = () => {
    if (entry.metadata) {
      if (entry.source === 'github' && entry.metadata.url) {
        return entry.metadata.url
      }
      if (entry.source === 'blog' && entry.metadata.url) {
        return entry.metadata.url
      }
    }
    return null
  }

  const externalLink = getExternalLink()

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Back Link */}
        <Link
          to="/feed"
          search={{
            releaseLevels: ['major', 'minor'] as const,
            includePrerelease: true,
            page: 1,
            pageSize: 20,
            viewMode: 'table' as const,
          }}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4 font-medium"
        >
          <FaArrowLeft />
          Back to Feed
        </Link>

        {/* Feed Entry */}
        <article
          className={twMerge(
            'bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-4 lg:p-6',
            entry.featured &&
              'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800',
          )}
        >
          {/* Header */}
          <div className="mb-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span
                className={twMerge(
                  'px-2 py-1 rounded-md text-xs font-medium uppercase',
                  badge.className,
                )}
              >
                {badge.label}
              </span>
              {releaseLevelBadge && (
                <span
                  className={twMerge(
                    'px-2 py-1 rounded-md text-xs font-medium uppercase',
                    releaseLevelBadge.className,
                  )}
                >
                  {releaseLevelBadge.label}
                </span>
              )}
              {entry.featured && (
                <span className="px-2 py-1 rounded-md text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                  ⭐ Featured
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {entry.title}
            </h1>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
              <time
                dateTime={new Date(entry.publishedAt).toISOString()}
                title={format(new Date(entry.publishedAt), 'PPpp')}
                className="cursor-help"
              >
                {formatDistanceToNow(new Date(entry.publishedAt), {
                  addSuffix: true,
                })}
              </time>
              {entry.source !== 'announcement' && (
                <span className="capitalize">{entry.source}</span>
              )}
              {entryLibraries.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>Libraries:</span>
                  <div className="flex gap-1 flex-wrap">
                    {entryLibraries.map((lib) => (
                      <span
                        key={lib!.id}
                        className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs"
                      >
                        {lib!.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {entryPartners.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>Partners:</span>
                  <div className="flex gap-1 flex-wrap">
                    {entryPartners.map((partner) => (
                      <span
                        key={partner!.id}
                        className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs"
                      >
                        {partner!.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap pb-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Tags:
              </span>
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none mb-4 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0">
            <Markdown rawContent={entry.content} />
          </div>

          {/* External Link */}
          {externalLink && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium inline-flex items-center gap-2"
              >
                View on {entry.source === 'github' ? 'GitHub' : 'Blog'}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </article>
      </div>

      <Footer />
    </div>
  )
}
