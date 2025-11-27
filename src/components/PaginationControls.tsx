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

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing {displayCount} of {totalItems} {itemLabel}
        {filteredItems !== undefined && filteredItems !== totalItems && (
          <span> • Page {currentPage + 1} of {totalPages}</span>
        )}
        {filteredItems === undefined && (
          <span> • Page {currentPage + 1} of {totalPages}</span>
        )}
      </div>
      <div className="flex gap-1 items-center">
        {showPageSizeSelector && (
          <>
            <label className="text-sm text-gray-500 dark:text-gray-400">
              Per page:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10)
                onPageSizeChange(next)
              }}
              className="px-2 py-1 text-sm border rounded-md bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
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
          className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
        >
          <FaChevronLeft className="w-3 h-3" />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <button
          onClick={goToNextPage}
          disabled={!canGoNext}
          className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <FaChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

