import * as React from 'react'
import { useState } from 'react'
import { libraries } from '~/libraries'
import {
  FilterSection,
  FilterCheckbox,
  FilterBar,
} from '~/components/FilterComponents'
import { SHOWCASE_STATUSES, type ShowcaseStatus } from '~/db/types'

interface ShowcaseModerationFiltersProps {
  filters: {
    status?: ShowcaseStatus[]
    libraryId?: string
    isFeatured?: boolean
  }
  onFilterChange: (filters: {
    status?: ShowcaseStatus[]
    libraryId?: string
    isFeatured?: boolean
  }) => void
}

export function ShowcaseModerationFilters({
  filters,
  onFilterChange,
}: ShowcaseModerationFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    status: true,
    library: true,
    featured: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const toggleStatus = (status: ShowcaseStatus) => {
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

  const handleFeaturedChange = (value: boolean | undefined) => {
    onFilterChange({
      isFeatured: value,
    })
  }

  const handleClearFilters = () => {
    onFilterChange({
      status: undefined,
      libraryId: undefined,
      isFeatured: undefined,
    })
  }

  const hasActiveFilters = Boolean(
    (filters.status && filters.status.length > 0) ||
    filters.libraryId ||
    filters.isFeatured !== undefined,
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
        {SHOWCASE_STATUSES.map((status) => {
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

      {/* Featured Filter */}
      <FilterSection
        title="Featured Status"
        sectionKey="featured"
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        <div className="space-y-2">
          <FilterCheckbox
            label="Featured Only"
            checked={filters.isFeatured === true}
            onChange={() =>
              handleFeaturedChange(
                filters.isFeatured === true ? undefined : true,
              )
            }
          />
          <FilterCheckbox
            label="Not Featured Only"
            checked={filters.isFeatured === false}
            onChange={() =>
              handleFeaturedChange(
                filters.isFeatured === false ? undefined : false,
              )
            }
          />
        </div>
      </FilterSection>
    </FilterBar>
  )
}
