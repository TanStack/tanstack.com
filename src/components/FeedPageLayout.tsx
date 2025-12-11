import * as React from 'react'
import { ReactNode, createContext, useContext } from 'react'
import { FeedList } from '~/components/FeedList'
import { FeedFilters, FeedFacetCounts } from '~/components/FeedFilters'
import { FeedEntry } from '~/components/FeedEntry'
import { UseQueryResult } from '@tanstack/react-query'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { FaSpinner } from 'react-icons/fa'
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

interface FeedPageLayoutContextValue {
  feedQuery: UseQueryResult<any>
  facetCountsQuery: UseQueryResult<FeedFacetCounts>
  currentPage: number
  pageSize: number
  filters: FeedFiltersState
  onFiltersChange: (filters: Partial<FeedFiltersState>) => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  viewMode?: 'table' | 'timeline' | 'columns'
  onViewModeChange?: (viewMode: 'table' | 'timeline' | 'columns') => void
  expandedIds?: string[]
  onExpandedChange?: (expandedIds: string[]) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

const FeedPageLayoutContext = createContext<FeedPageLayoutContextValue | null>(
  null,
)

function useFeedPageLayout() {
  const context = useContext(FeedPageLayoutContext)
  if (!context) {
    throw new Error(
      'FeedPageLayout components must be used within FeedPageLayout.Root',
    )
  }
  return context
}

interface FeedPageLayoutRootProps {
  feedQuery: UseQueryResult<any>
  currentPage: number
  pageSize: number
  filters: FeedFiltersState
  onFiltersChange: (filters: Partial<FeedFiltersState>) => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  viewMode?: 'table' | 'timeline' | 'columns'
  onViewModeChange?: (viewMode: 'table' | 'timeline' | 'columns') => void
  expandedIds?: string[]
  onExpandedChange?: (expandedIds: string[]) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
  children: ReactNode
}

function FeedPageLayoutRoot({
  feedQuery,
  currentPage,
  pageSize,
  filters,
  onFiltersChange,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
  viewMode = 'table',
  onViewModeChange,
  expandedIds,
  onExpandedChange,
  adminActions,
  children,
}: FeedPageLayoutRootProps) {
  // Fetch facet counts based on current filters
  // Exclude sources filter when in columns mode
  const facetCountsQuery = useQuery(
    getFeedFacetCountsQueryOptions({
      sources: viewMode === 'columns' ? undefined : filters.sources,
      libraries: filters.libraries,
      categories: filters.categories as any,
      partners: filters.partners,
      tags: filters.tags,
      releaseLevels: filters.releaseLevels as any,
      includePrerelease: filters.includePrerelease,
      featured: filters.featured,
      search: filters.search,
      includeHidden: adminActions !== undefined, // Admin sees all
    }),
  )

  return (
    <FeedPageLayoutContext.Provider
      value={{
        feedQuery,
        facetCountsQuery,
        currentPage,
        pageSize,
        filters,
        onFiltersChange,
        onClearFilters,
        onPageChange,
        onPageSizeChange,
        viewMode,
        onViewModeChange,
        expandedIds,
        onExpandedChange,
        adminActions,
      }}
    >
      <div
        className={twMerge(
          'p-2 sm:p-4 pb-0 flex-1 flex flex-col max-w-full gap-2 sm:gap-4 relative',
          viewMode === 'columns'
            ? 'pr-0! h-[calc(100dvh-var(--navbar-height)-2rem)]'
            : '',
        )}
      >
        <div className="flex-1 space-y-2 sm:space-y-4 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </FeedPageLayoutContext.Provider>
  )
}

function FeedPageLayoutHeader({
  title,
  description,
  actions,
  extra,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  extra?: ReactNode
}) {
  const { feedQuery } = useFeedPageLayout()

  return (
    <header className="">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black">{title}</h1>
          {feedQuery.isFetching && (
            <FaSpinner className="animate-spin text-gray-500 dark:text-gray-400" />
          )}
        </div>
        {actions}
      </div>
      {description && (
        <p className="text-lg mt-4 text-gray-700 dark:text-gray-300">
          {description}
        </p>
      )}
      {extra && <div className="mt-4">{extra}</div>}
    </header>
  )
}

function FeedPageLayoutFilters() {
  const {
    filters,
    onFiltersChange,
    onClearFilters,
    facetCountsQuery,
    viewMode = 'table',
    onViewModeChange,
  } = useFeedPageLayout()

  return (
    <aside className="lg:w-64 flex-shrink-0 lg:self-start">
      <FeedFilters
        libraries={libraries}
        partners={partners}
        selectedSources={filters.sources}
        selectedLibraries={filters.libraries}
        selectedCategories={filters.categories}
        selectedPartners={filters.partners}
        selectedTags={filters.tags}
        selectedReleaseLevels={filters.releaseLevels}
        includePrerelease={filters.includePrerelease}
        featured={filters.featured}
        search={filters.search}
        facetCounts={facetCountsQuery.data}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
    </aside>
  )
}

function FeedPageLayoutContent({ children }: { children?: ReactNode }) {
  const {
    feedQuery,
    currentPage,
    pageSize,
    filters = {},
    onPageChange,
    onPageSizeChange,
    viewMode = 'table',
    expandedIds,
    onExpandedChange,
    onViewModeChange,
    onFiltersChange,
    adminActions,
  } = useFeedPageLayout()

  // Convert FeedFiltersState to FeedFilters format (excluding sources for columns)
  const feedFilters = React.useMemo(() => {
    if (!filters) {
      return {
        includeHidden: adminActions !== undefined,
      }
    }

    const normalizeFilter = <T,>(value: T[] | undefined): T[] | undefined => {
      return value && value.length > 0 ? value : undefined
    }

    return {
      libraries: normalizeFilter(filters.libraries),
      categories: normalizeFilter(filters.categories) as any,
      partners: normalizeFilter(filters.partners),
      tags: normalizeFilter(filters.tags),
      releaseLevels: normalizeFilter(filters.releaseLevels) as any,
      includePrerelease: filters.includePrerelease,
      featured: filters.featured,
      search: filters.search,
      includeHidden: adminActions !== undefined,
    }
  }, [filters, adminActions])

  return (
    <main className="flex-1 min-w-0 relative flex flex-col">
      <FeedList
        query={viewMode === 'columns' ? undefined : feedQuery}
        filters={viewMode === 'columns' ? feedFilters : undefined}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        viewMode={viewMode}
        expandedIds={expandedIds}
        onExpandedChange={onExpandedChange}
        onViewModeChange={onViewModeChange}
        onFiltersChange={onFiltersChange}
        adminActions={adminActions}
      />
      {children}
    </main>
  )
}

function FeedPageLayoutFooter({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

export const FeedPageLayout = {
  Root: FeedPageLayoutRoot,
  Header: FeedPageLayoutHeader,
  Filters: FeedPageLayoutFilters,
  Content: FeedPageLayoutContent,
  Footer: FeedPageLayoutFooter,
}
