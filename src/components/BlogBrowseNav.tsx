import * as React from 'react'
import { CaretDownIcon, RssIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { BlogAuthorFilter } from '~/components/BlogAuthorFilter'
import { BlogSearchFilter } from '~/components/BlogSearchFilter'
import { Eyebrow } from '~/components/ds/ui'
import { categoryTextColor, libraryCategories } from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'
import type { LibrarySlim } from '~/libraries'

export type BlogTopic = { library: LibrarySlim; count: number }
export type BlogYear = { year: string; count: number }

type BlogBrowseNavProps = {
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
  /** Scopes the search input's `id` so the desktop and mobile copies of this
   *  nav don't collide on duplicate ids. */
  idPrefix: string
}

const rowClassName =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors'

function rowStateClass(isActive: boolean) {
  return isActive
    ? 'bg-blue-500/10 font-semibold text-blue-700 dark:text-blue-300'
    : 'text-text-secondary hover:bg-surface-state-hover'
}

// The count rides alongside the label in parens (ragged right edge) rather than
// right-aligned in its own column.
function Count({ value }: { value: number }) {
  return <span className="text-text-muted"> ({value})</span>
}

// A collapsible section header (Eyebrow + chevron) for progressive disclosure.
function DisclosureSummary({ label }: { label: string }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
      <Eyebrow tone="muted">{label}</Eyebrow>
      <CaretDownIcon className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
    </summary>
  )
}

export function BlogBrowseNav({
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
  idPrefix,
}: BlogBrowseNavProps) {
  // Progressive disclosure: Topics and Archive start collapsed, but open on
  // mount if that facet already has an active selection.
  const [topicsOpen, setTopicsOpen] = React.useState(Boolean(selectedLibrary))
  const [archiveOpen, setArchiveOpen] = React.useState(Boolean(selectedYear))

  return (
    <nav
      aria-label="Browse the blog"
      className="space-y-5 [&>*+*]:border-t [&>*+*]:border-border-subtle [&>*+*]:pt-5"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BlogSearchFilter
            id={`${idPrefix}-search`}
            value={searchQuery}
            onChange={onSearchChange}
            className="flex-1"
          />
          <a
            href="/rss.xml"
            target="_blank"
            rel="noreferrer"
            title="RSS feed"
            aria-label="RSS feed"
            className="shrink-0 rounded-md border border-border-subtle p-2 text-text-muted transition-colors hover:bg-surface-state-hover hover:text-text-primary"
          >
            <RssIcon className="h-4 w-4" />
          </a>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <details
        className="group"
        open={topicsOpen}
        onToggle={(event) => setTopicsOpen(event.currentTarget.open)}
      >
        <DisclosureSummary label="Topics" />
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
                className={twMerge(rowClassName, rowStateClass(isActive))}
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

      <div>
        <Eyebrow tone="muted" className="mb-2">
          Author
        </Eyebrow>
        <BlogAuthorFilter
          authors={authors}
          selected={selectedAuthor}
          onSelect={onAuthorChange}
        />
      </div>

      {years.length ? (
        <details
          className="group"
          open={archiveOpen}
          onToggle={(event) => setArchiveOpen(event.currentTarget.open)}
        >
          <DisclosureSummary label="Archive" />
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
