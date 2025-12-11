import * as React from 'react'
import { UseQueryResult } from '@tanstack/react-query'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedEntryTimeline } from '~/components/FeedEntryTimeline'
import { FaSpinner } from 'react-icons/fa'
import { PaginationControls } from '~/components/PaginationControls'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
} from '~/components/TableComponents'

interface FeedListProps {
  query: UseQueryResult<{
    page: FeedEntry[]
    isDone: boolean
    counts: {
      total: number
      pages: number
    }
  }>
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  viewMode?: 'table' | 'timeline'
  expandedIds?: string[]
  onExpandedChange?: (expandedIds: string[]) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

export function FeedList({
  query,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  viewMode = 'table',
  expandedIds,
  onExpandedChange,
  adminActions,
}: FeedListProps) {
  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FaSpinner className="animate-spin text-2xl text-gray-500" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400">
          Error loading feed entries. Please try again later.
        </p>
      </div>
    )
  }

  const data = query.data

  if (!data || data.page.length === 0) {
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
          {data.page.map((entry) => (
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
        </div>
      )}

      {/* Pagination Controls - Bottom (Sticky) */}
      {data && data.page.length > 0 && (
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
