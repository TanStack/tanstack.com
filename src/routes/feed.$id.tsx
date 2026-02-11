import { Link, notFound, createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import { useCapabilities } from '~/hooks/useCapabilities'
import { isAdmin } from '~/db/types'
import * as v from 'valibot'
import type { FeedEntry } from '~/components/FeedEntry'
import { getFeedEntryByIdQueryOptions } from '~/queries/feed'
import { ArrowLeft } from 'lucide-react'
import type { FeedActionContext } from '~/utils/feed.composites'

// Type for detail composite props
type DetailCompositeProps = {
  renderActions?: (ctx: FeedActionContext) => React.ReactNode
  children?: React.ReactNode
}

// CompositeComponent with slot props - cast to avoid type mismatch
const DetailComposite = CompositeComponent as unknown as React.FC<
  { src: FeedEntry['detailCompositeSrc'] } & DetailCompositeProps
>

const searchSchema = v.object({})

export const Route = createFileRoute('/feed/$id')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  loader: async ({ params, context: { queryClient } }) => {
    const entryId = params.id

    // Fetch the feed entry by id (includes pre-rendered contentRsc)
    const entry = await queryClient.ensureQueryData(
      getFeedEntryByIdQueryOptions(entryId),
    )

    if (!entry) {
      throw notFound()
    }

    return { entry }
  },
  headers: () => ({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    'Netlify-Vary': 'query=payload',
  }),
  component: FeedItemPage,
  validateSearch: searchSchema,
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
  if (!entry.showInFeed && !isAdmin(capabilities)) {
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

  return <FeedEntryView entry={entry as FeedEntry} />
}

function FeedEntryView({ entry }: { entry: FeedEntry }) {
  // If composite source is available, use it
  if (entry.detailCompositeSrc) {
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
            <ArrowLeft />
            Back to Feed
          </Link>

          {/* Feed Entry - rendered via composite */}
          <DetailComposite src={entry.detailCompositeSrc} />
        </div>

        <Footer />
      </div>
    )
  }

  // Fallback: no composite source (shouldn't happen in practice)
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
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
          <ArrowLeft />
          Back to Feed
        </Link>

        <article className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg p-4 lg:p-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {entry.title}
          </h1>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {entry.contentRsc ?? entry.content}
          </div>
        </article>
      </div>

      <Footer />
    </div>
  )
}
