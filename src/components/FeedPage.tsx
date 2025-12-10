import { useState, useEffect } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { Footer } from '~/components/Footer'
import {
  FeedPageLayout,
  type FeedFiltersState,
} from '~/components/FeedPageLayout'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { FeedEntry } from '~/components/FeedEntry'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'

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
  headerTitle?: React.ReactNode
  headerActions?: React.ReactNode
  headerExtra?: React.ReactNode
  showFooter?: boolean
}

export function FeedPage({
  search,
  onNavigate,
  includeHidden = false,
  adminActions,
  headerTitle,
  headerActions,
  headerExtra,
  showFooter = true,
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

  return (
    <FeedPageLayout.Root
      feedQuery={feedQuery}
      currentPage={effectiveFilters.page ?? 1}
      pageSize={effectiveFilters.pageSize ?? 50}
      filters={effectiveFilters}
      onFiltersChange={handleFiltersChange}
      onClearFilters={handleClearFilters}
      onPageChange={(page) => {
        onNavigate({
          search: {
            ...search,
            page,
          },
          replace: true,
          resetScroll: false,
        })
      }}
      onPageSizeChange={handlePageSizeChange}
      viewMode={effectiveFilters.viewMode ?? 'table'}
      onViewModeChange={handleViewModeChange}
      expandedIds={search.expanded}
      onExpandedChange={handleExpandedChange}
      adminActions={adminActions}
    >
      {headerTitle && (
        <FeedPageLayout.Header
          title={headerTitle}
          actions={headerActions}
          extra={headerExtra}
        />
      )}
      <div className="flex flex-col lg:flex-row gap-2">
        <FeedPageLayout.Filters />
        <FeedPageLayout.Content />
      </div>
      {showFooter && (
        <FeedPageLayout.Footer>
          <Footer />
        </FeedPageLayout.Footer>
      )}
    </FeedPageLayout.Root>
  )
}
