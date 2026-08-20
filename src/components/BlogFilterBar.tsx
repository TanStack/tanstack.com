import * as React from 'react'
import {
  CaretDownIcon,
  CheckIcon,
  RssIcon,
  SlidersHorizontalIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  SearchInput,
} from '~/components/ds/ui'
import {
  categoryTextColor,
  libraryCategories,
  type LibraryCategory,
} from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'
import type { LibrarySlim } from '~/libraries'

export type BlogTopic = { library: LibrarySlim; count: number }
export type BlogYear = { year: string; count: number }

type BlogFilterBarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  topics: Array<BlogTopic>
  totalCount: number
  selectedLibrary: string | undefined
  onLibraryToggle: (libraryId: string | undefined) => void
  authors: Array<string>
  selectedAuthor: string | undefined
  onAuthorChange: (author: string | undefined) => void
  years: Array<BlogYear>
  selectedYear: string | undefined
  onYearToggle: (year: string | undefined) => void
  hasActiveFilters: boolean
  onClearAll: () => void
}

// A selected topic pill is tinted to its library's category rather than the
// generic blue the other facets use. Literal classes so Tailwind's JIT emits
// each category utility.
const categoryActivePill: Record<LibraryCategory, string> = {
  framework: 'bg-category-framework/10 text-category-framework',
  data: 'bg-category-data/10 text-category-data',
  ui: 'bg-category-ui/10 text-category-ui',
  performance: 'bg-category-performance/10 text-category-performance',
  tooling: 'bg-category-tooling/10 text-category-tooling',
}

function filterTriggerClass(isActive: boolean, activeClassName?: string) {
  return twMerge(
    'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
    isActive
      ? twMerge(
          'border-transparent font-semibold',
          activeClassName ?? 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
        )
      : 'border-border-default text-text-secondary hover:bg-surface-state-hover hover:text-text-primary',
  )
}

// The count rides alongside the label in parens, matching the old browse nav.
function Count({ value }: { value: number }) {
  return <span className="text-text-muted"> ({value})</span>
}

function MenuItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <DropdownItem
      onSelect={onSelect}
      className={twMerge('justify-between', selected && 'text-text-primary')}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        {children}
      </span>
      {selected ? (
        <CheckIcon
          weight="bold"
          className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
        />
      ) : null}
    </DropdownItem>
  )
}

export function BlogFilterBar({
  searchQuery,
  onSearchChange,
  topics,
  totalCount,
  selectedLibrary,
  onLibraryToggle,
  authors,
  selectedAuthor,
  onAuthorChange,
  years,
  selectedYear,
  onYearToggle,
  hasActiveFilters,
  onClearAll,
}: BlogFilterBarProps) {
  // On narrow screens the facet dropdowns collapse behind a single toggle and
  // expand into a horizontal, scrollable row beneath the search field.
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Ignore URL author values that don't correspond to a real author.
  const activeAuthor =
    selectedAuthor && authors.includes(selectedAuthor)
      ? selectedAuthor
      : undefined

  const selectedTopic = topics.find(
    ({ library }) => library.id === selectedLibrary,
  )
  const topicLabel = selectedTopic
    ? selectedTopic.library.name.replace('TanStack ', '')
    : 'All topics'
  const selectedTopicCategory = selectedTopic
    ? (libraryCategories[selectedTopic.library.id] ?? 'tooling')
    : undefined
  const SelectedTopicIcon = selectedTopic
    ? (libraryIcons[selectedTopic.library.id] ?? fallbackLibraryIcon)
    : null

  // The facet dropdowns, rendered in both the desktop inline row and the
  // mobile expandable row (a fresh call so each slot owns its instances).
  const renderFilters = () => (
    <>
      <Dropdown>
        <DropdownTrigger>
          <button
            type="button"
            className={filterTriggerClass(
              Boolean(selectedLibrary),
              selectedTopicCategory
                ? categoryActivePill[selectedTopicCategory]
                : undefined,
            )}
          >
            {SelectedTopicIcon ? (
              <SelectedTopicIcon
                className={twMerge(
                  'h-4 w-4 shrink-0',
                  selectedTopicCategory
                    ? categoryTextColor[selectedTopicCategory]
                    : undefined,
                )}
              />
            ) : null}
            <span className="max-w-[16ch] truncate">{topicLabel}</span>
            <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted" />
          </button>
        </DropdownTrigger>
        <DropdownContent align="start" className="max-h-80 overflow-y-auto">
          <MenuItem
            selected={!selectedLibrary}
            onSelect={() => onLibraryToggle(undefined)}
          >
            <span className="truncate">
              All topics
              <Count value={totalCount} />
            </span>
          </MenuItem>
          {topics.map(({ library, count }) => {
            const Icon = libraryIcons[library.id] ?? fallbackLibraryIcon
            const category = libraryCategories[library.id] ?? 'tooling'
            const isActive = selectedLibrary === library.id
            return (
              <MenuItem
                key={library.id}
                selected={isActive}
                onSelect={() =>
                  onLibraryToggle(isActive ? undefined : library.id)
                }
              >
                <Icon
                  className={twMerge(
                    'h-4 w-4 shrink-0',
                    categoryTextColor[category],
                  )}
                />
                <span className="truncate">
                  {library.name.replace('TanStack ', '')}
                  <Count value={count} />
                </span>
              </MenuItem>
            )
          })}
        </DropdownContent>
      </Dropdown>

      {authors.length ? (
        <Dropdown>
          <DropdownTrigger>
            <button
              type="button"
              className={filterTriggerClass(Boolean(activeAuthor))}
            >
              <span className="max-w-[16ch] truncate">
                {activeAuthor ?? 'All authors'}
              </span>
              <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="max-h-80 overflow-y-auto">
            <MenuItem
              selected={!activeAuthor}
              onSelect={() => onAuthorChange(undefined)}
            >
              <span className="truncate">All authors</span>
            </MenuItem>
            {authors.map((name) => {
              const isActive = activeAuthor === name
              return (
                <MenuItem
                  key={name}
                  selected={isActive}
                  onSelect={() => onAuthorChange(isActive ? undefined : name)}
                >
                  <span className="truncate">{name}</span>
                </MenuItem>
              )
            })}
          </DropdownContent>
        </Dropdown>
      ) : null}

      {years.length ? (
        <Dropdown>
          <DropdownTrigger>
            <button
              type="button"
              className={filterTriggerClass(Boolean(selectedYear))}
            >
              <span className="truncate">{selectedYear ?? 'All years'}</span>
              <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="max-h-80 overflow-y-auto">
            <MenuItem
              selected={!selectedYear}
              onSelect={() => onYearToggle(undefined)}
            >
              <span className="truncate">All years</span>
            </MenuItem>
            {years.map(({ year, count }) => {
              const isActive = selectedYear === year
              return (
                <MenuItem
                  key={year}
                  selected={isActive}
                  onSelect={() => onYearToggle(isActive ? undefined : year)}
                >
                  <span className="truncate">
                    {year}
                    <Count value={count} />
                  </span>
                </MenuItem>
              )
            })}
          </DropdownContent>
        </Dropdown>
      ) : null}

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 px-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Clear
        </button>
      ) : null}
    </>
  )

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput
            pill
            aria-label="Search posts"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Wide screens: the facet dropdowns sit inline on the bar. */}
          <div className="hidden items-center gap-2 md:flex">
            {renderFilters()}
          </div>

          {/* Narrow screens: one toggle that expands the horizontal set below. */}
          <button
            type="button"
            aria-label="Filters"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className={twMerge(
              'relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-default text-text-secondary transition-colors hover:bg-surface-state-hover hover:text-text-primary md:hidden',
              mobileOpen && 'text-text-primary',
            )}
          >
            <SlidersHorizontalIcon
              weight="bold"
              className="h-[18px] w-[18px]"
            />
            {hasActiveFilters ? (
              <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-background-surface" />
            ) : null}
          </button>

          <a
            href="/rss.xml"
            target="_blank"
            rel="noreferrer"
            title="RSS feed"
            aria-label="RSS feed"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-default text-text-secondary transition-colors hover:bg-surface-state-hover hover:text-text-primary"
          >
            <RssIcon weight="bold" className="h-[18px] w-[18px]" />
          </a>
        </div>
      </div>

      {/* Mobile-only expandable row: a horizontal, scrollable set of the facet
          dropdowns, animated open via a grid-rows height transition. */}
      <div
        className={twMerge(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none md:hidden',
          mobileOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="fade-x fade-size-x-sm flex items-center gap-2 overflow-x-auto pt-3 scrollbar-hide">
            {renderFilters()}
          </div>
        </div>
      </div>
    </div>
  )
}
