import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import { ShowcaseCard, ShowcaseCardSkeleton } from './ShowcaseCard'
import { PaginationControls } from './PaginationControls'
import { libraries } from '~/libraries'
import { SHOWCASE_USE_CASES, type ShowcaseUseCase } from '~/db/schema'
import { Plus } from 'lucide-react'
import { USE_CASE_LABELS } from '~/utils/showcase.client'
import { Button } from './Button'

export function ShowcaseGallery() {
  const navigate = useNavigate({ from: '/showcase/' })
  const search = useSearch({ from: '/showcase/' })

  const { data, isLoading } = useQuery(
    getApprovedShowcasesQueryOptions({
      pagination: {
        page: search.page,
        pageSize: 24,
      },
      filters: {
        libraryId: search.libraryId,
        useCases: search.useCases as ShowcaseUseCase[],
      },
    }),
  )

  const handleLibraryFilter = (libraryId: string | undefined) => {
    navigate({
      search: (prev: typeof search) => ({
        ...prev,
        libraryId,
        page: 1,
      }),
    })
  }

  const handleUseCaseFilter = (useCase: ShowcaseUseCase) => {
    const current = search.useCases || []
    const updated = current.includes(useCase)
      ? current.filter((c: ShowcaseUseCase) => c !== useCase)
      : [...current, useCase]
    navigate({
      search: (prev: typeof search) => ({
        ...prev,
        useCases: updated.length > 0 ? updated : undefined,
        page: 1,
      }),
    })
  }

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev: typeof search) => ({ ...prev, page: newPage + 1 }),
    })
  }

  const clearFilters = () => {
    navigate({
      search: {
        page: 1,
        libraryId: undefined,
        useCases: undefined,
      },
    })
  }

  const hasFilters =
    search.libraryId || (search.useCases && search.useCases.length > 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                Showcase
              </h1>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                Discover projects built with TanStack libraries
              </p>
            </div>
            <Button
              as={Link}
              to="/showcase/submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none"
            >
              <Plus className="w-5 h-5" />
              Submit Your Project
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-[var(--navbar-height)] z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* Library Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Library:
              </span>
              <button
                onClick={() => handleLibraryFilter(undefined)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  !search.libraryId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {libraries
                .filter((lib) => lib.name)
                .slice(0, 10)
                .map((lib) => (
                  <button
                    key={lib.id}
                    onClick={() => handleLibraryFilter(lib.id)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      search.libraryId === lib.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {lib.name?.replace('TanStack ', '')}
                  </button>
                ))}
            </div>

            {/* Use Case Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Use Case:
              </span>
              {SHOWCASE_USE_CASES.map((useCase) => (
                <button
                  key={useCase}
                  onClick={() => handleUseCaseFilter(useCase)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    search.useCases?.includes(useCase)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {USE_CASE_LABELS[useCase]}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline self-start"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShowcaseCardSkeleton key={i} />
            ))}
          </div>
        ) : data?.showcases && data.showcases.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.showcases.map(({ showcase, user }) => (
                <ShowcaseCard
                  key={showcase.id}
                  showcase={showcase}
                  user={user}
                />
              ))}
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="mt-8">
                <PaginationControls
                  currentPage={search.page - 1}
                  totalPages={data.pagination.totalPages}
                  totalItems={data.pagination.total}
                  pageSize={24}
                  onPageChange={handlePageChange}
                  onPageSizeChange={() => {}}
                  canGoPrevious={search.page > 1}
                  canGoNext={search.page < data.pagination.totalPages}
                  itemLabel="projects"
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No showcases found{hasFilters ? ' matching your filters' : ' yet'}
              .
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}
            <Button
              as={Link}
              to="/showcase/submit"
              className="inline-flex mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none"
            >
              <Plus className="w-5 h-5" />
              Submit Your Project
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
