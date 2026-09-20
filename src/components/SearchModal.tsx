import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { twMerge } from 'tailwind-merge'
import {
  InstantSearch,
  useInstantSearch,
  useInfiniteHits,
  useSearchBox,
} from 'react-instantsearch'
import {
  XIcon,
  MagnifyingGlassIcon,
  ArrowElbowDownLeftIcon,
  ChatCenteredDotsIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
} from '@phosphor-icons/react'
import { useSearchContext } from '~/contexts/SearchContext'
import {
  type AlgoliaHit,
  dedupeSearchHitsByPage,
  searchClient,
  searchIndexName,
  useSearchFilters,
  SearchFiltersProvider,
  DynamicFilters,
  AlgoliaAttribution,
  Hit,
  LibraryRefinement,
  FrameworkRefinement,
  NoResults,
} from './SearchShared'

function CommandSearchPanel({
  isFullHeight,
  onToggleFullHeight,
}: {
  isFullHeight: boolean
  onToggleFullHeight: () => void
}) {
  return (
    <Command
      label="Search TanStack"
      shouldFilter={false}
      loop
      className={twMerge(
        'flex flex-col overflow-hidden bg-white/95 text-left shadow-2xl backdrop-blur-xl dark:border dark:border-white/20 dark:bg-black/95 sm:rounded-[1.5rem]',
        isFullHeight ? 'h-full' : 'h-dvh sm:h-[min(760px,calc(100dvh-2rem))]',
      )}
    >
      <CommandSearchInput
        isFullHeight={isFullHeight}
        onToggleFullHeight={onToggleFullHeight}
      />
      <CommandSearchResults />
    </Command>
  )
}

function CommandSearchInput({
  isFullHeight,
  onToggleFullHeight,
}: {
  isFullHeight: boolean
  onToggleFullHeight: () => void
}) {
  const { closeSearch } = useSearchContext()
  const { refine } = useSearchBox()
  const { searchQuery, setSearchQuery } = useSearchFilters()
  const hasQuery = searchQuery.trim().length > 0
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  const clearSearch = React.useCallback(() => {
    setSearchQuery('')
    refine('')
  }, [refine, setSearchQuery])

  return (
    <header className="flex-none border-b border-gray-200/80 bg-white/95 px-3 py-3 dark:border-white/10 dark:bg-black/95 sm:px-4">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-500/[0.04] px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" />
          <Command.Input
            ref={inputRef}
            aria-label="Search TanStack"
            placeholder="Search TanStack..."
            value={searchQuery}
            onValueChange={(nextQuery) => {
              setSearchQuery(nextQuery)
              refine(nextQuery)
            }}
            className="w-full bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="button"
            onClick={clearSearch}
            className={twMerge(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-opacity hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200',
              hasQuery ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleFullHeight}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-500 dark:hover:text-gray-200 sm:flex"
          aria-label={isFullHeight ? 'Collapse search' : 'Expand search'}
        >
          {isFullHeight ? (
            <ArrowsInSimpleIcon className="h-4 w-4" />
          ) : (
            <ArrowsOutSimpleIcon className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={closeSearch}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:text-gray-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-500 dark:hover:text-gray-200"
          aria-label="Close search"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}

function CommandSearchResults() {
  const { results } = useInstantSearch()
  const { hits, isLastPage, showMore } = useInfiniteHits<AlgoliaHit>({
    transformItems: dedupeSearchHitsByPage,
  })
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const resultsScrollRef = React.useRef<HTMLDivElement>(null)

  const {
    selectedLibrary,
    selectedFramework,
    setSelectedLibrary,
    setSelectedFramework,
    searchQuery,
  } = useSearchFilters()

  const refinedLibrary = selectedLibrary || null
  const refinedFramework = selectedFramework || null
  const trimmedQuery = searchQuery.trim()
  const hasQuery = trimmedQuery.length > 0

  const clearFramework = () => {
    setSelectedFramework('')
  }

  const clearLibrary = () => {
    setSelectedLibrary('')
  }

  const resultSummary = results.__isArtificial ? (
    <>Searching for &ldquo;{trimmedQuery}&rdquo;</>
  ) : results.nbHits > 0 ? (
    <>
      Results for{' '}
      <span className="font-medium text-gray-600 dark:text-gray-300">
        &ldquo;{trimmedQuery}&rdquo;
      </span>
    </>
  ) : (
    <>No results for &ldquo;{trimmedQuery}&rdquo;</>
  )

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasQuery || !hits.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLastPage) {
            showMore()
          }
        })
      },
      { root: resultsScrollRef.current, rootMargin: '260px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasQuery, hits, isLastPage, showMore])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none border-b border-gray-200/80 px-3 py-2 dark:border-white/10 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5"
            data-command-search-controls="true"
          >
            <FrameworkRefinement compact />
            <LibraryRefinement compact />
          </div>
          {hasQuery ? (
            <p className="min-w-[10rem] flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {resultSummary}
            </p>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center">
            <AlgoliaAttribution />
          </div>
        </div>
      </div>
      <Command.List
        ref={resultsScrollRef}
        className="min-h-0 flex-1 overflow-y-auto scroll-py-2"
        label="Search results"
      >
        {hasQuery ? (
          <>
            <AskAIResult query={trimmedQuery} />
            <NoResults
              refinedFramework={refinedFramework}
              refinedLibrary={refinedLibrary}
              clearFramework={clearFramework}
              clearLibrary={clearLibrary}
            />
            {hits.map((hit, index) => (
              <Hit
                key={hit.objectID}
                commandValue={`hit-${hit.objectID}-${index}`}
                hit={hit}
                refinedLibrary={refinedLibrary}
                refinedFramework={refinedFramework}
              />
            ))}
            <div ref={sentinelRef} className="h-4" aria-hidden="true" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-6 py-16 text-sm text-gray-400 dark:text-gray-500">
            Search TanStack
          </div>
        )}
      </Command.List>
    </div>
  )
}

function AskAIResult({ query }: { query: string }) {
  const { askAiDock } = useSearchContext()

  return (
    <Command.Item
      value="ask-ai"
      onSelect={() => askAiDock(query)}
      className={twMerge(
        'flex w-full cursor-pointer scroll-my-2 items-center gap-3 border-b border-gray-200 px-4 py-3 text-left outline-none transition-colors dark:border-white/10',
        'hover:bg-gray-500/10 data-[selected=true]:bg-cyan-500/10 dark:data-[selected=true]:bg-cyan-400/10',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
        <ChatCenteredDotsIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">
          Ask AI
        </span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
          Open TanStack AI with this query
        </span>
      </span>
      <ArrowElbowDownLeftIcon className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
    </Command.Item>
  )
}

const _submitIconComponent = () => {
  return <MagnifyingGlassIcon />
}

function isSearchModalPortalTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('.dropdown-content')
}

const searchModalTransitionMs = 140

export function SearchModal() {
  const { isOpen, closeSearch } = useSearchContext()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const bodyPointerEventsRef = React.useRef('')
  const [shouldRenderSearch, setShouldRenderSearch] = React.useState(isOpen)
  const [isFullHeight, setIsFullHeight] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('search-full-height') === 'true'
  })

  const toggleFullHeight = React.useCallback(() => {
    setIsFullHeight((current) => {
      const next = !current
      localStorage.setItem('search-full-height', String(next))
      return next
    })
  }, [])

  React.useEffect(() => {
    if (isOpen) {
      setShouldRenderSearch(true)
      return
    }

    const timeout = window.setTimeout(() => {
      setShouldRenderSearch(false)
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = bodyPointerEventsRef.current
      })
    }, searchModalTransitionMs)

    return () => window.clearTimeout(timeout)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    const frame = requestAnimationFrame(() => {
      contentRef.current
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus({ preventScroll: true })
    })

    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (isOpen) {
      document.body.style.pointerEvents = 'none'
      return
    }

    const frame = requestAnimationFrame(() => {
      document.body.style.pointerEvents = bodyPointerEventsRef.current
    })

    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    bodyPointerEventsRef.current =
      document.body.style.pointerEvents === 'none'
        ? ''
        : document.body.style.pointerEvents

    return () => {
      document.body.style.pointerEvents = bodyPointerEventsRef.current
    }
  }, [])

  const shouldMountSearch = isOpen || shouldRenderSearch

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeSearch()
        }
      }}
    >
      <DialogPrimitive.Portal forceMount>
        {shouldMountSearch ? (
          <>
            <DialogPrimitive.Overlay
              forceMount
              // xl keeps a deliberately lighter scrim: past that width the
              // palette covers a small share of the screen, and the full
              // --color-scrim reads as heavier than the interaction warrants.
              className="search-modal-overlay fixed inset-0 z-[var(--z-scrim)] bg-scrim backdrop-blur-sm xl:bg-black/30"
            />
            <DialogPrimitive.Content
              forceMount
              ref={contentRef}
              className={twMerge(
                'search-modal-content fixed z-[var(--z-overlay)] inset-0 sm:inset-auto sm:top-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[96%] xl:w-full sm:max-w-4xl text-left outline-none',
                isFullHeight && 'sm:bottom-4',
              )}
              onInteractOutside={(event) => {
                if (isSearchModalPortalTarget(event.target)) {
                  event.preventDefault()
                }
              }}
            >
              <DialogPrimitive.Title className="sr-only">
                Search TanStack
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Search TanStack and open TanStack AI from the current query.
              </DialogPrimitive.Description>
              <div className="search-modal-panel-transition h-full">
                <InstantSearch
                  searchClient={searchClient}
                  indexName={searchIndexName}
                >
                  <SearchFiltersProvider resetFiltersOnOpen={isOpen}>
                    <DynamicFilters />
                    <CommandSearchPanel
                      isFullHeight={isFullHeight}
                      onToggleFullHeight={toggleFullHeight}
                    />
                  </SearchFiltersProvider>
                </InstantSearch>
              </div>
            </DialogPrimitive.Content>
          </>
        ) : null}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
