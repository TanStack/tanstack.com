import * as React from 'react'
import { useState } from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Library, type LibraryId } from '~/libraries'
import { partners } from '~/utils/partners'
import {
  ENTRY_TYPES,
  RELEASE_LEVELS,
  type EntryType,
  type ReleaseLevel,
  type FeedViewMode,
} from '~/db/types'
import {
  TopBarFilter,
  FilterChip,
  AddFilterButton,
  FilterDropdownSection,
  FilterCheckbox,
  ViewModeToggle,
  getFilterChipLabel,
} from '~/components/FilterComponents'

export interface FeedFacetCounts {
  entryTypes?: Record<string, number>
  libraries?: Record<string, number>
  partners?: Record<string, number>
  releaseLevels?: Record<string, number>
  prerelease?: number
  featured?: number
}

interface FeedTopBarFiltersProps {
  libraries: Library[]
  partners: typeof partners
  selectedEntryTypes?: EntryType[]
  selectedLibraries?: string[]
  selectedPartners?: string[]
  selectedTags?: string[]
  selectedReleaseLevels?: ReleaseLevel[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
  facetCounts?: FeedFacetCounts
  viewMode?: FeedViewMode
  onViewModeChange?: (viewMode: FeedViewMode) => void
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

export function FeedTopBarFilters({
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
}: FeedTopBarFiltersProps) {
  const [searchInput, setSearchInput] = useState(search || '')

  const [debouncedSearch] = useDebouncedValue(searchInput, { wait: 300 })

  React.useEffect(() => {
    onFiltersChange({ search: debouncedSearch || undefined })
  }, [debouncedSearch])

  React.useEffect(() => {
    setSearchInput(search || '')
  }, [search])

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
    onFiltersChange({ partners: updated.length > 0 ? updated : undefined })
  }

  const toggleTag = (tag: string) => {
    const current = selectedTags || []
    const updated = current.filter((t) => t !== tag)
    onFiltersChange({ tags: updated.length > 0 ? updated : undefined })
  }

  const toggleReleaseLevel = (level: ReleaseLevel) => {
    const current = selectedReleaseLevels || []
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level]
    onFiltersChange({ releaseLevels: updated.length > 0 ? updated : undefined })
  }

  const togglePrerelease = () => {
    onFiltersChange({ includePrerelease: !includePrerelease })
  }

  const toggleFeatured = () => {
    onFiltersChange({ featured: featured ? undefined : true })
  }

  const hasActiveFilters = Boolean(
    (selectedEntryTypes && selectedEntryTypes.length > 0) ||
    (selectedLibraries && selectedLibraries.length > 0) ||
    (selectedPartners && selectedPartners.length > 0) ||
    (selectedTags && selectedTags.length > 0) ||
    featured !== undefined ||
    (selectedReleaseLevels && selectedReleaseLevels.length > 0) ||
    (includePrerelease !== undefined && includePrerelease),
  )

  const visibleLibraries = libraries.filter((lib) => lib.visible !== false)

  const getLibraryNames = (ids: string[]) =>
    ids
      .map((id) => libraries.find((l) => l.id === id)?.name || id)
      .filter(Boolean)

  const getPartnerNames = (ids: string[]) =>
    ids
      .map((id) => partners.find((p) => p.id === id)?.name || id)
      .filter(Boolean)

  return (
    <TopBarFilter
      search={{
        value: searchInput,
        onChange: setSearchInput,
        placeholder: 'Search feed...',
      }}
      onClearAll={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      trailing={
        onViewModeChange && (
          <ViewModeToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            compact
          />
        )
      }
    >
      {/* Active Filter Chips */}
      {featured && (
        <FilterChip
          label="Featured"
          onRemove={() => onFiltersChange({ featured: undefined })}
        />
      )}
      {includePrerelease && (
        <FilterChip
          label="Include Prerelease"
          onRemove={() => onFiltersChange({ includePrerelease: undefined })}
        />
      )}
      {selectedReleaseLevels && selectedReleaseLevels.length > 0 && (
        <FilterChip
          label={getFilterChipLabel(
            'Levels',
            selectedReleaseLevels.map(
              (l) => l.charAt(0).toUpperCase() + l.slice(1),
            ),
          )}
          onRemove={() => onFiltersChange({ releaseLevels: undefined })}
        />
      )}
      {selectedEntryTypes && selectedEntryTypes.length > 0 && (
        <FilterChip
          label={getFilterChipLabel(
            'Types',
            selectedEntryTypes.map(
              (t) => t.charAt(0).toUpperCase() + t.slice(1),
            ),
          )}
          onRemove={() => onFiltersChange({ entryTypes: undefined })}
        />
      )}
      {selectedLibraries && selectedLibraries.length > 0 && (
        <FilterChip
          label={getFilterChipLabel(
            'Libraries',
            getLibraryNames(selectedLibraries),
          )}
          onRemove={() => onFiltersChange({ libraries: undefined })}
        />
      )}
      {selectedPartners && selectedPartners.length > 0 && (
        <FilterChip
          label={getFilterChipLabel(
            'Partners',
            getPartnerNames(selectedPartners),
          )}
          onRemove={() => onFiltersChange({ partners: undefined })}
        />
      )}
      {selectedTags &&
        selectedTags.map((tag) => (
          <FilterChip
            key={tag}
            label={`Tag: ${tag}`}
            onRemove={() => toggleTag(tag)}
          />
        ))}

      {/* Add Filter Dropdown */}
      <AddFilterButton>
        {/* Featured Toggle */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <FilterCheckbox
            label="Featured only"
            checked={featured ?? false}
            onChange={toggleFeatured}
            count={facetCounts?.featured}
          />
        </div>

        {/* Release Levels */}
        <FilterDropdownSection
          title="Release Levels"
          defaultExpanded
          onSelectAll={() =>
            onFiltersChange({ releaseLevels: ['major', 'minor', 'patch'] })
          }
          onSelectNone={() => onFiltersChange({ releaseLevels: undefined })}
          isAllSelected={
            selectedReleaseLevels?.length === RELEASE_LEVELS.length
          }
          isSomeSelected={
            selectedReleaseLevels !== undefined &&
            selectedReleaseLevels.length > 0 &&
            selectedReleaseLevels.length < RELEASE_LEVELS.length
          }
        >
          {RELEASE_LEVELS.map((level) => (
            <FilterCheckbox
              key={level}
              label={level}
              checked={selectedReleaseLevels?.includes(level) ?? false}
              onChange={() => toggleReleaseLevel(level)}
              count={facetCounts?.releaseLevels?.[level]}
              capitalize
            />
          ))}
          <FilterCheckbox
            label="Include Prerelease"
            checked={includePrerelease ?? false}
            onChange={togglePrerelease}
            count={facetCounts?.prerelease}
          />
        </FilterDropdownSection>

        {/* Entry Types */}
        <FilterDropdownSection
          title="Entry Types"
          defaultExpanded
          onSelectAll={() => onFiltersChange({ entryTypes: [...ENTRY_TYPES] })}
          onSelectNone={() => onFiltersChange({ entryTypes: undefined })}
          isAllSelected={
            selectedEntryTypes !== undefined &&
            selectedEntryTypes.length === ENTRY_TYPES.length
          }
          isSomeSelected={
            selectedEntryTypes !== undefined &&
            selectedEntryTypes.length > 0 &&
            selectedEntryTypes.length < ENTRY_TYPES.length
          }
        >
          {ENTRY_TYPES.map((entryType) => (
            <FilterCheckbox
              key={entryType}
              label={entryType}
              checked={selectedEntryTypes?.includes(entryType) ?? false}
              onChange={() => toggleEntryType(entryType)}
              count={facetCounts?.entryTypes?.[entryType]}
              capitalize
            />
          ))}
        </FilterDropdownSection>

        {/* Libraries */}
        <FilterDropdownSection
          title="Libraries"
          onSelectAll={() =>
            onFiltersChange({
              libraries: visibleLibraries.map((lib) => lib.id),
            })
          }
          onSelectNone={() => onFiltersChange({ libraries: undefined })}
          isAllSelected={
            selectedLibraries !== undefined &&
            selectedLibraries.length === visibleLibraries.length
          }
          isSomeSelected={
            selectedLibraries !== undefined &&
            selectedLibraries.length > 0 &&
            selectedLibraries.length < visibleLibraries.length
          }
        >
          {visibleLibraries.map((lib) => (
            <FilterCheckbox
              key={lib.id}
              label={lib.name}
              checked={selectedLibraries?.includes(lib.id) ?? false}
              onChange={() => toggleLibrary(lib.id)}
              count={facetCounts?.libraries?.[lib.id]}
            />
          ))}
        </FilterDropdownSection>

        {/* Partners */}
        <FilterDropdownSection
          title="Partners"
          onSelectAll={() =>
            onFiltersChange({ partners: partners.map((p) => p.id) })
          }
          onSelectNone={() => onFiltersChange({ partners: undefined })}
          isAllSelected={
            selectedPartners !== undefined &&
            selectedPartners.length === partners.length
          }
          isSomeSelected={
            selectedPartners !== undefined &&
            selectedPartners.length > 0 &&
            selectedPartners.length < partners.length
          }
        >
          {partners.map((partner) => (
            <FilterCheckbox
              key={partner.id}
              label={partner.name}
              checked={selectedPartners?.includes(partner.id) ?? false}
              onChange={() => togglePartner(partner.id)}
              count={facetCounts?.partners?.[partner.id]}
            />
          ))}
        </FilterDropdownSection>
      </AddFilterButton>
    </TopBarFilter>
  )
}
