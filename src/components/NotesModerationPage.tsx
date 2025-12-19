import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { listDocFeedbackForModerationQueryOptions } from '~/queries/docFeedback'
import { NotesModerationFilters } from './NotesModerationFilters'
import { NotesModerationList } from './NotesModerationList'
import { Spinner } from '~/components/Spinner'

export function NotesModerationPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/notes/' })

  const { data, isLoading, error } = useQuery(
    listDocFeedbackForModerationQueryOptions({
      pagination: {
        page: search.page,
        pageSize: search.pageSize,
      },
      filters: {
        type: ['note'], // Only notes
        libraryId: search.libraryId,
        isDetached: search.isDetached,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
      },
    }),
  )

  const handleFilterChange = (filters: Partial<typeof search>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...filters,
        page: 1, // Reset to first page on filter change
      }),
    })
  }

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    })
  }

  const handlePageSizeChange = (newPageSize: number) => {
    navigate({
      search: (prev) => ({
        ...prev,
        pageSize: newPageSize,
        page: 1,
      }),
    })
  }

  return (
    <div className="w-full p-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="lg:w-64 lg:flex-shrink-0">
          <NotesModerationFilters
            filters={{
              libraryId: search.libraryId,
              isDetached: search.isDetached,
              dateFrom: search.dateFrom,
              dateTo: search.dateTo,
            }}
            onFilterChange={handleFilterChange}
          />
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Notes
            </h1>
            {isLoading && (
              <Spinner className="text-gray-500 dark:text-gray-400" />
            )}
          </div>

          <NotesModerationList
            data={data}
            isLoading={isLoading}
            error={error as Error}
            page={search.page}
            pageSize={search.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>
    </div>
  )
}
