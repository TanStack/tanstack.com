import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { FeedPage as FeedPageComponent } from '~/components/FeedPage'
import { listFeedEntriesQueryOptions } from '~/queries/feed'
import { libraries, type LibraryId } from '~/libraries'
import { FEED_CATEGORIES, RELEASE_LEVELS } from '~/utils/feedSchema'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'

// Create zod enums from single source of truth
const libraryIds = libraries.map((lib) => lib.id) as readonly LibraryId[]
const librarySchema = z.enum(libraryIds as [LibraryId, ...LibraryId[]])
const categorySchema = z.enum(FEED_CATEGORIES)
const releaseLevelSchema = z.enum(RELEASE_LEVELS)
const viewModeSchema = z
  .enum(['table', 'timeline'])
  .optional()
  .default('table')
  .catch('table')

export const Route = createFileRoute('/_libraries/feed/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  validateSearch: (search) => {
    const parsed = z
      .object({
        sources: z.array(z.string()).optional().catch(undefined),
        libraries: z.array(librarySchema).optional().catch(undefined),
        categories: z.array(categorySchema).optional().catch(undefined),
        partners: z.array(z.string()).optional().catch(undefined),
        tags: z.array(z.string()).optional().catch(undefined),
        releaseLevels: z.array(releaseLevelSchema).optional().catch(undefined),
        includePrerelease: z.boolean().optional().catch(undefined),
        featured: z.boolean().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        page: z
          .number()
          .optional()
          .default(FEED_DEFAULTS.page)
          .catch(FEED_DEFAULTS.page),
        pageSize: z
          .number()
          .int()
          .positive()
          .optional()
          .default(FEED_DEFAULTS.pageSize)
          .catch(FEED_DEFAULTS.pageSize),
        viewMode: viewModeSchema,
        expanded: z.array(z.string()).optional().catch(undefined),
      })
      .parse(search)

    return parsed
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    sources: search.sources,
    libraries: search.libraries,
    categories: search.categories,
    partners: search.partners,
    tags: search.tags,
    releaseLevels: search.releaseLevels,
    includePrerelease: search.includePrerelease,
    featured: search.featured,
    search: search.search,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    // Prefetch feed data based on URL search params
    // Note: localStorage preferences are merged client-side, but this prefetches
    // the data based on URL params which helps with initial load
    await queryClient.ensureQueryData(
      listFeedEntriesQueryOptions({
        pagination: {
          limit: deps.pageSize ?? 50,
          page: (deps.page ?? 1) - 1,
        },
        filters: {
          sources: deps.sources,
          libraries: deps.libraries,
          categories: deps.categories as any,
          partners: deps.partners,
          tags: deps.tags,
          releaseLevels: deps.releaseLevels as any,
          includePrerelease: deps.includePrerelease,
          featured: deps.featured,
          search: deps.search,
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'public, max-age=0, must-revalidate',
    'cdn-cache-control': 'max-age=300, stale-while-revalidate=300, durable',
    'Netlify-Vary': 'query=payload',
  }),
  component: FeedPage,
  head: () => ({
    meta: seo({
      title: 'Feed | TanStack',
      description:
        'Stay up to date with all TanStack updates, releases, announcements, and blog posts',
    }),
  }),
})

function FeedPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <div className="p-2 sm:p-4 pb-0">
      <FeedPageComponent
        search={search}
        onNavigate={(updates) => {
          navigate({
            search: (s) => ({ ...s, ...updates.search }),
            replace: updates.replace ?? true,
            resetScroll: updates.resetScroll ?? false,
          })
        }}
      />
    </div>
  )
}
