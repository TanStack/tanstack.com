import * as React from 'react'
import { UseQueryResult } from '@tanstack/react-query'
import { FeedEntry } from '~/components/FeedEntry'
import { FaSpinner } from 'react-icons/fa'
import { PaginationControls } from '~/components/PaginationControls'

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
    <div className="min-w-0">
      {/* Pagination Controls - Top */}
      <div className="mb-4">
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
        />
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50">
              <th className="w-5 px-4 py-2 text-left whitespace-nowrap"></th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                Title
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                Excerpt
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                Tags
              </th>
              {adminActions && (
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.page.map((entry) => (
              <FeedEntry
                key={entry._id}
                entry={entry}
                adminActions={adminActions}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - Bottom */}
      {data.counts.pages > 1 && (
        <div className="mt-4">
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
          />
        </div>
      )}
    </div>
  )
}
