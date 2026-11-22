import { useEffect, useId, useRef, useState } from 'react'
import {
  FunnelIcon,
  GridFourIcon,
  GridNineIcon,
  RowsIcon,
  XIcon,
} from '@phosphor-icons/react'
import * as v from 'valibot'
import { libraries } from '~/libraries'
import type { LibraryId } from '~/libraries/types'

export const viewModeSchema = v.picklist(['compact', 'full', 'row'])
export const groupBySchema = v.picklist(['none', 'core', 'library', 'role'])
export const sortBySchema = v.picklist([
  'none',
  'name',
  'role',
  'contributions',
])

const availableLibraries = libraries.filter((lib) => lib.visible !== false)

interface FilterProps {
  selectedLibraries: LibraryId[] | undefined
  onLibrariesChange: (libraries: LibraryId[] | undefined) => void
  onClearAll: () => void
  directory?: {
    viewMode: v.InferOutput<typeof viewModeSchema>
    groupBy: v.InferOutput<typeof groupBySchema>
    sortBy: v.InferOutput<typeof sortBySchema>
    onViewModeChange: (mode: v.InferOutput<typeof viewModeSchema>) => void
    onGroupByChange: (groupBy: v.InferOutput<typeof groupBySchema>) => void
    onSortByChange: (sortBy: v.InferOutput<typeof sortBySchema>) => void
  }
}

export function MaintainersFilter({
  selectedLibraries,
  onLibrariesChange,
  onClearAll,
  directory,
}: FilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdown = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const toggleLibrary = (libraryId: LibraryId) => {
    if (!selectedLibraries) {
      onLibrariesChange([libraryId])
      return
    }

    if (selectedLibraries.includes(libraryId)) {
      const newLibraries = selectedLibraries.filter((id) => id !== libraryId)
      onLibrariesChange(newLibraries.length > 0 ? newLibraries : undefined)
    } else {
      onLibrariesChange([...selectedLibraries, libraryId])
    }
  }

  const clearFilters = () => {
    onClearAll()
    setIsOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !dropdown.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        trigger.current?.focus()
      }
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const filterCount =
    (selectedLibraries?.length ?? 0) +
    (directory && directory.groupBy !== 'none' ? 1 : 0) +
    (directory && directory.sortBy !== 'none' ? 1 : 0)
  const label = directory ? 'Filter & Sort' : 'Filter by Library'

  return (
    <div className="pointer-events-none relative z-20 [&_button]:pointer-events-auto">
      <div className="relative flex items-center gap-3 flex-wrap">
        {directory && (
          <div className="pointer-events-auto flex items-center bg-background-elevated border border-border-default dark:border-white/20 rounded-lg">
            {(
              [
                {
                  mode: 'compact',
                  Icon: GridNineIcon,
                  title: 'Compact cards',
                  rounded: 'rounded-l-lg',
                },
                {
                  mode: 'full',
                  Icon: GridFourIcon,
                  title: 'Full cards',
                  rounded: '',
                },
                {
                  mode: 'row',
                  Icon: RowsIcon,
                  title: 'Row cards',
                  rounded: 'rounded-r-lg',
                },
              ] as const
            ).map(({ mode, Icon, title, rounded }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={directory.viewMode === mode}
                onClick={() => directory.onViewModeChange(mode)}
                className={`p-2 ${rounded} transition-colors ${
                  directory.viewMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                title={title}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        )}
        <div
          className="pointer-events-auto sm:relative"
          ref={dropdown}
          data-globe-filter
        >
          <button
            type="button"
            ref={trigger}
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-background-elevated border border-border-default dark:border-white/20 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FunnelIcon aria-hidden="true" className="w-4 h-4" />
            {label}
            {filterCount > 0 && (
              <span
                aria-hidden="true"
                className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs"
              >
                {filterCount}
              </span>
            )}
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div
              id={panelId}
              className="absolute top-full left-0 mt-2 w-full max-w-96 sm:w-96 bg-background-elevated border border-border-default dark:border-white/20 rounded-lg shadow-lg z-50"
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-sm font-medium text-text-primary">
                    {directory ? 'Filter & Sort Options' : 'Libraries'}
                  </span>
                  {filterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {directory && (
                  <>
                    <div className="mb-4">
                      <label
                        htmlFor={`${panelId}-group`}
                        className="block text-xs font-medium text-text-secondary mb-2"
                      >
                        Group By
                      </label>
                      <select
                        id={`${panelId}-group`}
                        value={directory.groupBy}
                        onChange={(event) => {
                          const result = v.safeParse(
                            groupBySchema,
                            event.target.value,
                          )
                          if (result.success)
                            directory.onGroupByChange(result.output)
                        }}
                        className="w-full px-3 py-2 text-sm bg-background-surface border border-border-default rounded-md text-text-primary"
                      >
                        <option value="none">No Grouping</option>
                        <option value="core">
                          Core vs Maintainers vs Contributors
                        </option>
                        <option value="library">By Library</option>
                        <option value="role">By Role</option>
                      </select>
                    </div>

                    {/* Sort By */}
                    <div className="mb-4">
                      <label
                        htmlFor={`${panelId}-sort`}
                        className="block text-xs font-medium text-text-secondary mb-2"
                      >
                        Sort By
                      </label>
                      <select
                        id={`${panelId}-sort`}
                        value={directory.sortBy}
                        onChange={(event) => {
                          const result = v.safeParse(
                            sortBySchema,
                            event.target.value,
                          )
                          if (result.success)
                            directory.onSortByChange(result.output)
                        }}
                        className="w-full px-3 py-2 text-sm bg-background-surface border border-border-default rounded-md text-text-primary"
                      >
                        <option value="none">No Sorting</option>
                        <option value="name">Name</option>
                        <option value="role">Role/Level</option>
                        <option value="contributions">Contributions</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  {directory && (
                    <p className="mb-2 text-xs font-medium text-text-secondary">
                      Filter by Libraries
                    </p>
                  )}
                  <div className="fade-y fade-size-y-sm grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
                    {availableLibraries.map((library) => {
                      const isSelected =
                        selectedLibraries?.includes(library.id) || false

                      const bgStyle = library.bgStyle ?? 'bg-category-tooling'

                      return (
                        <button
                          key={library.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleLibrary(library.id)}
                          className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            isSelected
                              ? `${bgStyle} text-white`
                              : `${bgStyle}/30 text-text-primary hover:${bgStyle}/40`
                          }`}
                        >
                          {library.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current filter chips */}
        <div className="flex flex-wrap gap-2">
          {selectedLibraries?.map((libraryId) => {
            const library = availableLibraries.find(
              (lib) => lib.id === libraryId,
            )
            const bgStyle = library?.bgStyle ?? 'bg-category-tooling'

            return (
              <span
                key={libraryId}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-text-primary ${bgStyle}/40`}
              >
                {library?.name || libraryId}
                <button
                  type="button"
                  aria-label={`Remove ${library?.name ?? libraryId} filter`}
                  onClick={() => toggleLibrary(libraryId)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-0.5 transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
