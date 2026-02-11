import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { FeedPage as FeedPageComponent } from '~/components/FeedPage'
import { listFeedEntriesQueryOptions } from '~/queries/feed'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'
import {
  libraryIdSchema,
  entryTypeSchema,
  releaseLevelSchema,
  feedViewModeSchema,
} from '~/utils/schemas'

const searchSchema = v.object({
  entryTypes: v.fallback(v.optional(v.array(entryTypeSchema)), undefined),
  libraries: v.fallback(v.optional(v.array(libraryIdSchema)), undefined),
  partners: v.fallback(v.optional(v.array(v.string())), undefined),
  tags: v.fallback(v.optional(v.array(v.string())), undefined),
  releaseLevels: v.fallback(v.optional(v.array(releaseLevelSchema)), undefined),
  includePrerelease: v.fallback(v.optional(v.boolean()), undefined),
  featured: v.fallback(v.optional(v.boolean()), undefined),
  search: v.fallback(v.optional(v.string()), undefined),
  page: v.fallback(
    v.optional(v.number(), FEED_DEFAULTS.page),
    FEED_DEFAULTS.page,
  ),
  pageSize: v.fallback(
    v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(1)),
      FEED_DEFAULTS.pageSize,
    ),
    FEED_DEFAULTS.pageSize,
  ),
  viewMode: v.fallback(v.optional(feedViewModeSchema, 'table'), 'table'),
  expanded: v.fallback(v.optional(v.array(v.string())), undefined),
})

export const Route = createFileRoute('/feed/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    entryTypes: search.entryTypes,
    libraries: search.libraries,
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
          entryTypes: deps.entryTypes,
          libraries: deps.libraries,
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
  )
}
