import * as React from 'react'
import {
  CaretDownIcon,
  CheckIcon,
  RssIcon,
  SlidersHorizontalIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  SearchInput,
} from '~/components/ds/ui'
import { categoryTextColor, libraryCategories } from '~/libraries/categories'
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

// The DS ghost Button pre-applies its hover treatment below 900px as a touch
// affordance; in this outlined toolbar that reads as a filled/"selected" state.
// Keep the DS Button but flatten it back to a plain outlined pill on mobile so
// it matches the search field. (Applied only to idle/ghost buttons — an active
// facet keeps its filled secondary look.)
const FLAT_ON_MOBILE =
  'max-[899px]:border-border-default max-[899px]:bg-transparent max-[899px]:shadow-none'

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
  // mobile expandable column (a fresh call so each slot owns its instances).
  // Each is the DS Dropdown + a DS Button trigger (ghost when idle, secondary
  // when a selection is active), matching the canonical Dropdown pattern.
  // `block` makes the triggers full-width (label left, caret right) for the
  // stacked mobile column.
  const renderFilters = (block = false) => {
    const triggerClass = block ? 'h-10 w-full justify-between' : 'h-10 shrink-0'
    return (
      <>
        <Dropdown>
          <DropdownTrigger>
            <Button
              variant={selectedLibrary ? 'secondary' : 'ghost'}
              className={twMerge(
                triggerClass,
                !selectedLibrary && FLAT_ON_MOBILE,
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
            </Button>
          </DropdownTrigger>
          <DropdownContent align="start" maxHeight="20rem">
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
              <Button
                variant={activeAuthor ? 'secondary' : 'ghost'}
                className={twMerge(
                  triggerClass,
                  !activeAuthor && FLAT_ON_MOBILE,
                )}
              >
                <span className="max-w-[16ch] truncate">
                  {activeAuthor ?? 'All authors'}
                </span>
                <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start" maxHeight="20rem">
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
              <Button
                variant={selectedYear ? 'secondary' : 'ghost'}
                className={twMerge(
                  triggerClass,
                  !selectedYear && FLAT_ON_MOBILE,
                )}
              >
                <span className="truncate">{selectedYear ?? 'All years'}</span>
                <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted" />
              </Button>
            </DropdownTrigger>
            <DropdownContent align="start" maxHeight="20rem">
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
          <Button
            variant="link"
            color="blue"
            size="sm"
            onClick={onClearAll}
            className={block ? 'w-full' : 'shrink-0'}
          >
            Clear
          </Button>
        ) : null}
      </>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput
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
          <Button
            variant="ghost"
            size="icon-md"
            aria-label="Filters"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className={twMerge(
              'relative h-10 w-10 md:hidden',
              FLAT_ON_MOBILE,
              // Expanded = active, so keep it filled on mobile too.
              mobileOpen &&
                'bg-background-subtle max-[899px]:bg-background-subtle',
            )}
          >
            <SlidersHorizontalIcon
              weight="bold"
              className="h-[18px] w-[18px]"
            />
            {hasActiveFilters ? (
              <span className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-background-surface" />
            ) : null}
          </Button>

          <Button
            as="a"
            href="/rss.xml"
            target="_blank"
            rel="noreferrer"
            title="RSS feed"
            aria-label="RSS feed"
            variant="ghost"
            size="icon-md"
            className={twMerge('h-10 w-10 shrink-0', FLAT_ON_MOBILE)}
          >
            <RssIcon weight="bold" className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>

      {/* Mobile-only expandable column: the facet dropdowns stacked full-width,
          animated open via a grid-rows height transition. */}
      <div
        className={twMerge(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none md:hidden',
          mobileOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-2 pt-3">{renderFilters(true)}</div>
        </div>
      </div>
    </div>
  )
}
