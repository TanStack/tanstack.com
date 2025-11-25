import * as React from 'react'
import { UseQueryResult } from '@tanstack/react-query'
import { FeedEntry } from '~/components/FeedEntry'
import { FaSpinner } from 'react-icons/fa'

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
  onPageChange: (page: number) => void
}

export function FeedList({ query, currentPage, onPageChange }: FeedListProps) {
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
    <div className="space-y-6">
      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {data.page.length} of {data.counts.total} entries
      </div>

      {/* Feed entries */}
      <div className="space-y-6">
        {data.page.map((entry) => (
          <FeedEntry key={entry._id} entry={entry} />
        ))}
      </div>

      {/* Pagination */}
      {data.counts.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {data.counts.pages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={data.isDone}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

