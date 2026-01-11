import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { twMerge } from 'tailwind-merge'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from './Dropdown'
import {
  InstantSearch,
  SearchBox,
  Snippet,
  Configure,
  useMenu,
  useInstantSearch,
  useInfiniteHits,
} from 'react-instantsearch'
import { liteClient } from 'algoliasearch/lite'
import { X, Search, ChevronDown, CornerDownLeft } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useSearchContext } from '~/contexts/SearchContext'
import { libraries } from '~/libraries'
import { frameworkOptions } from '~/libraries/frameworks'
import { capitalize } from '~/utils/utils'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import {
  getStoredFrameworkPreference,
  usePersistFrameworkPreference,
} from './FrameworkSelect'

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
interface AlgoliaHit extends Record<string, unknown> {
  objectID: string
  url: string
  library?: string
  hierarchy: AlgoliaHierarchy
  content?: string
  type?: string
  __position: number
  __queryID?: string
  _highlightResult?: Record<string, unknown>
  _snippetResult?: Record<string, unknown>
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

const searchClient = liteClient(
  'FQ0DQ6MA3C',
  '10c34d6a5c89f6048cf644d601e65172',
)

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
    count: number
    isRefined: boolean
  }>
  frameworkItems: Array<{
    value: string
    label: string
    count: number
    isRefined: boolean
  }>
} | null>(null)

function useSearchFilters() {
  const context = React.useContext(SearchFiltersContext)
  if (!context) {
    throw new Error(
      'useSearchFilters must be used within SearchFiltersProvider',
    )
  }
  return context
}

function SearchFiltersProvider({ children }: { children: React.ReactNode }) {
  const userQuery = useCurrentUserQuery()
  const [selectedLibrary, setSelectedLibrary] = React.useState('')

  // Get initial framework from user preference (DB if logged in, localStorage otherwise)
  const getInitialFramework = React.useCallback(() => {
    if (userQuery.data?.lastUsedFramework) {
      return userQuery.data.lastUsedFramework
    }
    return getStoredFrameworkPreference() || ''
  }, [userQuery.data?.lastUsedFramework])

  const [selectedFramework, setSelectedFramework] =
    React.useState(getInitialFramework)

  // Use useMenu just to get the list of available options and counts
  // We do NOT use refine() because facet filters don't support OR logic
  // Instead, we build custom filter strings via Configure component
  const { items: rawLibraryItems } = useMenu({
    attribute: 'library',
    limit: 50,
  })

  const { items: rawFrameworkItems } = useMenu({
    attribute: 'framework',
    limit: 50,
  })

  // Auto-select based on current page URL
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  // Auto-select library from URL on mount
  const hasAutoSelectedLibrary = React.useRef(false)
  React.useEffect(() => {
    if (hasAutoSelectedLibrary.current) return
    const pathParts = pathname.split('/').filter(Boolean)
    const urlLibrary = libraries.find((l) => l.id === pathParts[0])
    if (urlLibrary) {
      setSelectedLibrary(urlLibrary.id)
      hasAutoSelectedLibrary.current = true
    }
  }, [pathname])

  // Auto-select framework from URL or preference on mount
  const hasAutoSelectedFramework = React.useRef(false)
  React.useEffect(() => {
    if (hasAutoSelectedFramework.current) return

    // First check URL for framework
    const frameworkMatch = pathname.match(/\/framework\/([^/]+)/)
    if (frameworkMatch) {
      setSelectedFramework(frameworkMatch[1])
      hasAutoSelectedFramework.current = true
      return
    }

    // Fall back to stored preference
    const storedFramework = getInitialFramework()
    if (storedFramework) {
      setSelectedFramework(storedFramework)
      hasAutoSelectedFramework.current = true
    }
  }, [pathname, getInitialFramework])

  // Sort items by their defined order and filter out "all" from display
  const libraryItems = [...rawLibraryItems]
    .filter((item) => item.value !== 'all')
    .sort((a, b) => {
      const aIndex = libraries.findIndex((l) => l.id === a.value)
      const bIndex = libraries.findIndex((l) => l.id === b.value)
      return aIndex - bIndex
    })

  const frameworkItems = [...rawFrameworkItems]
    .filter((item) => item.value !== 'all')
    .sort((a, b) => {
      const aIndex = frameworkOptions.findIndex((f) => f.value === a.value)
      const bIndex = frameworkOptions.findIndex((f) => f.value === b.value)
      return aIndex - bIndex
    })

  // Wrapper functions that just update state (no Algolia refine)
  const selectLibrary = React.useCallback((value: string) => {
    setSelectedLibrary(value)
  }, [])

  const selectFramework = React.useCallback((value: string) => {
    setSelectedFramework(value)
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
      }}
    >
      {children}
    </SearchFiltersContext.Provider>
  )
}

// Component that builds dynamic filter strings including "all" library/framework pages
function DynamicFilters() {
  const { selectedLibrary, selectedFramework } = useSearchFilters()

  // Build filter string
  // - Always filter to latest version OR "all" (for core pages)
  // - When library selected: include that library OR "all" (for core pages)
  // - When framework selected: include that framework OR "all" (for integration pages)
  const filterParts: string[] = []

  // Version filter: include latest OR "all" (core pages)
  filterParts.push('(version:latest OR version:all)')

  if (selectedLibrary) {
    // Include selected library OR "all" (core pages like /ethos)
    filterParts.push(`(library:${selectedLibrary} OR library:all)`)
  }

  if (selectedFramework) {
    // Include selected framework OR "all" (integration pages, core pages)
    filterParts.push(`(framework:${selectedFramework} OR framework:all)`)
  }

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
        'content',
        'library',
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
      filters={filterParts.join(' AND ')}
    />
  )
}

const SafeLink = React.forwardRef(
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
    const isInternal = href?.includes('//tanstack.com')

    if (!isInternal) {
      return (
        <a
          href={href}
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
        to={href?.split('//tanstack.com')[1]}
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

const Hit = ({
  hit,
  isFocused,
  refinedLibrary,
  refinedFramework,
}: {
  hit: AlgoliaHit
  isFocused?: boolean
  refinedLibrary: string | null
  refinedFramework: string | null
}) => {
  const { closeSearch } = useSearchContext()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const link = e.currentTarget as HTMLAnchorElement
      link.click()
      closeSearch()
    }
  }

  const handleClick = () => {
    closeSearch()
  }

  const ref = React.useRef<HTMLAnchorElement>(null!)

  React.useEffect(() => {
    if (isFocused) {
      ref.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    }
  }, [isFocused])

  // Get library and framework info for this hit
  const hitLibrary = hit.library as string | undefined
  const hitFramework = frameworkOptions.find((f) =>
    hit.url.includes(`/framework/${f.value}`),
  )
  const hitLibraryInfo = hitLibrary
    ? libraries.find((l) => l.id === hitLibrary)
    : null

  // Build hierarchy prefix based on what's filtered
  const prefixParts: React.ReactNode[] = []

  // Show library if not filtered to one
  if (!refinedLibrary && hitLibraryInfo) {
    prefixParts.push(
      <span
        key="library"
        className={twMerge(
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-black text-white uppercase',
          hitLibraryInfo.bgStyle,
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
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
      >
        <img
          src={hitFramework.logo}
          alt={hitFramework.label}
          className="w-3.5 h-3.5"
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
  ].filter((lvl) => hit.hierarchy[lvl])

  return (
    <SafeLink
      href={hit.url}
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
      ref={ref}
    >
      <article className="flex items-start gap-4">
        <div className="flex-1">
          <h3 className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap pl-8 [&>*:first-child]:-ml-8">
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
                <span className="text-gray-600 dark:text-gray-400 [&_mark]:font-black [&_mark]:!bg-transparent [&_mark]:text-black [&_mark]:dark:text-white [&_mark]:inline [&_mark]:!p-0 [&_mark]:!m-0 [&_mark]:!rounded-none">
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
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 ml-8 line-clamp-2 [&_mark]:font-black [&_mark]:!bg-transparent [&_mark]:text-black [&_mark]:dark:text-white [&_mark]:inline [&_mark]:!p-0 [&_mark]:!m-0 [&_mark]:!rounded-none">
              <Snippet
                attribute="content"
                hit={hit as Parameters<typeof Snippet>[0]['hit']}
              />
            </p>
          ) : null}
        </div>
        {refinedFramework && hitFramework ? (
          <div className="flex-none">
            <div className="flex items-center gap-1 text-xs font-black bg-white rounded-xl px-2 py-1 dark:bg-black">
              <img
                src={hitFramework.logo}
                alt={hitFramework.label}
                className="w-4"
              />
              {capitalize(hitFramework.label)}
            </div>
          </div>
        ) : null}
      </article>
    </SafeLink>
  )
}

function LibraryRefinement() {
  const {
    selectedLibrary,
    setSelectedLibrary,
    libraryItems: items,
  } = useSearchFilters()

  const currentLibrary = libraries.find((l) => l.id === selectedLibrary)

  return (
    <Dropdown>
      <DropdownTrigger asChild={false}>
        <button className="flex items-center gap-1 text-sm focus:outline-none cursor-pointer font-bold">
          {currentLibrary ? (
            <span className="uppercase font-black [letter-spacing:-.05em]">
              <span className="opacity-50">TanStack</span>{' '}
              <span className={currentLibrary.textStyle}>
                {currentLibrary.id.toUpperCase()}
              </span>
            </span>
          ) : (
            <span>All Libraries</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </button>
      </DropdownTrigger>
      <DropdownContent
        align="start"
        className="max-h-[60vh] w-64 overflow-auto"
      >
        <DropdownItem
          onSelect={() => setSelectedLibrary('')}
          className="font-bold"
        >
          All Libraries
        </DropdownItem>
        {items.map((item) => {
          const lib = libraries.find((l) => l.id === item.value)
          return (
            <DropdownItem
              key={item.value}
              onSelect={() => setSelectedLibrary(item.value)}
              className="justify-between"
            >
              <span className="uppercase font-black [letter-spacing:-.05em]">
                <span className="opacity-50">TanStack</span>{' '}
                <span className={lib?.textStyle ?? ''}>
                  {item.label.toUpperCase()}
                </span>
              </span>
              <span className="text-gray-400 text-xs font-normal">
                ({item.count})
              </span>
            </DropdownItem>
          )
        })}
      </DropdownContent>
    </Dropdown>
  )
}

function FrameworkRefinement() {
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
    <Dropdown>
      <DropdownTrigger asChild={false}>
        <button className="flex items-center gap-1 text-sm font-bold focus:outline-none cursor-pointer">
          {currentFramework && (
            <img
              src={currentFramework.logo}
              alt={currentFramework.label}
              className="w-4 h-4"
            />
          )}
          <span>
            {currentFramework
              ? capitalize(currentFramework.label)
              : 'All Frameworks'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </button>
      </DropdownTrigger>
      <DropdownContent
        align="start"
        className="max-h-[60vh] w-52 overflow-auto"
      >
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
                {fw && <img src={fw.logo} alt={fw.label} className="w-4 h-4" />}
                <span className="font-bold">{capitalize(item.label)}</span>
              </span>
              <span className="text-gray-400 text-xs">({item.count})</span>
            </DropdownItem>
          )
        })}
      </DropdownContent>
    </Dropdown>
  )
}

function NoResults({
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
    ? libraries.find((l) => l.id === refinedLibrary)
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
            role="option"
            aria-selected="true"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Search all frameworks
            {currentFrameworkOption && (
              <span className="text-xs font-normal opacity-70">
                (currently {currentFrameworkOption.label})
              </span>
            )}
          </button>
          <CornerDownLeft className="w-4 h-4 animate-bounce" />
        </div>
      )}
      {!refinedFramework && refinedLibrary && (
        <div className="mt-4 inline-flex items-center gap-2">
          <button
            onClick={clearLibrary}
            role="option"
            aria-selected="true"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Search all libraries
            {currentLibrary && (
              <span className="text-xs font-normal opacity-70">
                (currently {currentLibrary.name})
              </span>
            )}
          </button>
          <CornerDownLeft className="w-4 h-4 animate-bounce" />
        </div>
      )}
    </div>
  )
}

const submitIconComponent = () => {
  return <Search />
}

const resetIconComponent = () => {
  return <X />
}

export function SearchModal() {
  const { isOpen, closeSearch, openSearch } = useSearchContext()
  const [focusedIndex, setFocusedIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Reset focused index when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0)
    }
  }, [isOpen])

  const focusedIndexRef = React.useRef(focusedIndex)

  React.useEffect(() => {
    focusedIndexRef.current = focusedIndex
  }, [focusedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.persist()

    if (!containerRef.current) return

    const items = containerRef.current.querySelectorAll('[role="option"]')
    if (!items.length) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(items.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        const item = items[focusedIndexRef.current] as HTMLElement
        if (item) {
          item.click()
        }
        break
      case 'Escape':
        e.preventDefault()
        closeSearch()
        break
    }
  }

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          openSearch()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isOpen, openSearch])

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={closeSearch}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[999] bg-black/60 xl:bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed z-[1000] top-8 left-1/2 -translate-x-1/2 w-[98%] xl:w-full max-w-3xl text-left bg-white/80 dark:bg-black/80 shadow-lg rounded-lg xl:rounded-xl divide-y divide-gray-500/20 backdrop-blur-lg dark:border dark:border-white/20 outline-none"
          ref={containerRef}
          onKeyDown={handleKeyDown}
        >
          <InstantSearch searchClient={searchClient} indexName="tanstack-test">
            <SearchFiltersProvider>
              <DynamicFilters />
              <div className="flex items-center gap-2 px-4 py-3 overflow-visible">
                <Search className="w-5 h-5 opacity-50 flex-none" />
                <LibraryRefinement />
                <span className="text-gray-400 dark:text-gray-600">/</span>
                <FrameworkRefinement />
                <span className="text-gray-400 dark:text-gray-600">/</span>
                <SearchBox
                  placeholder="Search..."
                  classNames={{
                    root: 'flex-1',
                    form: 'flex items-center',
                    input:
                      'w-full outline-none font-bold [&::-webkit-search-cancel-button]:hidden bg-transparent',
                    submit: 'hidden',
                    reset: 'p-1 opacity-50 hover:opacity-100',
                  }}
                  resetIconComponent={resetIconComponent}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              </div>
              <SearchResults focusedIndex={focusedIndex} />
              <div className="flex items-center justify-end gap-1.5 px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-500/20">
                <span>Search by</span>
                <a
                  href="https://www.algolia.com/developers/?utm_medium=referral&utm_content=powered_by&utm_source=tanstack.com&utm_campaign=docsearch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  <img
                    src="/Algolia-logo-blue.svg"
                    alt="Algolia"
                    className="h-4 w-auto dark:hidden"
                  />
                  <img
                    src="/Algolia-logo-white.svg"
                    alt="Algolia"
                    className="h-4 w-auto hidden dark:block"
                  />
                </a>
              </div>
            </SearchFiltersProvider>
          </InstantSearch>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SearchResults({ focusedIndex }: { focusedIndex: number }) {
  const { results } = useInstantSearch()
  const { hits, isLastPage, showMore } = useInfiniteHits()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  const {
    selectedLibrary,
    selectedFramework,
    setSelectedLibrary,
    setSelectedFramework,
    libraryItems,
    frameworkItems,
  } = useSearchFilters()

  const persistFramework = usePersistFrameworkPreference()

  // Use selected values directly (no longer relying on Algolia's isRefined)
  const refinedLibrary = selectedLibrary || null
  const refinedFramework = selectedFramework || null

  const clearFramework = () => {
    setSelectedFramework('')
  }

  const clearLibrary = () => {
    setSelectedLibrary('')
  }

  // Infinite scroll with Intersection Observer
  React.useEffect(() => {
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container || !hits.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLastPage) {
            showMore()
          }
        })
      },
      {
        root: container,
        rootMargin: '200px',
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hits, isLastPage, showMore])

  if (!results.query) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium text-center">Search TanStack</p>
        <p className="mt-2 text-sm text-center">
          Start typing to search, or select a library or framework below.
        </p>
        <div className="mt-6 flex gap-8 justify-center">
          {!selectedLibrary && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                Libraries
              </p>
              <div className="flex flex-wrap gap-1.5 max-w-xs">
                {libraries
                  .filter((lib) => 'bgStyle' in lib)
                  .map((lib) => (
                    <button
                      key={lib.id}
                      onClick={() => {
                        setSelectedLibrary(lib.id)
                      }}
                      className={twMerge(
                        'px-2 py-1 text-xs font-black uppercase rounded text-white transition-opacity hover:opacity-80',
                        lib.bgStyle,
                      )}
                    >
                      {lib.id}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {!selectedFramework && frameworkItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                Frameworks
              </p>
              <div className="flex flex-wrap gap-1.5 max-w-xs">
                {frameworkItems.map((item) => {
                  const fw = frameworkOptions.find(
                    (f) => f.value === item.value,
                  )
                  if (!fw) return null
                  return (
                    <button
                      key={fw.value}
                      onClick={() => {
                        setSelectedFramework(fw.value)
                        persistFramework(fw.value)
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <img
                        src={fw.logo}
                        alt={fw.label}
                        className="w-3.5 h-3.5"
                      />
                      {fw.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[80dvh] overflow-y-auto"
      role="listbox"
      aria-label="Search results"
    >
      <NoResults
        refinedFramework={refinedFramework}
        refinedLibrary={refinedLibrary}
        clearFramework={clearFramework}
        clearLibrary={clearLibrary}
      />
      {hits.map((hit, index) => (
        <Hit
          key={hit.objectID}
          hit={hit as AlgoliaHit}
          isFocused={index === focusedIndex}
          refinedLibrary={refinedLibrary}
          refinedFramework={refinedFramework}
        />
      ))}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
    </div>
  )
}
