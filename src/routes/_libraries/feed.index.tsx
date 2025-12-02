import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { Footer } from '~/components/Footer'
import { seo } from '~/utils/seo'
import {
  FeedPageLayout,
  type FeedFiltersState,
} from '~/components/FeedPageLayout'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { listFeedEntriesQueryOptions } from '~/queries/feed'
import { libraries, type LibraryId } from '~/libraries'
import { FEED_CATEGORIES, RELEASE_LEVELS } from '~/utils/feedSchema'

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
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(50).catch(50),
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
      })
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
  const mounted = useMounted()

  // Load saved filter preferences from localStorage (only on client)
  // Must be called before any conditional returns to follow Rules of Hooks
  const [savedFilters, setSavedFilters] = useState<typeof search | null>(null)
  const [savedViewMode, setSavedViewMode] = useState<string | null>(null)

  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('feedFilters')
      if (saved) {
        try {
          setSavedFilters(JSON.parse(saved))
        } catch {
          // Ignore parse errors
        }
      }
      // Load viewMode preference
      const viewMode = localStorage.getItem('feedViewMode')
      if (viewMode) {
        setSavedViewMode(viewMode)
      }
    }
  }, [mounted])

  // Merge saved filters with URL params (URL params take precedence)
  const effectiveFilters = {
    ...savedFilters,
    ...search,
    // Use saved viewMode if not in URL
    viewMode:
      search.viewMode ??
      (savedViewMode === 'table' || savedViewMode === 'timeline'
        ? savedViewMode
        : undefined) ??
      'table',
  }

  // Call hook before conditional returns
  const feedQuery = useFeedQuery({
    page: effectiveFilters.page ?? 1,
    pageSize: effectiveFilters.pageSize ?? 50,
    filters: {
      sources: effectiveFilters.sources,
      libraries: effectiveFilters.libraries,
      categories: effectiveFilters.categories,
      partners: effectiveFilters.partners,
      tags: effectiveFilters.tags,
      releaseLevels: effectiveFilters.releaseLevels,
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
    },
  })

  const handleFiltersChange = (newFilters: Partial<FeedFiltersState>): void => {
    navigate({
      search: (s) => ({
        ...s,
        ...newFilters,
        page: 1,
      }),
      replace: true,
    })

    // Save to localStorage
    if (typeof window !== 'undefined') {
      const updatedFilters = { ...search, ...newFilters, page: 1 }
      localStorage.setItem('feedFilters', JSON.stringify(updatedFilters))
      setSavedFilters(updatedFilters)
    }
  }

  const handleClearFilters = () => {
    navigate({
      search: {
        page: 1,
        pageSize: effectiveFilters.pageSize ?? 50,
        viewMode: effectiveFilters.viewMode ?? 'table',
      },
      replace: true,
    })

    if (typeof window !== 'undefined') {
      localStorage.removeItem('feedFilters')
      setSavedFilters(null)
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    navigate({
      search: (s) => ({
        ...s,
        pageSize: newPageSize,
        page: 1,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  const handleViewModeChange = (viewMode: 'table' | 'timeline') => {
    navigate({
      search: (s) => ({ ...s, viewMode }),
      replace: true,
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('feedViewMode', viewMode)
    }
  }

  const handleExpandedChange = (expandedIds: string[]) => {
    navigate({
      search: (s) => ({
        ...s,
        expanded: expandedIds.length > 0 ? expandedIds : undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  return (
    <FeedPageLayout.Root
      feedQuery={feedQuery}
      currentPage={effectiveFilters.page ?? 1}
      pageSize={effectiveFilters.pageSize ?? 20}
      filters={effectiveFilters}
      onFiltersChange={handleFiltersChange}
      onClearFilters={handleClearFilters}
      onPageChange={(page) => {
        navigate({
          search: (s) => ({ ...s, page }),
          replace: true,
          resetScroll: false,
        })
      }}
      onPageSizeChange={handlePageSizeChange}
      viewMode={effectiveFilters.viewMode ?? 'table'}
      onViewModeChange={handleViewModeChange}
      expandedIds={search.expanded}
      onExpandedChange={handleExpandedChange}
    >
      <div className="flex flex-col lg:flex-row gap-2">
        <FeedPageLayout.Filters />
        <FeedPageLayout.Content />
      </div>
      <FeedPageLayout.Footer>
        <Footer />
      </FeedPageLayout.Footer>
    </FeedPageLayout.Root>
  )
}
