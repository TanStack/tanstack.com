import * as React from 'react'
import { useState } from 'react'
import {
  MdClose,
  MdFilterList,
  MdExpandMore,
  MdExpandLess,
} from 'react-icons/md'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Library } from '~/libraries'
import { partners } from '~/utils/partners'

export interface FeedFacetCounts {
  sources?: Record<string, number>
  categories?: Record<string, number>
  libraries?: Record<string, number>
  partners?: Record<string, number>
  releaseLevels?: Record<string, number>
  prerelease?: number
}

interface FeedFiltersProps {
  libraries: Library[]
  partners: typeof partners
  selectedSources?: string[]
  selectedLibraries?: string[] // Library IDs, not Library objects
  selectedCategories?: string[]
  selectedPartners?: string[]
  selectedTags?: string[]
  selectedReleaseLevels?: ('major' | 'minor' | 'patch')[]
  includePrerelease?: boolean
  featured?: boolean
  search?: string
  facetCounts?: FeedFacetCounts
  onFiltersChange: (filters: {
    sources?: string[]
    libraries?: (
      | 'start'
      | 'router'
      | 'query'
      | 'table'
      | 'form'
      | 'virtual'
      | 'ranger'
      | 'store'
      | 'pacer'
      | 'db'
      | 'config'
      | 'react-charts'
      | 'devtools'
      | 'create-tsrouter-app'
    )[]
    categories?: (
      | 'release'
      | 'announcement'
      | 'blog'
      | 'partner'
      | 'update'
      | 'other'
    )[]
    partners?: string[]
    tags?: string[]
    releaseLevels?: ('major' | 'minor' | 'patch')[]
    includePrerelease?: boolean
    featured?: boolean
    search?: string
  }) => void
  onClearFilters: () => void
}

const SOURCES = ['github', 'blog', 'announcement'] as const
const CATEGORIES = [
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
] as const
const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const

export function FeedFilters({
  libraries,
  partners,
  selectedSources,
  selectedLibraries,
  selectedCategories,
  selectedPartners,
  selectedTags,
  selectedReleaseLevels = ['major', 'minor'], // Default: exclude patch
  includePrerelease = true, // Default: include prerelease
  featured,
  search,
  facetCounts,
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
    partners: false,
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
      libraries: updated.length > 0 ? (updated as any) : undefined,
    })
  }

  const toggleCategory = (category: string) => {
    const current = selectedCategories || []
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    onFiltersChange({
      categories: updated.length > 0 ? (updated as any) : undefined,
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

  const toggleReleaseLevel = (
    level: 'major' | 'minor' | 'patch'
  ) => {
    const current = selectedReleaseLevels || []
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level]
    // Always pass the array, even if empty, so we can distinguish between
    // "not set" (should use defaults) and "explicitly empty" (show no releases)
    onFiltersChange({
      releaseLevels: updated,
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
  const defaultReleaseLevels = ['major', 'minor']
  const releaseLevelsDiffer =
    !selectedReleaseLevels ||
    selectedReleaseLevels.length !== defaultReleaseLevels.length ||
    !defaultReleaseLevels.every((level) =>
      selectedReleaseLevels.includes(level as any)
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

  const FilterSection = ({
    title,
    sectionKey,
    children,
    onSelectAll,
    onSelectNone,
    isAllSelected,
    isSomeSelected,
  }: {
    title: string
    sectionKey: string
    children: React.ReactNode
    onSelectAll?: () => void
    onSelectNone?: () => void
    isAllSelected?: boolean
    isSomeSelected?: boolean
  }) => {
    const isExpanded = expandedSections[sectionKey] ?? true
    const checkboxRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      if (checkboxRef.current) {
        checkboxRef.current.indeterminate = isSomeSelected === true
      }
    }, [isSomeSelected])

    const handleCheckboxChange = () => {
      if (isAllSelected) {
        onSelectNone?.()
      } else {
        onSelectAll?.()
      }
    }

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {(onSelectAll || onSelectNone) && (
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={isAllSelected ?? false}
              onChange={(e) => {
                e.stopPropagation()
                handleCheckboxChange()
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded cursor-pointer"
            />
          )}
          <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex-1"
          >
            <span>{title}</span>
            {isExpanded ? (
              <MdExpandLess className="w-4 h-4" />
            ) : (
              <MdExpandMore className="w-4 h-4" />
            )}
          </button>
        </div>
        {isExpanded && (
          <div className="mt-2 space-y-2 pl-6">{children}</div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MdFilterList className="w-5 h-5" />
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quick Filters */}
      <div className="mb-4 space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={featured ?? false}
            onChange={(e) =>
              handleFeaturedChange(e.target.checked || undefined)
            }
            className="rounded"
          />
          <span>Featured only</span>
        </label>
      </div>

      {/* Release Levels */}
      <FilterSection
        title="Release Levels"
        sectionKey="releaseLevels"
        onSelectAll={() => {
          onFiltersChange({ releaseLevels: ['major', 'minor', 'patch'] })
        }}
        onSelectNone={() => {
          onFiltersChange({ releaseLevels: [] })
        }}
        isAllSelected={
          selectedReleaseLevels?.length === RELEASE_LEVELS.length
        }
        isSomeSelected={
          selectedReleaseLevels !== undefined &&
          selectedReleaseLevels.length > 0 &&
          selectedReleaseLevels.length < RELEASE_LEVELS.length
        }
      >
        {RELEASE_LEVELS.map((level) => {
          const count = facetCounts?.releaseLevels?.[level]
          return (
            <label
              key={level}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedReleaseLevels?.includes(level) ?? false}
                onChange={() => toggleReleaseLevel(level)}
                className="rounded"
              />
              <span className="capitalize">{level}</span>
              {count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {count}
                </span>
              )}
            </label>
          )
        })}
      </FilterSection>

      {/* Include Prerelease */}
      <FilterSection
        title="Options"
        sectionKey="prerelease"
        onSelectAll={() => {
          onFiltersChange({ includePrerelease: true })
        }}
        onSelectNone={() => {
          onFiltersChange({ includePrerelease: false })
        }}
        isAllSelected={includePrerelease === true}
        isSomeSelected={false}
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={includePrerelease ?? false}
            onChange={togglePrerelease}
            className="rounded"
          />
          <span>Include Prerelease</span>
          {facetCounts?.prerelease !== undefined && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {facetCounts.prerelease}
            </span>
          )}
        </label>
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
      >
        {SOURCES.map((source) => {
          const count = facetCounts?.sources?.[source]
          return (
            <label
              key={source}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedSources?.includes(source) ?? false}
                onChange={() => toggleSource(source)}
                className="rounded"
              />
              <span className="capitalize">{source}</span>
              {count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {count}
                </span>
              )}
            </label>
          )
        })}
      </FilterSection>

      {/* Categories */}
      <FilterSection
        title="Categories"
        sectionKey="categories"
        onSelectAll={() => {
          onFiltersChange({ categories: [...CATEGORIES] as any })
        }}
        onSelectNone={() => {
          onFiltersChange({ categories: undefined })
        }}
        isAllSelected={
          selectedCategories !== undefined &&
          selectedCategories.length === CATEGORIES.length
        }
        isSomeSelected={
          selectedCategories !== undefined &&
          selectedCategories.length > 0 &&
          selectedCategories.length < CATEGORIES.length
        }
      >
        {CATEGORIES.map((category) => {
          const count = facetCounts?.categories?.[category]
          return (
            <label
              key={category}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedCategories?.includes(category) ?? false}
                onChange={() => toggleCategory(category)}
                className="rounded"
              />
              <span className="capitalize">{category}</span>
              {count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {count}
                </span>
              )}
            </label>
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
          onFiltersChange({ libraries: visibleLibraries as any })
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
      >
        {libraries
          .filter((lib) => lib.visible !== false)
          .map((library) => {
            const count = facetCounts?.libraries?.[library.id]
            return (
              <label
                key={library.id}
                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedLibraries?.includes(library.id) ?? false}
                  onChange={() => toggleLibrary(library.id)}
                  className="rounded"
                />
                <span>{library.name}</span>
                {count !== undefined && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {count}
                  </span>
                )}
              </label>
            )
          })}
      </FilterSection>

      {/* Partners */}
      <FilterSection
        title="Partners"
        sectionKey="partners"
        onSelectAll={() => {
          const activePartnerIds = partners
            .filter((p) => p.status === 'active')
            .map((p) => p.id)
          onFiltersChange({ partners: activePartnerIds })
        }}
        onSelectNone={() => {
          onFiltersChange({ partners: undefined })
        }}
        isAllSelected={
          selectedPartners !== undefined &&
          selectedPartners.length ===
            partners.filter((p) => p.status === 'active').length
        }
        isSomeSelected={
          selectedPartners !== undefined &&
          selectedPartners.length > 0 &&
          selectedPartners.length <
            partners.filter((p) => p.status === 'active').length
        }
      >
        {partners
          .filter((p) => p.status === 'active')
          .map((partner) => (
            <label
              key={partner.id}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
            >
              <input
                type="checkbox"
                checked={selectedPartners?.includes(partner.id) ?? false}
                onChange={() => togglePartner(partner.id)}
                className="rounded"
              />
              <span>{partner.name}</span>
            </label>
          ))}
      </FilterSection>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Active Filters:
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSources?.map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
              >
                {source}
                <button
                  onClick={() => toggleSource(source)}
                  className="hover:text-blue-600 dark:hover:text-blue-300"
                >
                  <MdClose className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedLibraries?.map((libId) => {
              const lib = libraries.find((l) => l.id === libId)
              return lib ? (
                <span
                  key={libId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  {lib.name}
                  <button
                    onClick={() => toggleLibrary(libId)}
                    className="hover:text-blue-600 dark:hover:text-blue-300"
                  >
                    <MdClose className="w-3 h-3" />
                  </button>
                </span>
              ) : null
            })}
            {selectedCategories?.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs"
              >
                {cat}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="hover:text-purple-600 dark:hover:text-purple-300"
                >
                  <MdClose className="w-3 h-3" />
                </button>
              </span>
            ))}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs">
                Search: {search}
                <button
                  onClick={() => handleSearchChange('')}
                  className="hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <MdClose className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
