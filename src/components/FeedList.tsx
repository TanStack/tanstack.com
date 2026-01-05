import * as React from 'react'
import {
  UseQueryResult,
  UseInfiniteQueryResult,
  InfiniteData,
} from '@tanstack/react-query'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedEntryTimeline } from '~/components/FeedEntryTimeline'
import { Spinner } from '~/components/Spinner'
import { PaginationControls } from '~/components/PaginationControls'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'
import type { FeedFilters } from '~/queries/feed'
import type { FeedViewMode } from '~/db/types'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
} from '~/components/TableComponents'

interface FeedListProps {
  query?: UseQueryResult<{
    page: FeedEntry[]
    isDone: boolean
    counts: {
      total: number
      pages: number
    }
  }>
  infiniteQuery?: UseInfiniteQueryResult<
    InfiniteData<{
      page: FeedEntry[]
      isDone: boolean
      counts: {
        total: number
        pages: number
      }
    }>
  >
  filters?: FeedFilters
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  viewMode?: FeedViewMode
  expandedIds?: string[]
  onExpandedChange?: (expandedIds: string[]) => void
  onViewModeChange?: (viewMode: FeedViewMode) => void
  onFiltersChange?: (filters: Partial<FeedFilters>) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

export function FeedList({
  query,
  infiniteQuery,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  viewMode = 'table',
  expandedIds,
  onExpandedChange,
  adminActions,
}: FeedListProps) {
  // For timeline mode, use infinite query
  const isTimelineMode = viewMode === 'timeline'
  const activeQuery = isTimelineMode ? infiniteQuery : query

  // Intersection observer for infinite scrolling in timeline mode
  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0,
    triggerOnce: false,
  })

  // Load more when intersection observer triggers in timeline mode
  React.useEffect(() => {
    if (
      isTimelineMode &&
      infiniteQuery &&
      isIntersecting &&
      infiniteQuery.hasNextPage &&
      !infiniteQuery.isFetchingNextPage &&
      !infiniteQuery.isLoading &&
      infiniteQuery.data
    ) {
      infiniteQuery.fetchNextPage()
    }
  }, [
    isTimelineMode,
    infiniteQuery,
    infiniteQuery?.hasNextPage,
    infiniteQuery?.isFetchingNextPage,
    infiniteQuery?.isLoading,
    infiniteQuery?.data,
    isIntersecting,
  ])

  // Table and timeline modes need the query
  if (!activeQuery) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          Loading feed entries...
        </p>
      </div>
    )
  }

  if (activeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="text-3xl text-gray-500" />
      </div>
    )
  }

  if (activeQuery.isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400">
          Error loading feed entries. Please try again later.
        </p>
      </div>
    )
  }

  // For timeline mode, flatten all pages from infinite query
  let allEntries: FeedEntry[] = []
  let data: {
    page: FeedEntry[]
    isDone: boolean
    counts: { total: number; pages: number }
  } | null = null

  if (isTimelineMode && infiniteQuery?.data) {
    // Flatten all pages from InfiniteData structure
    // infiniteQuery.data is InfiniteData which has a pages array
    const pages = (infiniteQuery.data as any).pages as Array<{
      page: FeedEntry[]
      isDone: boolean
      counts: { total: number; pages: number }
    }>
    allEntries = pages.flatMap((page) => page.page)
    // Use first page's counts for reference
    const firstPage = pages[0]
    data = {
      page: allEntries,
      isDone: !infiniteQuery.hasNextPage,
      counts: firstPage?.counts || { total: 0, pages: 0 },
    }
  } else if (query?.data) {
    data = query.data
    allEntries = data.page
  }

  if (!data || allEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          No feed entries found. Try adjusting your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0 relative">
      {/* Table View */}
      {viewMode === 'table' && (
        <Table>
          <TableHeader>
            <TableHeaderRow>
              <TableHeaderCell width="w-5"></TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Excerpt</TableHeaderCell>
              <TableHeaderCell>Tags</TableHeaderCell>
              {adminActions && (
                <TableHeaderCell align="right">Actions</TableHeaderCell>
              )}
            </TableHeaderRow>
          </TableHeader>
          <TableBody>
            {data.page.map((entry) => (
              <FeedEntry
                key={entry._id}
                entry={entry}
                expanded={expandedIds?.includes(entry._id) ?? false}
                onExpandedChange={(expanded) => {
                  if (!onExpandedChange) return
                  const current = expandedIds ?? []
                  if (expanded) {
                    onExpandedChange([...current, entry._id])
                  } else {
                    onExpandedChange(current.filter((id) => id !== entry._id))
                  }
                }}
                adminActions={adminActions}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {allEntries.map((entry) => (
            <FeedEntryTimeline
              key={entry._id}
              entry={entry}
              expanded={expandedIds?.includes(entry._id) ?? false}
              onExpandedChange={(expanded) => {
                if (!onExpandedChange) return
                const current = expandedIds ?? []
                if (expanded) {
                  onExpandedChange([...current, entry._id])
                } else {
                  onExpandedChange(current.filter((id) => id !== entry._id))
                }
              }}
              adminActions={adminActions}
            />
          ))}
          {/* Load more sentinel */}
          {infiniteQuery && (
            <div
              ref={loadMoreRef}
              className="py-4 flex items-center justify-center min-h-[100px]"
            >
              {infiniteQuery.isFetchingNextPage && (
                <Spinner className="text-gray-500" />
              )}
              {!infiniteQuery.hasNextPage && allEntries.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No more entries to load
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls - Bottom (Sticky) - Only for table mode */}
      {viewMode === 'table' && data && data.page.length > 0 && (
        <PaginationControls
          currentPage={currentPage - 1}
          totalPages={data.counts.pages}
          totalItems={data.counts.total}
          pageSize={pageSize}
          onPageChange={(page) => onPageChange(page + 1)}
          onPageSizeChange={onPageSizeChange}
          canGoPrevious={currentPage > 1}
          canGoNext={!data.isDone}
          itemLabel="entries"
          sticky
        />
      )}
    </div>
  )
}
