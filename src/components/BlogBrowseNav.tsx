import * as React from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { Eyebrow } from '~/components/ds/ui'
import {
  categoryTextColor,
  libraryCategories,
  type LibraryCategory,
} from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'
import type { LibrarySlim } from '~/libraries'

export type BlogTopic = { library: LibrarySlim; count: number }
export type BlogYear = { year: string; count: number }

type FilterPanel = 'topics' | 'author' | 'archive'

type BlogBrowseNavProps = {
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

const rowClassName =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-[color,background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.98]'

function rowStateClass(isActive: boolean) {
  return isActive
    ? 'bg-blue-500/10 font-semibold text-blue-700 dark:text-blue-300'
    : 'text-text-secondary hover:bg-surface-state-hover'
}

// A selected topic row is tinted to its library's category rather than the
// generic blue the other facets use. Written as literal classes so Tailwind's
// JIT emits each category utility.
const categoryActiveRow: Record<LibraryCategory, string> = {
  framework: 'bg-category-framework/10 font-semibold text-category-framework',
  data: 'bg-category-data/10 font-semibold text-category-data',
  ui: 'bg-category-ui/10 font-semibold text-category-ui',
  performance:
    'bg-category-performance/10 font-semibold text-category-performance',
  tooling: 'bg-category-tooling/10 font-semibold text-category-tooling',
}

// The count rides alongside the label in parens (ragged right edge) rather than
// right-aligned in its own column.
function Count({ value }: { value: number }) {
  return <span className="text-text-muted"> ({value})</span>
}


// A collapsible section header (Eyebrow + chevron) for progressive disclosure.
// When collapsed, the current selection rides alongside the label so the active
// filter stays visible without expanding; it hides on open, where the
// highlighted row already carries it. A non-default selection is tinted to read
// as active.
function DisclosureSummary({
  label,
  value,
  isActive,
  icon,
  activeClassName,
}: {
  label: string
  value: string
  isActive: boolean
  /** Rendered before the value when active (e.g. the selected library icon). */
  icon?: React.ReactNode
  /** Color treatment for an active selection; defaults to blue. Topics passes
   *  its library-category color here. */
  activeClassName?: string
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 items-center gap-2">
        <Eyebrow tone="muted">{label}</Eyebrow>
        <span
          className={twMerge(
            'flex min-w-0 items-center gap-2 truncate text-sm group-open:hidden',
            isActive
              ? (activeClassName ??
                  'font-medium text-blue-600 dark:text-blue-400')
              : 'text-text-muted',
          )}
        >
          {isActive ? icon : null}
          <span className="truncate">{value}</span>
        </span>
      </span>
      <CaretDownIcon className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
    </summary>
  )
}

export function BlogBrowseNav({
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
}: BlogBrowseNavProps) {
  // The three facet panels behave as an accordion: every facet starts collapsed,
  // and opening one closes the others. Selections persist regardless — they live
  // in the URL, not the panel's open state — and stay legible in the collapsed
  // header (see DisclosureSummary).
  const [openPanel, setOpenPanel] = React.useState<FilterPanel | null>(null)
  const togglePanel = (panel: FilterPanel) => (open: boolean) =>
    setOpenPanel((current) =>
      open ? panel : current === panel ? null : current,
    )

  // Ignore URL values that don't correspond to a real author in the list.
  const activeAuthor =
    selectedAuthor && authors.includes(selectedAuthor)
      ? selectedAuthor
      : undefined

  // Current-selection labels shown in each collapsed section header.
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

  return (
    <nav
      aria-label="Browse the blog"
      className="space-y-5 [&>*+*]:border-t [&>*+*]:border-border-subtle [&>*+*]:pt-5"
    >
      {hasActiveFilters ? (
        <div>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      <details
        className="group ts-accordion"
        open={openPanel === 'topics'}
        onToggle={(event) => togglePanel('topics')(event.currentTarget.open)}
      >
        <DisclosureSummary
          label="Topics"
          value={topicLabel}
          isActive={Boolean(selectedLibrary)}
          icon={
            SelectedTopicIcon ? (
              <SelectedTopicIcon className="h-4 w-4 shrink-0" />
            ) : undefined
          }
          activeClassName={
            selectedTopicCategory
              ? twMerge(
                  'font-semibold',
                  categoryTextColor[selectedTopicCategory],
                )
              : undefined
          }
        />
        <div className="mt-2 space-y-0.5">
          <button
            type="button"
            aria-pressed={!selectedLibrary}
            onClick={() => onLibraryToggle(undefined)}
            className={twMerge(rowClassName, rowStateClass(!selectedLibrary))}
          >
            <span className="truncate">
              All topics
              <Count value={totalCount} />
            </span>
          </button>
          {topics.map(({ library, count }) => {
            const Icon = libraryIcons[library.id] ?? fallbackLibraryIcon
            const category = libraryCategories[library.id] ?? 'tooling'
            const isActive = selectedLibrary === library.id
            return (
              <button
                key={library.id}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  onLibraryToggle(isActive ? undefined : library.id)
                }
                className={twMerge(
                  rowClassName,
                  isActive
                    ? categoryActiveRow[category]
                    : 'text-text-secondary hover:bg-surface-state-hover',
                )}
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
              </button>
            )
          })}
        </div>
      </details>

      {authors.length ? (
        <details
          className="group ts-accordion"
          open={openPanel === 'author'}
          onToggle={(event) => togglePanel('author')(event.currentTarget.open)}
        >
          <DisclosureSummary
            label="Author"
            value={activeAuthor ?? 'All authors'}
            isActive={Boolean(activeAuthor)}
          />
          <div className="mt-2 space-y-0.5">
            <button
              type="button"
              aria-pressed={!activeAuthor}
              onClick={() => onAuthorChange(undefined)}
              className={twMerge(rowClassName, rowStateClass(!activeAuthor))}
            >
              <span className="truncate">All authors</span>
            </button>
            {authors.map((name) => {
              const isActive = activeAuthor === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onAuthorChange(isActive ? undefined : name)}
                  className={twMerge(rowClassName, rowStateClass(isActive))}
                >
                  <span className="truncate">{name}</span>
                </button>
              )
            })}
          </div>
        </details>
      ) : null}

      {years.length ? (
        <details
          className="group ts-accordion"
          open={openPanel === 'archive'}
          onToggle={(event) => togglePanel('archive')(event.currentTarget.open)}
        >
          <DisclosureSummary
            label="Archive"
            value={selectedYear ?? 'All years'}
            isActive={Boolean(selectedYear)}
          />
          <div className="mt-2 space-y-0.5">
            {years.map(({ year, count }) => {
              const isActive = selectedYear === year
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onYearToggle(isActive ? undefined : year)}
                  className={twMerge(rowClassName, rowStateClass(isActive))}
                >
                  <span className="truncate">
                    {year}
                    <Count value={count} />
                  </span>
                </button>
              )
            })}
          </div>
        </details>
      ) : null}
    </nav>
  )
}
