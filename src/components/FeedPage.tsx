import { useState, useEffect } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { FeedList } from '~/components/FeedList'
import { FeedTopBarFilters } from '~/components/FeedTopBarFilters'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { useFeedInfiniteQuery } from '~/hooks/useFeedInfiniteQuery'
import { FeedEntry } from '~/components/FeedEntry'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { useQuery } from '@tanstack/react-query'
import {
  getFeedFacetCountsQueryOptions,
  type FeedFilters,
} from '~/queries/feed'
import type { FeedViewMode } from '~/db/types'

// Re-export FeedFilters as FeedFiltersState for backwards compatibility
export type FeedFiltersState = FeedFilters

interface FeedPageProps {
  search: FeedFiltersState & {
    page?: number
    pageSize?: number
    viewMode?: FeedViewMode
    expanded?: string[]
  }
  onNavigate: (updates: {
    search?: Partial<
      FeedFiltersState & {
        page?: number
        pageSize?: number
        viewMode?: FeedViewMode
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
          const parsed = JSON.parse(saved)
          // Convert null values back to undefined (they were nullified for JSON serialization)
          const restored = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [
              k,
              v === null ? undefined : v,
            ]),
          )
          setSavedFilters(restored as typeof search)
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

  // Use search params directly - savedFilters is only used to restore preferences
  // when navigating back to the page (the filters are already in the URL from the
  // previous save). We only fall back to savedFilters for viewMode since that's
  // not always in the URL.
  const effectiveFilters = {
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
      entryTypes: normalizeFilter(effectiveFilters.entryTypes),
      libraries: normalizeFilter(effectiveFilters.libraries),
      partners: normalizeFilter(effectiveFilters.partners),
      tags: normalizeFilter(effectiveFilters.tags),
      releaseLevels: normalizeFilter(effectiveFilters.releaseLevels) ?? [
        ...FEED_DEFAULTS.releaseLevels,
      ],
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden,
    },
  })

  const feedInfiniteQuery = useFeedInfiniteQuery({
    pageSize: effectiveFilters.pageSize ?? 50,
    filters: {
      entryTypes: normalizeFilter(effectiveFilters.entryTypes),
      libraries: normalizeFilter(effectiveFilters.libraries),
      partners: normalizeFilter(effectiveFilters.partners),
      tags: normalizeFilter(effectiveFilters.tags),
      releaseLevels: normalizeFilter(effectiveFilters.releaseLevels) ?? [
        ...FEED_DEFAULTS.releaseLevels,
      ],
      includePrerelease: effectiveFilters.includePrerelease,
      featured: effectiveFilters.featured,
      search: effectiveFilters.search,
      includeHidden,
    },
  })

  // Fetch facet counts based on current filters
  const facetCountsQuery = useQuery(
    getFeedFacetCountsQueryOptions({
      entryTypes: effectiveFilters.entryTypes,
      libraries: effectiveFilters.libraries,
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
    // Note: JSON.stringify strips undefined values, so we need to explicitly
    // null out fields that are being cleared to overwrite saved values
    if (typeof window !== 'undefined') {
      const updatedFilters = {
        ...search,
        ...newFilters,
        page: 1,
      }
      // Convert undefined to null for JSON serialization, then back on parse
      const forStorage = Object.fromEntries(
        Object.entries(updatedFilters).map(([k, v]) => [
          k,
          v === undefined ? null : v,
        ]),
      )
      localStorage.setItem('feedFilters', JSON.stringify(forStorage))
      setSavedFilters(updatedFilters)
    }
  }

  const handleClearFilters = () => {
    onNavigate({
      search: {
        page: FEED_DEFAULTS.page,
        pageSize: effectiveFilters.pageSize ?? FEED_DEFAULTS.pageSize,
        viewMode: effectiveFilters.viewMode ?? FEED_DEFAULTS.viewMode,
        entryTypes: undefined,
        libraries: undefined,
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

  const handleViewModeChange = (viewMode: FeedViewMode) => {
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

  return (
    <div className="p-2 sm:p-4 pb-0 flex flex-col max-w-full gap-2 sm:gap-4 relative">
      <div className="w-full max-w-7xl mx-auto space-y-3">
        <FeedTopBarFilters
          libraries={libraries.filter(
            (lib): lib is import('~/libraries/types').Library =>
              'tagline' in lib,
          )}
          partners={partners}
          selectedEntryTypes={effectiveFilters.entryTypes}
          selectedLibraries={effectiveFilters.libraries}
          selectedPartners={effectiveFilters.partners}
          selectedTags={effectiveFilters.tags}
          selectedReleaseLevels={
            effectiveFilters.releaseLevels ?? [...FEED_DEFAULTS.releaseLevels]
          }
          includePrerelease={effectiveFilters.includePrerelease}
          featured={effectiveFilters.featured}
          search={effectiveFilters.search}
          facetCounts={facetCountsQuery.data}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
        />
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
