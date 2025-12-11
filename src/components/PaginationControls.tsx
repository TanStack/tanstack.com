import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  totalItems: number
  filteredItems?: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  canGoPrevious: boolean
  canGoNext: boolean
  showPageSizeSelector?: boolean
  itemLabel?: string // e.g., "users", "entries"
  sticky?: boolean // If true, wraps in sticky container with consistent styling
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  filteredItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  canGoPrevious,
  canGoNext,
  showPageSizeSelector = true,
  itemLabel = 'items',
  sticky = false,
}: PaginationControlsProps) {
  const goToPreviousPage = () => {
    if (canGoPrevious) {
      onPageChange(currentPage - 1)
    }
  }

  const goToNextPage = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1)
    }
  }

  const displayCount = filteredItems ?? totalItems

  const content = (
    <div className="flex items-center justify-between flex-wrap gap-1.5">
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Showing {displayCount} of {totalItems} {itemLabel}
        {filteredItems !== undefined && filteredItems !== totalItems && (
          <span>
            {' '}
            • Page {currentPage + 1} of {totalPages}
          </span>
        )}
        {filteredItems === undefined && (
          <span>
            {' '}
            • Page {currentPage + 1} of {totalPages}
          </span>
        )}
      </div>
      <div className="flex gap-1 items-center">
        {showPageSizeSelector && (
          <>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Per page:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10)
                onPageSizeChange(next)
              }}
              className="px-1.5 py-0.5 text-xs border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          onClick={goToPreviousPage}
          disabled={!canGoPrevious}
          className="flex items-center px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-0.5"
        >
          <FaChevronLeft className="w-3 h-3" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <button
          onClick={goToNextPage}
          disabled={!canGoNext}
          className="flex items-center px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-0.5"
        >
          <span className="hidden sm:inline">Next</span>
          <FaChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )

  if (sticky) {
    return (
      <div className="sticky bottom-4 mt-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
          {content}
        </div>
      </div>
    )
  }

  return content
}
