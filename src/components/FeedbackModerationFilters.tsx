import * as React from 'react'
import { useState } from 'react'
import { libraries } from '~/libraries'
import {
  FilterSection,
  FilterCheckbox,
  FilterBar,
} from '~/components/FilterComponents'
import { DOC_FEEDBACK_STATUSES, type DocFeedbackStatus } from '~/db/types'

interface FeedbackModerationFiltersProps {
  filters: {
    status?: DocFeedbackStatus[]
    libraryId?: string
    isDetached?: boolean
    dateFrom?: string
    dateTo?: string
  }
  onFilterChange: (filters: any) => void
}

export function FeedbackModerationFilters({
  filters,
  onFilterChange,
}: FeedbackModerationFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    status: true,
    library: true,
    detached: true,
    dateRange: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const toggleStatus = (status: DocFeedbackStatus) => {
    const current = filters.status || []
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onFilterChange({
      status: updated.length > 0 ? updated : undefined,
    })
  }

  const handleLibraryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onFilterChange({
      libraryId: value || undefined,
    })
  }

  const handleDetachedChange = (checked: boolean) => {
    onFilterChange({
      isDetached: checked ? true : undefined,
    })
  }

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      dateFrom: e.target.value || undefined,
    })
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      dateTo: e.target.value || undefined,
    })
  }

  const handleClearFilters = () => {
    onFilterChange({
      status: undefined,
      libraryId: undefined,
      isDetached: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  const hasActiveFilters = Boolean(
    (filters.status && filters.status.length > 0) ||
    filters.libraryId ||
    filters.isDetached ||
    filters.dateFrom ||
    filters.dateTo,
  )

  return (
    <FilterBar
      title="Filters"
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
    >
      {/* Status Filter */}
      <FilterSection
        title="Status"
        sectionKey="status"
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {DOC_FEEDBACK_STATUSES.map((status) => {
          const statusLabels = {
            pending: 'Pending Review',
            approved: 'Approved',
            denied: 'Denied',
          }
          return (
            <FilterCheckbox
              key={status}
              label={statusLabels[status]}
              checked={filters.status?.includes(status) || false}
              onChange={() => toggleStatus(status)}
            />
          )
        })}
      </FilterSection>

      {/* Library Filter */}
      <FilterSection
        title="Library"
        sectionKey="library"
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        <select
          value={filters.libraryId || ''}
          onChange={handleLibraryChange}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Libraries</option>
          {libraries.map((lib) => (
            <option key={lib.id} value={lib.id}>
              {lib.name}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Detached Filter */}
      <FilterSection
        title="Block Status"
        sectionKey="detached"
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        <FilterCheckbox
          label="Show Detached Only"
          checked={filters.isDetached || false}
          onChange={() => handleDetachedChange(!filters.isDetached)}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Feedback where the referenced block has moved or been deleted
        </p>
      </FilterSection>

      {/* Date Range Filter */}
      <FilterSection
        title="Date Range"
        sectionKey="dateRange"
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="date-from"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              From
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={handleDateFromChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="date-to"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              To
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={handleDateToChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FilterSection>
    </FilterBar>
  )
}
