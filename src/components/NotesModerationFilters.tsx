import * as React from 'react'
import { useState } from 'react'
import { libraries } from '~/libraries'
import {
  FilterSection,
  FilterCheckbox,
  FilterBar,
} from '~/components/FilterComponents'

interface NotesModerationFiltersProps {
  filters: {
    libraryId?: string
    isDetached?: boolean
    dateFrom?: string
    dateTo?: string
  }
  onFilterChange: (filters: any) => void
}

export function NotesModerationFilters({
  filters,
  onFilterChange,
}: NotesModerationFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
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
      libraryId: undefined,
      isDetached: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  const hasActiveFilters =
    filters.libraryId ||
    filters.isDetached ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <FilterBar
      title="Filters"
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
    >
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
          onChange={handleDetachedChange}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
          Notes where the referenced block has moved or been deleted
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
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
