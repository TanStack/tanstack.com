import * as React from 'react'
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Library, type LibraryId } from '~/libraries'
import { partners } from '~/utils/partners'
import {
  ENTRY_TYPES,
  RELEASE_LEVELS,
  type EntryType,
  type ReleaseLevel,
} from '~/utils/feedSchema'
import {
  FilterSection,
  FilterCheckbox,
  FilterSearch,
  FilterBar,
  ViewModeToggle,
} from '~/components/FilterComponents'

export interface FeedFacetCounts {
  entryTypes?: Record<string, number>
  libraries?: Record<string, number>
  partners?: Record<string, number>
  releaseLevels?: Record<string, number>
  prerelease?: number
  featured?: number
}

interface FeedFiltersProps {
  libraries: Library[]
  partners: typeof partners
  selectedEntryTypes?: EntryType[]
  selectedLibraries?: string[] // Library IDs, not Library objects
  selectedPartners?: string[]
  selectedTags?: string[]
  selectedReleaseLevels?: ReleaseLevel[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
  facetCounts?: FeedFacetCounts
  viewMode?: 'table' | 'timeline'
  onViewModeChange?: (viewMode: 'table' | 'timeline') => void
  onFiltersChange: (filters: {
    entryTypes?: EntryType[]
    libraries?: LibraryId[]
    partners?: string[]
    tags?: string[]
    releaseLevels?: ReleaseLevel[]
    includePrerelease?: boolean
    featured?: boolean
    search?: string
  }) => void
  onClearFilters: () => void
}

export function FeedFilters({
  libraries,
  partners,
  selectedEntryTypes,
  selectedLibraries,
  selectedPartners,
  selectedTags,
  selectedReleaseLevels,
  includePrerelease,
  featured,
  search,
  facetCounts,
  viewMode = 'table',
  onViewModeChange,
  onFiltersChange,
  onClearFilters,
}: FeedFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    entryTypes: true,
    libraries: true,
    releaseLevels: true,
    prerelease: true,
    partners: true,
    tags: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const toggleEntryType = (entryType: EntryType) => {
    const current = selectedEntryTypes || []
    const updated = current.includes(entryType)
      ? current.filter((t) => t !== entryType)
      : [...current, entryType]
    onFiltersChange({ entryTypes: updated.length > 0 ? updated : undefined })
  }

  const toggleLibrary = (libraryId: string) => {
    const current = selectedLibraries || []
    const updated = current.includes(libraryId)
      ? current.filter((id) => id !== libraryId)
      : [...current, libraryId]
    onFiltersChange({
      libraries: updated.length > 0 ? (updated as Library['id'][]) : undefined,
    })
  }

  const togglePartner = (partnerId: string) => {
    const current = selectedPartners || []
    const updated = current.includes(partnerId)
      ? current.filter((id) => id !== partnerId)
      : [...current, partnerId]
    onFiltersChange({
      partners: updated.length > 0 ? updated : undefined,
    })
  }

  const toggleTag = (tag: string) => {
    const current = selectedTags || []
    const updated = current.filter((t) => t !== tag)
    onFiltersChange({
      tags: updated.length > 0 ? updated : undefined,
    })
  }

  // Local state for search input (for immediate UI updates)
  const [searchInput, setSearchInput] = useState(search || '')

  // Debounce the search input
  const [debouncedSearch] = useDebouncedValue(searchInput, {
    wait: 300,
  })

  // Update filters when debounced search changes
  React.useEffect(() => {
    onFiltersChange({ search: debouncedSearch || undefined })
  }, [debouncedSearch, onFiltersChange])

  // Sync local state with prop when search prop changes externally
  React.useEffect(() => {
    setSearchInput(search || '')
  }, [search])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
  }

  const toggleReleaseLevel = (level: 'major' | 'minor' | 'patch') => {
    const current = selectedReleaseLevels || []
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level]
    // Pass undefined when empty to show all entries
    onFiltersChange({
      releaseLevels: updated.length > 0 ? updated : undefined,
    })
  }

  const togglePrerelease = () => {
    onFiltersChange({
      includePrerelease: !includePrerelease,
    })
  }

  const handleFeaturedChange = (value: boolean | undefined) => {
    onFiltersChange({ featured: value })
  }

  const hasActiveFilters = Boolean(
    (selectedEntryTypes && selectedEntryTypes.length > 0) ||
    (selectedLibraries && selectedLibraries.length > 0) ||
    (selectedPartners && selectedPartners.length > 0) ||
    (selectedTags && selectedTags.length > 0) ||
    featured !== undefined ||
    search ||
    (selectedReleaseLevels && selectedReleaseLevels.length > 0) ||
    (includePrerelease !== undefined && !includePrerelease),
  )

  // Render filter content (shared between mobile and desktop)
  const renderFilterContent = () => (
    <>
      {/* Featured */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <FilterCheckbox
            label="Featured"
            checked={featured ?? false}
            onChange={() => handleFeaturedChange(featured ? undefined : true)}
            count={facetCounts?.featured}
          />
        </div>
      </div>

      {/* Release Levels */}
      <FilterSection
        title="Release Levels"
        sectionKey="releaseLevels"
        onSelectAll={() => {
          onFiltersChange({ releaseLevels: ['major', 'minor', 'patch'] })
        }}
        onSelectNone={() => {
          onFiltersChange({ releaseLevels: undefined })
        }}
        isAllSelected={selectedReleaseLevels?.length === RELEASE_LEVELS.length}
        isSomeSelected={
          selectedReleaseLevels !== undefined &&
          selectedReleaseLevels.length > 0 &&
          selectedReleaseLevels.length < RELEASE_LEVELS.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {RELEASE_LEVELS.map((level) => {
          const count = facetCounts?.releaseLevels?.[level]
          return (
            <FilterCheckbox
              key={level}
              label={level}
              checked={selectedReleaseLevels?.includes(level) ?? false}
              onChange={() => toggleReleaseLevel(level)}
              count={count}
              capitalize
            />
          )
        })}
        <FilterCheckbox
          label="Include Prerelease"
          checked={includePrerelease ?? false}
          onChange={togglePrerelease}
          count={facetCounts?.prerelease}
        />
      </FilterSection>

      {/* Entry Types */}
      <FilterSection
        title="Entry Types"
        sectionKey="entryTypes"
        onSelectAll={() => {
          onFiltersChange({ entryTypes: [...ENTRY_TYPES] })
        }}
        onSelectNone={() => {
          onFiltersChange({ entryTypes: undefined })
        }}
        isAllSelected={
          selectedEntryTypes !== undefined &&
          selectedEntryTypes.length === ENTRY_TYPES.length
        }
        isSomeSelected={
          selectedEntryTypes !== undefined &&
          selectedEntryTypes.length > 0 &&
          selectedEntryTypes.length < ENTRY_TYPES.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {ENTRY_TYPES.map((entryType) => {
          const count = facetCounts?.entryTypes?.[entryType]
          return (
            <FilterCheckbox
              key={entryType}
              label={entryType}
              checked={selectedEntryTypes?.includes(entryType) ?? false}
              onChange={() => toggleEntryType(entryType)}
              count={count}
              capitalize
            />
          )
        })}
      </FilterSection>

      {/* Libraries */}
      <FilterSection
        title="Libraries"
        sectionKey="libraries"
        onSelectAll={() => {
          const visibleLibraries = libraries
            .filter((lib) => lib.visible !== false)
            .map((lib) => lib.id)
          onFiltersChange({ libraries: visibleLibraries })
        }}
        onSelectNone={() => {
          onFiltersChange({ libraries: undefined })
        }}
        isAllSelected={
          selectedLibraries !== undefined &&
          selectedLibraries.length ===
            libraries.filter((lib) => lib.visible !== false).length
        }
        isSomeSelected={
          selectedLibraries !== undefined &&
          selectedLibraries.length > 0 &&
          selectedLibraries.length <
            libraries.filter((lib) => lib.visible !== false).length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {libraries
          .filter((lib) => lib.visible !== false)
          .map((lib) => {
            const count = facetCounts?.libraries?.[lib.id]
            return (
              <FilterCheckbox
                key={lib.id}
                label={lib.name}
                checked={selectedLibraries?.includes(lib.id) ?? false}
                onChange={() => toggleLibrary(lib.id)}
                count={count}
              />
            )
          })}
      </FilterSection>

      {/* Partners */}
      <FilterSection
        title="Partners"
        sectionKey="partners"
        onSelectAll={() => {
          onFiltersChange({ partners: partners.map((p) => p.id) })
        }}
        onSelectNone={() => {
          onFiltersChange({ partners: undefined })
        }}
        isAllSelected={
          selectedPartners !== undefined &&
          selectedPartners.length === partners.length
        }
        isSomeSelected={
          selectedPartners !== undefined &&
          selectedPartners.length > 0 &&
          selectedPartners.length < partners.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {partners.map((partner) => {
          const count = facetCounts?.partners?.[partner.id]
          return (
            <FilterCheckbox
              key={partner.id}
              label={partner.name}
              checked={selectedPartners?.includes(partner.id) ?? false}
              onChange={() => togglePartner(partner.id)}
              count={count}
            />
          )
        })}
      </FilterSection>

      {/* Tags */}
      {selectedTags && selectedTags.length > 0 && (
        <FilterSection
          title="Tags"
          sectionKey="tags"
          onSelectNone={() => {
            onFiltersChange({ tags: undefined })
          }}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          {selectedTags.map((tag) => (
            <FilterCheckbox
              key={tag}
              label={tag}
              checked={true}
              onChange={() => toggleTag(tag)}
            />
          ))}
        </FilterSection>
      )}
    </>
  )

  const mobileControls = (
    <>
      {onViewModeChange && (
        <ViewModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          compact
        />
      )}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
        <FilterSearch
          value={searchInput}
          onChange={handleSearchChange}
          className="px-1.5 sm:px-2 py-1 text-xs max-w-[120px] sm:max-w-[180px]"
          placeholder="Search..."
        />
      </div>
    </>
  )

  const desktopHeader = (
    <div className="flex items-center gap-2">
      {onViewModeChange && (
        <ViewModeToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      )}
    </div>
  )

  return (
    <FilterBar
      title="Filters"
      onClearFilters={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      mobileControls={mobileControls}
      desktopHeader={desktopHeader}
      viewMode={viewMode}
    >
      {/* Reset Filters Button */}
      {hasActiveFilters && (
        <div className="mb-2">
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Search - Desktop */}
      <div
        className={`mb-2 lg:block hidden ${
          viewMode === 'table' ? 'max-w-xs lg:max-w-none lg:w-full' : 'w-full'
        }`}
      >
        <FilterSearch
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full"
        />
      </div>

      {renderFilterContent()}
    </FilterBar>
  )
}
