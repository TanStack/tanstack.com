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

function decodeHtmlEntities(str: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

// Custom Highlight component that decodes HTML entities
function DecodedHighlight({ attribute, hit }: { attribute: string; hit: any }) {
  // Navigate nested paths for both raw value and highlight result
  const getNestedValue = (obj: any, path: string) =>
    path.split('.').reduce((o, key) => o?.[key], obj)

  const highlighted = getNestedValue(hit._highlightResult, attribute)?.value
  const raw = getNestedValue(hit, attribute)

  if (!highlighted) {
    return <>{decodeHtmlEntities(raw || '')}</>
  }

  // Parse the highlighted string and decode entities while preserving <mark> tags
  const decoded = decodeHtmlEntities(
    highlighted
      .replace(/<mark>/g, '###MARK###')
      .replace(/<\/mark>/g, '###/MARK###'),
  )
    .replace(/###MARK###/g, '<mark>')
    .replace(/###\/MARK###/g, '</mark>')

  return <span dangerouslySetInnerHTML={{ __html: decoded }} />
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

  const { items: rawLibraryItems, refine: refineLibrary } = useMenu({
    attribute: 'library',
    limit: 50,
  })

  const { items: rawFrameworkItems, refine: refineFramework } = useMenu({
    attribute: 'framework',
    limit: 50,
  })

  // Pre-filter by stored framework preference on mount (only if no URL framework)
  const hasPrefiltered = React.useRef(false)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const hasUrlFramework = pathname.includes('/framework/')

  React.useEffect(() => {
    // Don't pre-filter if URL already specifies a framework (let FrameworkRefinement handle it)
    if (hasPrefiltered.current || hasUrlFramework) return
    const storedFramework = getInitialFramework()
    if (storedFramework && rawFrameworkItems.length > 0) {
      const item = rawFrameworkItems.find((i) => i.value === storedFramework)
      if (item && !item.isRefined) {
        refineFramework(storedFramework)
        setSelectedFramework(storedFramework)
        hasPrefiltered.current = true
      }
    }
  }, [rawFrameworkItems, refineFramework, getInitialFramework, hasUrlFramework])

  // Sort items by their defined order
  const libraryItems = [...rawLibraryItems].sort((a, b) => {
    const aIndex = libraries.findIndex((l) => l.id === a.value)
    const bIndex = libraries.findIndex((l) => l.id === b.value)
    return aIndex - bIndex
  })

  const frameworkItems = [...rawFrameworkItems].sort((a, b) => {
    const aIndex = frameworkOptions.findIndex((f) => f.value === a.value)
    const bIndex = frameworkOptions.findIndex((f) => f.value === b.value)
    return aIndex - bIndex
  })

  return (
    <SearchFiltersContext.Provider
      value={{
        selectedLibrary,
        selectedFramework,
        setSelectedLibrary,
        setSelectedFramework,
        refineLibrary,
        refineFramework,
        libraryItems,
        frameworkItems,
      }}
    >
      {children}
    </SearchFiltersContext.Provider>
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
  hit: any
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
              <Snippet attribute="content" hit={hit} />
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
  const subpathname = useRouterState({
    select: (state) => state.location.pathname.split('/')[1],
  })

  const {
    selectedLibrary,
    setSelectedLibrary,
    refineLibrary,
    libraryItems: items,
  } = useSearchFilters()

  const hasAutoRefined = React.useRef(false)

  // Auto-refine based on current page
  React.useEffect(() => {
    if (hasAutoRefined.current) return

    const library = libraries.find((l) => l.id === subpathname)
    if (library && items.length > 0) {
      const item = items.find((i) => i.value === subpathname)
      if (item && !item.isRefined) {
        refineLibrary(subpathname)
        setSelectedLibrary(subpathname)
        hasAutoRefined.current = true
      }
    }
  }, [items, refineLibrary, subpathname, setSelectedLibrary])

  const handleSelect = (value: string) => {
    setSelectedLibrary(value)
    refineLibrary(value)
  }

  const currentLibrary = libraries.find((l) => l.id === selectedLibrary)

  return (
    <Dropdown>
      <DropdownTrigger asChild={false}>
        <button className="flex items-center gap-1 text-sm focus:outline-none cursor-pointer font-bold">
          {currentLibrary ? (
            <span className="uppercase font-black [letter-spacing:-.05em]">
              <span className="opacity-50">TanStack</span>{' '}
              <span className={(currentLibrary as any).textStyle}>
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
        <DropdownItem onSelect={() => handleSelect('')} className="font-bold">
          All Libraries
        </DropdownItem>
        {items.map((item) => {
          const lib = libraries.find((l) => l.id === item.value)
          return (
            <DropdownItem
              key={item.value}
              onSelect={() => handleSelect(item.value)}
              className="justify-between"
            >
              <span className="uppercase font-black [letter-spacing:-.05em]">
                <span className="opacity-50">TanStack</span>{' '}
                <span className={lib ? (lib as any).textStyle : ''}>
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
  const subpathname = useRouterState({
    select: (state) => {
      const path = state.location.pathname
      const frameworkIndex = path.indexOf('/framework/')
      if (frameworkIndex !== -1) {
        return path.split('/')[
          path.split('/').indexOf('framework') + 1
        ] as string
      }
      return null
    },
  })

  const {
    selectedFramework,
    setSelectedFramework,
    refineFramework,
    frameworkItems: items,
  } = useSearchFilters()

  const persistFramework = usePersistFrameworkPreference()
  const hasAutoRefined = React.useRef(false)

  // Auto-refine based on current page
  React.useEffect(() => {
    if (hasAutoRefined.current || !subpathname) return

    const framework = frameworkOptions.find((f) => f.value === subpathname)
    if (framework && items.length > 0) {
      const item = items.find((i) => i.value === subpathname)
      if (item && !item.isRefined) {
        refineFramework(subpathname)
        setSelectedFramework(subpathname)
        hasAutoRefined.current = true
      }
    }
  }, [items, refineFramework, subpathname, setSelectedFramework])

  const handleSelect = (value: string) => {
    setSelectedFramework(value)
    refineFramework(value)
    // Persist the framework preference (localStorage + DB if logged in)
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
                filters="version:latest"
              />
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
                  className="inline-flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg
                    width="77"
                    height="19"
                    aria-label="Algolia"
                    className="h-4 w-auto"
                  >
                    <path
                      d="M2.5067 0h14.0245c1.384 0 2.5066 1.1226 2.5066 2.5067V16.5c0 1.3775-1.1227 2.5-2.5066 2.5H2.5067C1.1226 19 0 17.8775 0 16.5V2.5067C0 1.1226 1.1226 0 2.5067 0z"
                      fill="#5468FF"
                    />
                    <path
                      d="M9.5173 3.7573c-2.9477 0-5.3395 2.3883-5.3395 5.3315 0 2.9432 2.3918 5.3315 5.3395 5.3315 2.9478 0 5.3396-2.3883 5.3396-5.3315 0-2.9432-2.3918-5.3315-5.3396-5.3315zm0 8.9448c-1.993 0-3.6113-1.6148-3.6113-3.6133 0-1.9984 1.6183-3.6133 3.6113-3.6133 1.993 0 3.6113 1.6149 3.6113 3.6133 0 1.9985-1.6183 3.6133-3.6113 3.6133zm0-6.3423c-1.5019 0-2.7234 1.2193-2.7234 2.729 0 1.5095 1.2215 2.7289 2.7234 2.7289 1.5019 0 2.7234-1.2194 2.7234-2.7289 0-1.5097-1.2215-2.729-2.7234-2.729zm0 4.5761c-1.0148 0-1.8395-.823-1.8395-1.8471 0-1.0242.8247-1.8472 1.8395-1.8472 1.0148 0 1.8395.823 1.8395 1.8472 0 1.024-.8247 1.8471-1.8395 1.8471zm0-3.0107c-.6378 0-1.1556.517-1.1556 1.1636 0 .6465.5178 1.1636 1.1556 1.1636.6378 0 1.1556-.5171 1.1556-1.1636 0-.6466-.5178-1.1636-1.1556-1.1636zM9.5173 3.7573v1.7283m0-1.7283c-2.9477 0-5.3395 2.3883-5.3395 5.3315m5.3395-5.3315c2.9478 0 5.3396 2.3883 5.3396 5.3315m-5.3396 3.6133c1.993 0 3.6113-1.6148 3.6113-3.6133m-3.6113 3.6133c-1.993 0-3.6113-1.6148-3.6113-3.6133m7.2226 0c0 1.9985-1.6183 3.6133-3.6113 3.6133m3.6113-3.6133c0-1.9984-1.6183-3.6133-3.6113-3.6133m0 0c1.5019 0 2.7234 1.2193 2.7234 2.729m-2.7234-2.729c-1.5019 0-2.7234 1.2193-2.7234 2.729m5.4468 0c0 1.5095-1.2215 2.7289-2.7234 2.7289m2.7234-2.7289c0-1.5097-1.2215-2.729-2.7234-2.729m0 4.5761c-1.5019 0-2.7234-1.2194-2.7234-2.7289m2.7234 2.7289c1.0148 0 1.8395-.823 1.8395-1.8471m-1.8395 1.8471c-1.0148 0-1.8395-.823-1.8395-1.8471m3.679 0c0 1.024-.8247 1.8471-1.8395 1.8471m1.8395-1.8471c0-1.0242-.8247-1.8472-1.8395-1.8472m0 3.6943c-.6378 0-1.1556-.5171-1.1556-1.1636m1.1556 1.1636c.6378 0 1.1556-.5171 1.1556-1.1636m-2.3112 0c0 .6465.5178 1.1636 1.1556 1.1636m-1.1556-1.1636c0-.6466.5178-1.1636 1.1556-1.1636m1.1556 1.1636c0-.6466-.5178-1.1636-1.1556-1.1636"
                      fill="#FFF"
                      fillRule="evenodd"
                    />
                    <path
                      d="M35.143 10.857h-1.88l-.294-.504a3.37 3.37 0 01-1.792.504c-1.596 0-2.989-1.169-2.989-2.989 0-1.82 1.393-2.989 2.989-2.989.798 0 1.533.252 2.03.644v-.476h1.936v5.81zm-2.989-4.272c-.728 0-1.26.476-1.26 1.283 0 .812.532 1.288 1.26 1.288.728 0 1.26-.476 1.26-1.288 0-.807-.532-1.283-1.26-1.283zM39.223 2.95v7.907H37.28V2.95h1.943zM47.556 10.766c0 .056-.007.091-.007.091h-4.566c.084.448.476.798 1.12.798.476 0 .826-.168 1.022-.448l1.582.924c-.518.728-1.386 1.148-2.604 1.148-1.848 0-3.108-1.232-3.108-2.933 0-1.701 1.26-2.94 3.108-2.94 1.75 0 2.933 1.148 3.108 2.758.028.168.049.336.042.504.007.035.007.07.007.098h-.704zm-1.932-1.064c-.084-.462-.476-.826-1.127-.826-.651 0-1.043.364-1.127.826h2.254zM53.576 10.857h-1.944V7.672c0-.686-.42-1.008-.952-1.008-.532 0-.952.322-.952 1.008v3.185h-1.944V5.048h1.944v.476c.49-.392 1.19-.644 1.96-.644 1.4 0 2.394.91 2.394 2.394v3.583h-.506zM55.877 5.048h1.944v5.81h-1.944v-5.81zm.966-2.16c.644 0 1.176.525 1.176 1.176 0 .644-.532 1.176-1.176 1.176-.644 0-1.176-.532-1.176-1.176 0-.651.532-1.176 1.176-1.176zM64.883 10.857h-1.88l-.294-.504a3.37 3.37 0 01-1.792.504c-1.596 0-2.989-1.169-2.989-2.989 0-1.82 1.393-2.989 2.989-2.989.798 0 1.533.252 2.03.644v-.476H64.883v5.81zm-2.989-4.272c-.728 0-1.26.476-1.26 1.283 0 .812.532 1.288 1.26 1.288.728 0 1.26-.476 1.26-1.288 0-.807-.532-1.283-1.26-1.283z"
                      fill="currentColor"
                    />
                  </svg>
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
    refineLibrary,
    refineFramework,
    libraryItems,
    frameworkItems,
  } = useSearchFilters()

  const persistFramework = usePersistFrameworkPreference()

  const algoliaRefinedLibrary =
    libraryItems.find((item) => item.isRefined)?.value || null
  const algoliaRefinedFramework =
    frameworkItems.find((item) => item.isRefined)?.value || null

  // Use Algolia values when available, fall back to shared state when empty
  const refinedLibrary =
    libraryItems.length > 0 ? algoliaRefinedLibrary : selectedLibrary || null
  const refinedFramework =
    frameworkItems.length > 0
      ? algoliaRefinedFramework
      : selectedFramework || null

  const clearFramework = () => {
    if (refinedFramework) {
      refineFramework(refinedFramework)
      setSelectedFramework('')
    }
  }

  const clearLibrary = () => {
    if (refinedLibrary) {
      refineLibrary(refinedLibrary)
      setSelectedLibrary('')
    }
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
                        refineLibrary(lib.id)
                      }}
                      className={twMerge(
                        'px-2 py-1 text-xs font-black uppercase rounded text-white transition-opacity hover:opacity-80',
                        (lib as any).bgStyle,
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
                        refineFramework(fw.value)
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
          hit={hit}
          isFocused={index === focusedIndex}
          refinedLibrary={refinedLibrary}
          refinedFramework={refinedFramework}
        />
      ))}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
    </div>
  )
}
