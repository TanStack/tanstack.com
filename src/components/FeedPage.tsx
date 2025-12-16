import { useState, useEffect, useMemo } from 'react'
import { ReactNode } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { Footer } from '~/components/Footer'
import { FeedList } from '~/components/FeedList'
import { FeedFilters } from '~/components/FeedFilters'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { useFeedInfiniteQuery } from '~/hooks/useFeedInfiniteQuery'
import { FeedEntry } from '~/components/FeedEntry'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { useQuery } from '@tanstack/react-query'
import { getFeedFacetCountsQueryOptions } from '~/queries/feed'
import { twMerge } from 'tailwind-merge'

export type LibraryId =
  | 'start'
  | 'router'
  | 'query'
  | 'table'
  | 'form'
  | 'virtual'
  | 'ranger'
  | 'store'
  | 'pacer'
  | 'db'
  | 'config'
  | 'react-charts'
  | 'devtools'
  | 'create-tsrouter-app'

export type Category =
  | 'release'
  | 'announcement'
  | 'blog'
  | 'partner'
  | 'update'
  | 'other'

export interface FeedFiltersState {
  sources?: string[]
  libraries?: LibraryId[]
  categories?: Category[]
  partners?: string[]
  tags?: string[]
  releaseLevels?: ('major' | 'minor' | 'patch')[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
}

interface FeedPageProps {
  search: FeedFiltersState & {
    page?: number
    pageSize?: number
    viewMode?: 'table' | 'timeline'
    expanded?: string[]
  }
  onNavigate: (updates: {
    search?: Partial<
      FeedFiltersState & {
        page?: number
        pageSize?: number
        viewMode?: 'table' | 'timeline'
        expanded?: string[]
      }
    >
    replace?: boolean
    resetScroll?: boolean
  }) => void
  includeHidden?: boolean
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

export function FeedPage({
  search,
  onNavigate,
  includeHidden = false,
  adminActions,
}: FeedPageProps) {
  const mounted = useMounted()

  // Load saved filter preferences from localStorage (only on client)
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
    viewMode:
      search.viewMode ??
      (savedViewMode === 'table' || savedViewMode === 'timeline'
        ? savedViewMode
        : undefined) ??
      'table',
  }

  // Normalize empty arrays to undefined so they don't filter anything
  const normalizeFilter = <T,>(value: T[] | undefined): T[] | undefined => {
    return value && value.length > 0 ? value : undefined
  }

  const viewMode = effectiveFilters.viewMode ?? 'table'
  const isTimelineMode = viewMode === 'timeline'

  const feedQuery = useFeedQuery({
    page: effectiveFilters.page ?? 1,
    pageSize: effectiveFilters.pageSize ?? 50,
    filters: {
      sources: normalizeFilter(effectiveFilters.sources),
      libraries: normalizeFilter(effectiveFilters.libraries),
      categories: normalizeFilter(effectiveFilters.categories),
      partners: normalizeFilter(effectiveFilters.partners),
      tags: normalizeFilter(effectiveFilters.tags),
      releaseLevels: normalizeFilter(effectiveFilters.releaseLevels),
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden,
    },
  })

  const feedInfiniteQuery = useFeedInfiniteQuery({
    pageSize: effectiveFilters.pageSize ?? 50,
    filters: {
      sources: normalizeFilter(effectiveFilters.sources),
      libraries: normalizeFilter(effectiveFilters.libraries),
      categories: normalizeFilter(effectiveFilters.categories),
      partners: normalizeFilter(effectiveFilters.partners),
      tags: normalizeFilter(effectiveFilters.tags),
      releaseLevels: normalizeFilter(effectiveFilters.releaseLevels),
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden,
    },
  })

  // Fetch facet counts based on current filters
  const facetCountsQuery = useQuery(
    getFeedFacetCountsQueryOptions({
      sources: effectiveFilters.sources,
      libraries: effectiveFilters.libraries,
      categories: effectiveFilters.categories as any,
      partners: effectiveFilters.partners,
      tags: effectiveFilters.tags,
      releaseLevels: effectiveFilters.releaseLevels as any,
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden: adminActions !== undefined, // Admin sees all
    }),
  )

  const handleFiltersChange = (newFilters: Partial<FeedFiltersState>): void => {
    onNavigate({
      search: {
        ...search,
        ...newFilters,
        page: 1,
      },
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
    onNavigate({
      search: {
        page: FEED_DEFAULTS.page,
        pageSize: effectiveFilters.pageSize ?? FEED_DEFAULTS.pageSize,
        viewMode: effectiveFilters.viewMode ?? FEED_DEFAULTS.viewMode,
        sources: undefined,
        libraries: undefined,
        categories: undefined,
        partners: undefined,
        tags: undefined,
        releaseLevels: undefined,
        includePrerelease: undefined,
        featured: undefined,
        search: undefined,
      },
      replace: true,
    })

    if (typeof window !== 'undefined') {
      localStorage.removeItem('feedFilters')
      setSavedFilters(null)
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    onNavigate({
      search: {
        ...search,
        pageSize: newPageSize,
        page: 1,
      },
      replace: true,
      resetScroll: false,
    })
  }

  const handleViewModeChange = (viewMode: 'table' | 'timeline') => {
    onNavigate({
      search: {
        ...search,
        viewMode,
      },
      replace: true,
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('feedViewMode', viewMode)
    }
  }

  const handleExpandedChange = (expandedIds: string[]) => {
    onNavigate({
      search: {
        ...search,
        expanded: expandedIds.length > 0 ? expandedIds : undefined,
      },
      replace: true,
      resetScroll: false,
    })
  }

  const handlePageChange = (page: number) => {
    onNavigate({
      search: {
        ...search,
        page,
      },
      replace: true,
      resetScroll: false,
    })
  }

  const currentPage = effectiveFilters.page ?? 1
  const pageSize = effectiveFilters.pageSize ?? 50

  // Convert FeedFiltersState to FeedFilters format
  const feedFilters = useMemo(
    () => ({
      libraries: normalizeFilter(effectiveFilters.libraries),
      categories: normalizeFilter(effectiveFilters.categories) as any,
      partners: normalizeFilter(effectiveFilters.partners),
      tags: normalizeFilter(effectiveFilters.tags),
      releaseLevels: normalizeFilter(effectiveFilters.releaseLevels) as any,
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden: adminActions !== undefined,
    }),
    [
      effectiveFilters.libraries,
      effectiveFilters.categories,
      effectiveFilters.partners,
      effectiveFilters.tags,
      effectiveFilters.releaseLevels,
      effectiveFilters.includePrerelease,
      effectiveFilters.featured,
      effectiveFilters.search,
      adminActions,
    ],
  )

  return (
    <div className="p-2 sm:p-4 pb-0 flex flex-col max-w-full gap-2 sm:gap-4 relative">
      <div className="flex-1 space-y-2 sm:space-y-4 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-2 min-h-0">
        <aside className="lg:w-64 flex-shrink-0 lg:self-start sticky top-[calc(var(--navbar-height)+1rem)] z-10">
          <FeedFilters
            libraries={libraries.filter((lib): lib is import('~/libraries/types').Library => 'tagline' in lib)}
            partners={partners}
            selectedSources={effectiveFilters.sources}
            selectedLibraries={effectiveFilters.libraries}
            selectedCategories={effectiveFilters.categories}
            selectedPartners={effectiveFilters.partners}
            selectedTags={effectiveFilters.tags}
            selectedReleaseLevels={effectiveFilters.releaseLevels}
            includePrerelease={effectiveFilters.includePrerelease}
            featured={effectiveFilters.featured}
            search={effectiveFilters.search}
            facetCounts={facetCountsQuery.data}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
        </aside>
        <main className="flex-1 min-w-0 relative flex flex-col">
          <FeedList
            query={isTimelineMode ? undefined : feedQuery}
            infiniteQuery={isTimelineMode ? feedInfiniteQuery : undefined}
            filters={undefined}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            viewMode={viewMode}
            expandedIds={search.expanded}
            onExpandedChange={handleExpandedChange}
            onViewModeChange={handleViewModeChange}
            onFiltersChange={handleFiltersChange}
            adminActions={adminActions}
          />
        </main>
      </div>
    </div>
  )
}
