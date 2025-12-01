import * as React from 'react'
import { useState } from 'react'
import { LuHelpCircle } from 'react-icons/lu'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Library, type LibraryId } from '~/libraries'
import { partners } from '~/utils/partners'
import { Tooltip } from '~/components/Tooltip'
import {
  FEED_CATEGORIES,
  RELEASE_LEVELS,
  type FeedCategory,
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
  sources?: Record<string, number>
  categories?: Record<string, number>
  libraries?: Record<string, number>
  partners?: Record<string, number>
  releaseLevels?: Record<string, number>
  prerelease?: number
  featured?: number
}

interface FeedFiltersProps {
  libraries: Library[]
  partners: typeof partners
  selectedSources?: string[]
  selectedLibraries?: string[] // Library IDs, not Library objects
  selectedCategories?: string[]
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
    sources?: string[]
    libraries?: LibraryId[]
    categories?: FeedCategory[]
    partners?: string[]
    tags?: string[]
    releaseLevels?: ReleaseLevel[]
    includePrerelease?: boolean
    featured?: boolean
    search?: string
  }) => void
  onClearFilters: () => void
}

const SOURCES = ['github', 'blog', 'announcement'] as const

export function FeedFilters({
  libraries,
  partners,
  selectedSources,
  selectedLibraries,
  selectedCategories,
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
    sources: true,
    libraries: true,
    categories: true,
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

  const toggleSource = (source: string) => {
    const current = selectedSources || []
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    onFiltersChange({ sources: updated.length > 0 ? updated : undefined })
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

  const toggleCategory = (category: FeedCategory) => {
    const current = selectedCategories || []
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    onFiltersChange({
      categories: updated.length > 0 ? (updated as FeedCategory[]) : undefined,
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
  }, [debouncedSearch])

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

  // Check if release levels differ from default (all except patch)
  const defaultReleaseLevels: ReleaseLevel[] = ['major', 'minor']
  const releaseLevelsDiffer =
    !selectedReleaseLevels ||
    selectedReleaseLevels.length !== defaultReleaseLevels.length ||
    !defaultReleaseLevels.every((level) =>
      selectedReleaseLevels.includes(level)
    )

  const hasActiveFilters =
    (selectedSources && selectedSources.length > 0) ||
    (selectedLibraries && selectedLibraries.length > 0) ||
    (selectedCategories && selectedCategories.length > 0) ||
    (selectedPartners && selectedPartners.length > 0) ||
    (selectedTags && selectedTags.length > 0) ||
    featured !== undefined ||
    search ||
    releaseLevelsDiffer ||
    (includePrerelease !== undefined && includePrerelease !== true)


  // Render filter content (shared between mobile and desktop)
  const renderFilterContent = () => (
    <>
      {/* Featured */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <FilterCheckbox
            label="Featured"
            checked={featured ?? false}
            onChange={() =>
              handleFeaturedChange(featured ? undefined : true)
            }
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
        isAllSelected={
          selectedReleaseLevels?.length === RELEASE_LEVELS.length
        }
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

      {/* Sources */}
      <FilterSection
        title="Sources"
        sectionKey="sources"
        onSelectAll={() => {
          onFiltersChange({ sources: [...SOURCES] })
        }}
        onSelectNone={() => {
          onFiltersChange({ sources: undefined })
        }}
        isAllSelected={
          selectedSources !== undefined &&
          selectedSources.length === SOURCES.length
        }
        isSomeSelected={
          selectedSources !== undefined &&
          selectedSources.length > 0 &&
          selectedSources.length < SOURCES.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {SOURCES.map((source) => {
          const count = facetCounts?.sources?.[source]
          return (
            <FilterCheckbox
              key={source}
              label={source}
              checked={selectedSources?.includes(source) ?? false}
              onChange={() => toggleSource(source)}
              count={count}
              capitalize
            />
          )
        })}
      </FilterSection>

      {/* Categories */}
      <FilterSection
        title="Categories"
        sectionKey="categories"
        onSelectAll={() => {
          onFiltersChange({ categories: [...FEED_CATEGORIES] })
        }}
        onSelectNone={() => {
          onFiltersChange({ categories: undefined })
        }}
        isAllSelected={
          selectedCategories !== undefined &&
          selectedCategories.length === FEED_CATEGORIES.length
        }
        isSomeSelected={
          selectedCategories !== undefined &&
          selectedCategories.length > 0 &&
          selectedCategories.length < FEED_CATEGORIES.length
        }
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      >
        {FEED_CATEGORIES.map((category) => {
          const count = facetCounts?.categories?.[category]
          return (
            <FilterCheckbox
              key={category}
              label={category}
              checked={selectedCategories?.includes(category) ?? false}
              onChange={() => toggleCategory(category)}
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0"
      >
        <FilterSearch
          value={searchInput}
          onChange={handleSearchChange}
          className="px-1.5 sm:px-2 py-1 text-xs max-w-[120px] sm:max-w-[180px]"
          placeholder="Search..."
        />
      </div>
    </>
  )

  const desktopHeader = onViewModeChange && (
    <div className="flex items-center gap-2">
      <Tooltip
        content={
          <div className="max-w-xs">
            <div className="font-semibold mb-1">Feed</div>
            <div className="text-gray-300">
              Stay up to date with all TanStack updates, releases,
              announcements, and blog posts
            </div>
          </div>
        }
        placement="right"
      >
        <LuHelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
      </Tooltip>
      <ViewModeToggle
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
    </div>
  )

  return (
    <FilterBar
      title="Filters"
      onClearFilters={onClearFilters}
      hasActiveFilters={hasActiveFilters}
      mobileControls={mobileControls}
      desktopHeader={desktopHeader}
    >
      {/* Search - Desktop */}
      <div className={`mb-2 lg:block hidden ${viewMode === 'table' ? 'max-w-xs lg:max-w-none lg:w-full' : 'w-full'}`}>
        <FilterSearch value={searchInput} onChange={handleSearchChange} className="w-full" />
      </div>

      {renderFilterContent()}
    </FilterBar>
  )
}
