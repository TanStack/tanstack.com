import { ReactNode, createContext, useContext } from 'react'
import { FeedList } from '~/components/FeedList'
import { FeedFilters, FeedFacetCounts } from '~/components/FeedFilters'
import { FeedEntry } from '~/components/FeedEntry'
import { UseQueryResult } from '@tanstack/react-query'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { FaSpinner } from 'react-icons/fa'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

export interface FeedFiltersState {
  sources?: string[]
  libraries?: (string | readonly string[])[]
  categories?: (string | readonly string[])[]
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
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

const FeedPageLayoutContext = createContext<FeedPageLayoutContextValue | null>(
  null
)

function useFeedPageLayout() {
  const context = useContext(FeedPageLayoutContext)
  if (!context) {
    throw new Error(
      'FeedPageLayout components must be used within FeedPageLayout.Root'
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
  adminActions,
  children,
}: FeedPageLayoutRootProps) {
  // Fetch facet counts based on current filters
  const facetCountsQuery = useQuery({
    ...convexQuery(api.feed.queries.getFeedFacetCounts, {
      filters: {
        sources: filters.sources as string[] | undefined,
        libraries: Array.isArray(filters.libraries)
          ? (filters.libraries as string[])
          : undefined,
        categories: Array.isArray(filters.categories)
          ? (filters.categories as string[])
          : undefined,
        partners: filters.partners,
        tags: filters.tags,
        releaseLevels: filters.releaseLevels,
        includePrerelease: filters.includePrerelease,
        featured: filters.featured,
        search: filters.search,
        includeHidden: adminActions !== undefined, // Admin sees all
      },
    }),
  })

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
        adminActions,
      }}
    >
      <div className="flex-1 flex flex-col max-w-full min-h-screen gap-12 p-4 md:p-8 pb-0">
        <div className="flex-1 space-y-12 w-full max-w-7xl mx-auto">
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
  const { filters, onFiltersChange, onClearFilters, facetCountsQuery } =
    useFeedPageLayout()

  return (
    <aside className="lg:w-64 flex-shrink-0">
      <FeedFilters
        libraries={libraries}
        partners={partners}
        selectedSources={filters.sources}
        selectedLibraries={filters.libraries as string[] | undefined}
        selectedCategories={filters.categories as string[] | undefined}
        selectedPartners={filters.partners}
        selectedTags={filters.tags}
        selectedReleaseLevels={filters.releaseLevels}
        includePrerelease={filters.includePrerelease}
        featured={filters.featured}
        search={filters.search}
        facetCounts={facetCountsQuery.data}
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
    onPageChange,
    onPageSizeChange,
    adminActions,
  } = useFeedPageLayout()

  return (
    <main className="flex-1 min-w-0">
      <FeedList
        query={feedQuery}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
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
