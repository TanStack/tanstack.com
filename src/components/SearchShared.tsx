import * as React from 'react'
import { Command } from 'cmdk'
import { twMerge } from 'tailwind-merge'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from './Dropdown'
import { Snippet, Configure, useInstantSearch } from 'react-instantsearch'
import { liteClient } from 'algoliasearch/lite'
import { CaretDownIcon, ArrowElbowDownLeftIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useSearchContext } from '~/contexts/SearchContext'
import { publicLibraries, type Framework } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { capitalize } from '~/utils/utils'
import { usePersistFrameworkPreference } from './FrameworkSelect'
import { shouldPersistFrameworkForHit } from '~/utils/searchRecords'
import { getRoutableInternalLinkTarget, isSafeHref } from '~/utils/url-boundary'

/**
 * Safely decode HTML entities without using innerHTML.
 * Only decodes common entities that appear in Algolia search results.
 */
function decodeHtmlEntities(str: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  }

  return str.replace(
    /&(?:#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z]+);/g,
    (match) => entities[match] ?? match,
  )
}

// Algolia hit types - our docs-specific shape
interface AlgoliaHierarchy {
  lvl0?: string
  lvl1?: string
  lvl2?: string
  lvl3?: string
  lvl4?: string
  lvl5?: string
  lvl6?: string
  [key: string]: string | undefined
}

interface AlgoliaHighlightResult {
  value?: string
  matchLevel?: string
  matchedWords?: string[]
}

// Docs-specific hit shape from Algolia
// Using Record for flexibility with the Algolia SDK types
export interface AlgoliaHit extends Record<string, unknown> {
  objectID: string
  url: string
  url_without_anchor?: string
  urlWithAnchor?: string
  library?: string
  framework?: string
  routeStyle?: string
  hierarchy?: AlgoliaHierarchy
  content?: string
  type?: string
  __position: number
  __queryID?: string
  _highlightResult?: Record<string, unknown>
  _snippetResult?: Record<string, unknown>
}

type SearchHitPageFields = {
  url: string
  url_without_anchor?: string
  urlWithAnchor?: string
}

function getSearchHitPageKey(hit: SearchHitPageFields) {
  const hitUrl = hit.url_without_anchor ?? hit.urlWithAnchor ?? hit.url

  try {
    const url = new URL(hitUrl, 'https://tanstack.com')
    return `${url.origin}${decodeURIComponent(url.pathname)}${url.search}`
  } catch {
    return hitUrl.split('#')[0].replace(/%40/gi, '@')
  }
}

export function dedupeSearchHitsByPage<THit extends SearchHitPageFields>(
  hits: THit[],
) {
  const seenPageKeys = new Set<string>()

  return hits.filter((hit) => {
    const pageKey = getSearchHitPageKey(hit)

    if (seenPageKeys.has(pageKey)) {
      return false
    }

    seenPageKeys.add(pageKey)
    return true
  })
}

// Custom Highlight component that decodes HTML entities
function DecodedHighlight({
  attribute,
  hit,
}: {
  attribute: string
  hit: AlgoliaHit
}) {
  // Navigate nested paths for both raw value and highlight result
  const getNestedValue = (
    obj: Record<string, unknown> | undefined,
    path: string,
  ): unknown => {
    let current: unknown = obj
    for (const key of path.split('.')) {
      if (current == null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }

  const highlighted = (
    getNestedValue(
      hit._highlightResult as Record<string, unknown>,
      attribute,
    ) as AlgoliaHighlightResult | undefined
  )?.value
  const raw = getNestedValue(
    hit as unknown as Record<string, unknown>,
    attribute,
  ) as string | undefined

  if (!highlighted) {
    return <>{decodeHtmlEntities(raw || '')}</>
  }

  // Parse the highlighted string and decode entities while preserving <mark> tags
  // First, preserve mark tags with placeholders
  const withPlaceholders = highlighted
    .replace(/<mark>/g, '###MARK###')
    .replace(/<\/mark>/g, '###/MARK###')

  // Decode HTML entities
  const decoded = decodeHtmlEntities(withPlaceholders)

  // Strip any other HTML tags for security (only allow mark tags)
  const sanitized = decoded.replace(/<[^>]*>/g, '')

  // Restore mark tags
  const final = sanitized
    .replace(/###MARK###/g, '<mark>')
    .replace(/###\/MARK###/g, '</mark>')

  return <span dangerouslySetInnerHTML={{ __html: final }} />
}

export const searchClient = liteClient(
  'FQ0DQ6MA3C',
  '10c34d6a5c89f6048cf644d601e65172',
)
export const searchIndexName = 'tanstack-test'
const DEFAULT_SEARCH_FRAMEWORK: Framework = 'react'

function buildSearchFilters({
  selectedLibrary,
  selectedFramework,
}: {
  selectedLibrary: string
  selectedFramework: string
}) {
  const filterParts: string[] = ['(version:latest OR version:all)']

  if (selectedLibrary) {
    filterParts.push(`library:${selectedLibrary}`)
  }

  if (selectedFramework) {
    filterParts.push(`(framework:${selectedFramework} OR framework:all)`)
  }

  return filterParts.join(' AND ')
}

function getSearchableLibraries() {
  return publicLibraries.filter((library) => library.latestVersion)
}

function isFramework(value: string): value is Framework {
  return frameworkOptions.some((framework) => framework.value === value)
}

function getRouteFramework(pathname: string) {
  const pathParts = pathname.split('/').filter(Boolean)
  const frameworkIndex = pathParts.findIndex((part) => part === 'framework')

  if (frameworkIndex === -1) {
    return ''
  }

  const routeFramework = pathParts[frameworkIndex + 1]

  return routeFramework && isFramework(routeFramework) ? routeFramework : ''
}

function getSearchFilterDefaults(pathname: string) {
  const searchableLibraries = getSearchableLibraries()
  const [firstPathPart] = pathname.split('/').filter(Boolean)
  const routeLibrary = searchableLibraries.find(
    (library) => library.id === firstPathPart,
  )
  const availableFrameworks = routeLibrary
    ? routeLibrary.frameworks
    : Array.from(
        new Set(searchableLibraries.flatMap((library) => library.frameworks)),
      )
  const routeFramework = getRouteFramework(pathname)
  const selectedFramework =
    routeFramework && availableFrameworks.includes(routeFramework)
      ? routeFramework
      : availableFrameworks.includes(DEFAULT_SEARCH_FRAMEWORK)
        ? DEFAULT_SEARCH_FRAMEWORK
        : ''

  return {
    selectedLibrary: routeLibrary?.id ?? '',
    selectedFramework,
  }
}

// Context to share filter state between components
const SearchFiltersContext = React.createContext<{
  selectedLibrary: string
  selectedFramework: string
  setSelectedLibrary: (value: string) => void
  setSelectedFramework: (value: string) => void
  refineLibrary: (value: string) => void
  refineFramework: (value: string) => void
  libraryItems: Array<{
    value: string
    label: string
    isRefined: boolean
  }>
  frameworkItems: Array<{
    value: string
    label: string
    isRefined: boolean
  }>
  searchQuery: string
  setSearchQuery: (value: string) => void
  showSearchResults: boolean
  toggleShowSearchResults: () => void
  hideSearchResults: () => void
} | null>(null)

export function useSearchFilters() {
  const context = React.useContext(SearchFiltersContext)
  if (!context) {
    throw new Error(
      'useSearchFilters must be used within SearchFiltersProvider',
    )
  }
  return context
}

export function SearchFiltersProvider({
  children,
  resetFiltersOnOpen = false,
}: {
  children: React.ReactNode
  resetFiltersOnOpen?: boolean
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const defaultFilters = React.useMemo(
    () => getSearchFilterDefaults(pathname),
    [pathname],
  )
  const [selectedLibrary, setSelectedLibrary] = React.useState(
    defaultFilters.selectedLibrary,
  )
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showSearchResults, setShowSearchResults] = React.useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('search-show-results') !== 'false'
  })
  const [selectedFramework, setSelectedFramework] = React.useState(
    defaultFilters.selectedFramework,
  )

  React.useEffect(() => {
    if (!resetFiltersOnOpen) {
      return
    }

    setSelectedLibrary(defaultFilters.selectedLibrary)
    setSelectedFramework(defaultFilters.selectedFramework)
  }, [
    defaultFilters.selectedFramework,
    defaultFilters.selectedLibrary,
    resetFiltersOnOpen,
  ])

  const searchableLibraries = React.useMemo(() => getSearchableLibraries(), [])

  const selectedLibraryInfo = React.useMemo(
    () => searchableLibraries.find((library) => library.id === selectedLibrary),
    [searchableLibraries, selectedLibrary],
  )

  const availableFrameworkValues = React.useMemo(() => {
    if (selectedLibraryInfo) {
      return selectedLibraryInfo.frameworks
    }

    return Array.from(
      new Set(searchableLibraries.flatMap((library) => library.frameworks)),
    )
  }, [searchableLibraries, selectedLibraryInfo])

  React.useEffect(() => {
    if (!selectedLibraryInfo || !selectedFramework) {
      return
    }

    if (
      !selectedLibraryInfo.frameworks.some(
        (framework) => framework === selectedFramework,
      )
    ) {
      setSelectedFramework('')
    }
  }, [selectedFramework, selectedLibraryInfo])

  const libraryItems = searchableLibraries.map((library) => ({
    value: library.id,
    label: library.id,
    isRefined: library.id === selectedLibrary,
  }))

  const frameworkItems = frameworkOptions
    .filter((framework) => availableFrameworkValues.includes(framework.value))
    .map((framework) => ({
      value: framework.value,
      label: framework.label,
      isRefined: framework.value === selectedFramework,
    }))

  // Wrapper functions that just update state (no Algolia refine)
  const selectLibrary = React.useCallback((value: string) => {
    setSelectedLibrary(value)
  }, [])

  const selectFramework = React.useCallback((value: string) => {
    setSelectedFramework(value)
  }, [])

  const toggleShowSearchResults = React.useCallback(() => {
    setShowSearchResults((current) => {
      const next = !current
      localStorage.setItem('search-show-results', String(next))
      return next
    })
  }, [])

  const hideSearchResults = React.useCallback(() => {
    setShowSearchResults(false)
    localStorage.setItem('search-show-results', 'false')
  }, [])

  return (
    <SearchFiltersContext.Provider
      value={{
        selectedLibrary,
        selectedFramework,
        setSelectedLibrary,
        setSelectedFramework,
        refineLibrary: selectLibrary,
        refineFramework: selectFramework,
        libraryItems,
        frameworkItems,
        searchQuery,
        setSearchQuery,
        showSearchResults,
        toggleShowSearchResults,
        hideSearchResults,
      }}
    >
      {children}
    </SearchFiltersContext.Provider>
  )
}

// Component that builds dynamic filter strings for the selected search scope.
export function DynamicFilters() {
  const { selectedLibrary, selectedFramework } = useSearchFilters()

  return (
    <Configure
      attributesToRetrieve={[
        'hierarchy.lvl1',
        'hierarchy.lvl2',
        'hierarchy.lvl3',
        'hierarchy.lvl4',
        'hierarchy.lvl5',
        'hierarchy.lvl6',
        'url',
        'url_without_anchor',
        'anchor',
        'urlWithAnchor',
        'content',
        'library',
        'framework',
        'version',
        'routeStyle',
      ]}
      attributesToHighlight={[
        'hierarchy.lvl1',
        'hierarchy.lvl2',
        'hierarchy.lvl3',
        'hierarchy.lvl4',
        'hierarchy.lvl5',
        'hierarchy.lvl6',
        'content',
      ]}
      attributesToSnippet={['content:50']}
      distinct={1}
      filters={buildSearchFilters({ selectedLibrary, selectedFramework })}
    />
  )
}

export function getInternalLinkTarget(hrefValue: string) {
  return getRoutableInternalLinkTarget(hrefValue)
}

export const SafeLink = React.forwardRef(
  (
    {
      href,
      children,
      className,
      onKeyDown,
      role,
      'aria-selected': ariaSelected,
      tabIndex,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>,
    ref: React.Ref<HTMLAnchorElement>,
  ) => {
    const hrefValue = href ?? ''
    const internalTarget = getInternalLinkTarget(hrefValue)

    if (!internalTarget) {
      return (
        <a
          href={isSafeHref(hrefValue) ? href : undefined}
          className={className}
          onKeyDown={onKeyDown}
          role={role}
          aria-selected={ariaSelected}
          tabIndex={tabIndex}
          ref={ref}
          {...props}
        >
          {children}
        </a>
      )
    }

    return (
      <Link
        to={internalTarget.path}
        hash={internalTarget.hash}
        className={className}
        onKeyDown={onKeyDown}
        role={role}
        aria-selected={ariaSelected}
        tabIndex={tabIndex}
        preloadDelay={500}
        ref={ref}
        {...props}
      >
        {children}
      </Link>
    )
  },
)

export function AlgoliaAttribution() {
  return (
    <a
      href="https://www.algolia.com/developers/?utm_medium=referral&utm_content=powered_by&utm_source=tanstack.com&utm_campaign=docsearch"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 opacity-45 hover:opacity-75 transition-opacity shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="hidden sm:inline text-[10px] text-gray-400 dark:text-gray-500">
        search by
      </span>
      <img
        src="/Algolia-logo-blue.svg"
        alt="Algolia"
        className="h-2.5 w-auto dark:hidden"
      />
      <img
        src="/Algolia-logo-white.svg"
        alt="Algolia"
        className="h-2.5 w-auto hidden dark:block"
      />
    </a>
  )
}

export const Hit = ({
  hit,
  commandValue,
  isFocused,
  refinedLibrary,
  refinedFramework,
}: {
  hit: AlgoliaHit
  commandValue?: string
  isFocused?: boolean
  refinedLibrary: string | null
  refinedFramework: string | null
}) => {
  const { closeSearch } = useSearchContext()
  const navigate = useNavigate()
  const persistFramework = usePersistFrameworkPreference()

  const handleActivate = () => {
    const framework = hit.framework
    if (
      framework &&
      shouldPersistFrameworkForHit({
        url: hit.url,
        framework,
        routeStyle: hit.routeStyle,
      })
    ) {
      persistFramework(framework)
    }

    closeSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      const link = e.currentTarget as HTMLAnchorElement
      link.click()
    }
  }

  const handleClick = () => {
    handleActivate()
  }

  const handleCommandSelect = () => {
    if (!isSafeHref(hitUrl)) {
      return
    }

    handleActivate()
    const internalTarget = getInternalLinkTarget(hitUrl)
    if (internalTarget) {
      void navigate({ to: internalTarget.path, hash: internalTarget.hash })
    } else if (typeof window !== 'undefined') {
      window.location.assign(hitUrl)
    }
  }

  const ref = React.useRef<HTMLAnchorElement>(null!)

  React.useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    }
  }, [isFocused])

  // Get library and framework info for this hit
  const hitLibrary = hit.library as string | undefined
  const hitFramework =
    frameworkOptions.find((f) => f.value === hit.framework) ??
    frameworkOptions.find((f) => hit.url.includes(`/framework/${f.value}`))
  const hitLibraryInfo = hitLibrary
    ? publicLibraries.find((l) => l.id === hitLibrary)
    : null
  const hitUrl = hit.urlWithAnchor ?? hit.url

  // Build hierarchy prefix based on what's filtered
  const prefixParts: React.ReactNode[] = []

  // Show library if not filtered to one
  if (!refinedLibrary && hitLibraryInfo) {
    prefixParts.push(
      <span
        key="library"
        className={twMerge(
          'inline-flex items-center text-[11px] font-black uppercase',
          hitLibraryInfo.textStyle || 'text-gray-500 dark:text-gray-400',
        )}
      >
        {hitLibraryInfo.id}
      </span>,
    )
  }

  // Show framework if not filtered to one and hit has a framework
  if (!refinedFramework && hitFramework) {
    prefixParts.push(
      <span
        key="framework"
        className={twMerge(
          'inline-flex items-center gap-1 text-[11px] font-semibold',
          hitFramework.fontColor,
        )}
      >
        <img
          src={hitFramework.logo}
          alt={hitFramework.label}
          className="w-3 h-3"
        />
        {capitalize(hitFramework.label)}
      </span>,
    )
  }

  const hierarchyLevels = [
    'lvl1',
    'lvl2',
    'lvl3',
    'lvl4',
    'lvl5',
    'lvl6',
  ].filter((lvl) => hit.hierarchy?.[lvl])

  const content = (
    <article className="flex items-start gap-4">
      <div className="flex-1">
        <h3 className="text-xs leading-relaxed text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
          {prefixParts.length > 0 && (
            <>
              {prefixParts.map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  <span className="text-gray-400 dark:text-gray-600 text-xs">
                    ›
                  </span>
                </React.Fragment>
              ))}
            </>
          )}
          {hierarchyLevels.map((lvl, i, arr) => (
            <React.Fragment key={lvl}>
              <span className="text-gray-600 dark:text-gray-400 [&_mark]:font-semibold [&_mark]:!bg-transparent [&_mark]:text-black [&_mark]:dark:text-white [&_mark]:inline [&_mark]:!p-0 [&_mark]:!m-0 [&_mark]:!rounded-none">
                <DecodedHighlight attribute={`hierarchy.${lvl}`} hit={hit} />
              </span>
              {i < arr.length - 1 && (
                <span className="text-gray-400 dark:text-gray-600 text-xs">
                  ›
                </span>
              )}
            </React.Fragment>
          ))}
        </h3>
        {hit.content ? (
          <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2 [&_mark]:font-semibold [&_mark]:!bg-transparent [&_mark]:text-black [&_mark]:dark:text-white [&_mark]:inline [&_mark]:!p-0 [&_mark]:!m-0 [&_mark]:!rounded-none">
            <Snippet
              attribute="content"
              hit={hit as Parameters<typeof Snippet>[0]['hit']}
            />
          </p>
        ) : null}
      </div>
      {refinedFramework && hitFramework ? (
        <div className="flex-none">
          <div
            className={twMerge(
              'flex items-center gap-1 text-[11px] font-semibold',
              hitFramework.fontColor,
            )}
          >
            <img
              src={hitFramework.logo}
              alt={hitFramework.label}
              className="w-3 h-3"
            />
            {capitalize(hitFramework.label)}
          </div>
        </div>
      ) : null}
    </article>
  )

  if (commandValue) {
    return (
      <Command.Item
        value={commandValue}
        onSelect={handleCommandSelect}
        className={twMerge(
          'block cursor-pointer scroll-my-2 px-4 py-2.5 focus:outline-none border-b border-gray-300 dark:border-gray-700',
          'hover:bg-gray-500/10 data-[selected=true]:bg-gray-500/20',
        )}
        data-search-hit="true"
      >
        {content}
      </Command.Item>
    )
  }

  return (
    <SafeLink
      href={hitUrl}
      className={twMerge(
        'block px-4 py-2.5 focus:outline-none border-b border-gray-300 dark:border-gray-700',
        isFocused ? 'bg-gray-500/20' : 'hover:bg-gray-500/10',
      )}
      onKeyDown={handleKeyDown}
      onFocus={() => ref.current?.focus()}
      onClick={handleClick}
      role="option"
      aria-selected={isFocused}
      tabIndex={-1}
      data-search-hit="true"
      ref={ref}
    >
      {content}
    </SafeLink>
  )
}

type SearchScopePickerProps = {
  compact?: boolean
}

export function LibraryRefinement({ compact = false }: SearchScopePickerProps) {
  const {
    selectedLibrary,
    setSelectedLibrary,
    libraryItems: items,
  } = useSearchFilters()

  const currentLibrary = publicLibraries.find((l) => l.id === selectedLibrary)

  return (
    <Dropdown modal={false}>
      <DropdownTrigger>
        <button
          type="button"
          className={twMerge(
            'flex min-w-0 items-center gap-1 p-0.5 cursor-pointer font-bold rounded focus:ring-2 text-gray-900 dark:text-gray-100',
            compact ? 'max-w-[10rem] text-xs' : 'text-sm',
          )}
        >
          {currentLibrary ? (
            <span className="min-w-0 truncate uppercase font-black">
              <span className="opacity-50">TanStack</span>{' '}
              <span className={currentLibrary.textStyle}>
                {currentLibrary.id.toUpperCase()}
              </span>
            </span>
          ) : (
            <span className="truncate">All Libraries</span>
          )}
          <CaretDownIcon className="w-3 h-3 opacity-50 shrink-0" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="max-h-[60vh] w-64 overflow-auto">
        <DropdownItem
          onSelect={() => setSelectedLibrary('')}
          className="font-bold"
        >
          All Libraries
        </DropdownItem>
        {items.map((item) => {
          const lib = publicLibraries.find((l) => l.id === item.value)
          return (
            <DropdownItem
              key={item.value}
              onSelect={() => setSelectedLibrary(item.value)}
              className="justify-between"
            >
              <span className="uppercase font-black">
                <span className="opacity-50">TanStack</span>{' '}
                <span className={lib?.textStyle ?? ''}>
                  {item.label.toUpperCase()}
                </span>
              </span>
            </DropdownItem>
          )
        })}
      </DropdownContent>
    </Dropdown>
  )
}

export function FrameworkRefinement({
  compact = false,
}: SearchScopePickerProps) {
  const {
    selectedFramework,
    setSelectedFramework,
    frameworkItems: items,
  } = useSearchFilters()

  const persistFramework = usePersistFrameworkPreference()

  const handleSelect = (value: string) => {
    setSelectedFramework(value)
    if (value) {
      persistFramework(value)
    }
  }

  const currentFramework = frameworkOptions.find(
    (f) => f.value === selectedFramework,
  )

  return (
    <Dropdown modal={false}>
      <DropdownTrigger>
        <button
          type="button"
          className={twMerge(
            'flex min-w-0 items-center gap-1 p-0.5 font-bold rounded cursor-pointer focus:ring-2 text-gray-900 dark:text-gray-100',
            compact ? 'max-w-[9rem] text-xs' : 'text-sm',
          )}
        >
          {currentFramework && (
            <img
              src={currentFramework.logo}
              alt=""
              aria-hidden="true"
              className={twMerge(
                'shrink-0',
                compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
              )}
            />
          )}
          <span className="truncate">
            {currentFramework
              ? capitalize(currentFramework.label)
              : 'All Frameworks'}
          </span>
          <CaretDownIcon className="w-3 h-3 opacity-50 shrink-0" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="max-h-[60vh] w-52 overflow-auto">
        <DropdownItem onSelect={() => handleSelect('')} className="font-bold">
          All Frameworks
        </DropdownItem>
        {items.map((item) => {
          const fw = frameworkOptions.find((f) => f.value === item.value)
          return (
            <DropdownItem
              key={item.value}
              onSelect={() => handleSelect(item.value)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                {fw && (
                  <img
                    src={fw.logo}
                    alt=""
                    aria-hidden="true"
                    className="w-4 h-4"
                  />
                )}
                <span className="font-bold">{capitalize(item.label)}</span>
              </span>
            </DropdownItem>
          )
        })}
      </DropdownContent>
    </Dropdown>
  )
}

export function NoResults({
  refinedFramework,
  refinedLibrary,
  clearFramework,
  clearLibrary,
}: {
  refinedFramework: string | null
  refinedLibrary: string | null
  clearFramework: () => void
  clearLibrary: () => void
}) {
  const { results } = useInstantSearch()

  if (results.__isArtificial || results.nbHits > 0) {
    return null
  }

  const currentFrameworkOption = refinedFramework
    ? frameworkOptions.find((f) => f.value === refinedFramework)
    : null
  const currentLibrary = refinedLibrary
    ? publicLibraries.find((l) => l.id === refinedLibrary)
    : null

  return (
    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
      <p className="text-lg font-medium">No results found</p>
      <p className="mt-2 text-sm">
        Try adjusting your search or filters to find what you're looking for.
      </p>
      {refinedFramework && (
        <div className="mt-4 inline-flex items-center gap-2">
          <button
            onClick={clearFramework}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Search all frameworks
            {currentFrameworkOption && (
              <span className="text-xs font-normal opacity-70">
                (currently {currentFrameworkOption.label})
              </span>
            )}
          </button>
          <ArrowElbowDownLeftIcon className="w-4 h-4 animate-bounce" />
        </div>
      )}
      {!refinedFramework && refinedLibrary && (
        <div className="mt-4 inline-flex items-center gap-2">
          <button
            onClick={clearLibrary}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Search all libraries
            {currentLibrary && (
              <span className="text-xs font-normal opacity-70">
                (currently {currentLibrary.name})
              </span>
            )}
          </button>
          <ArrowElbowDownLeftIcon className="w-4 h-4 animate-bounce" />
        </div>
      )}
    </div>
  )
}
