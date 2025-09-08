import * as React from 'react'
import { Dialog } from '@headlessui/react'
import { twMerge } from 'tailwind-merge'
import {
  InstantSearch,
  SearchBox,
  Hits,
  Highlight,
  Configure,
  useRefinementList,
  useInstantSearch,
  Pagination,
} from 'react-instantsearch'
import { liteClient } from 'algoliasearch/lite'
import { MdClose, MdSearch } from 'react-icons/md'
import { Link, useRouterState } from '@tanstack/react-router'
import { useSearchContext } from '~/contexts/SearchContext'
import { frameworkOptions, libraries } from '~/libraries'
import { capitalize } from '~/utils/utils'

const searchClient = liteClient(
  'FQ0DQ6MA3C',
  '10c34d6a5c89f6048cf644d601e65172'
)

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
    ref: React.Ref<HTMLAnchorElement>
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
  }
)

const Hit = ({ hit, isFocused }: { hit: any; isFocused?: boolean }) => {
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

  return (
    <SafeLink
      href={hit.url}
      className={twMerge(
        'block p-4 focus:outline-none border-b border-gray-500/10',
        isFocused ? 'bg-gray-500/20' : 'hover:bg-gray-500/10'
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
          <h3 className="font-bold text-gray-900 dark:text-white">
            <Highlight attribute="hierarchy.lvl1" hit={hit} />
          </h3>
          {['lvl2', 'lvl3', 'lvl4', 'lvl5', 'lvl6']
            .filter((lvl) => hit.hierarchy[lvl])
            .map((lvl) =>
              hit.hierarchy[lvl] ? (
                <p
                  key={lvl}
                  className="text-sm text-gray-500 dark:text-gray-500 mt-1"
                >
                  <Highlight attribute={`hierarchy.${lvl}`} hit={hit} />
                </p>
              ) : null
            )}
          {hit.content ? (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              <Highlight attribute="content" hit={hit} />
            </p>
          ) : null}
        </div>
        {(() => {
          const framework = frameworkOptions.find((f) =>
            hit.url.includes(`/framework/${f.value}`)
          )
          if (!framework) return null

          return (
            <div className="flex-none">
              <div className="flex items-center gap-1 text-xs font-black bg-white rounded-xl px-2 py-1 dark:bg-black">
                <img
                  src={framework.logo}
                  alt={framework.label}
                  className="w-4"
                />
                {capitalize(framework.label)}
              </div>
            </div>
          )
        })()}
      </article>
    </SafeLink>
  )
}

function LibraryRefinement() {
  const subpathname = useRouterState({
    select: (state) => state.location.pathname.split('/')[1],
  })

  const { items, refine } = useRefinementList({
    attribute: 'library',
    limit: 50,
    sortBy: ['isRefined:desc', 'count:desc', 'name:asc'],
  })

  React.useEffect(() => {
    const isAlreadyRefined = items.some(
      (item) => item.label === subpathname && item.isRefined
    )

    const library = libraries.find((l) => l.id === subpathname)

    if (!isAlreadyRefined && library) {
      refine(subpathname)
    }
  }, [])

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 p-2 min-w-max">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
          Libraries:
        </span>
        <div className="flex gap-1.5">
          {items.map((item) => {
            const library = libraries.find((l) => l.id === item.value)

            return (
              <button
                key={item.value}
                onClick={() => refine(item.value)}
                className={twMerge(
                  'px-2 py-0.5 text-xs rounded-full transition-colors font-bold text-white',
                  item.isRefined
                    ? library
                      ? library.bgStyle
                      : 'bg-black dark:bg-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {capitalize(item.label)}{' '}
                <span className="tabular-nums">
                  ({item.count.toLocaleString()})
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
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

  const { items, refine } = useRefinementList({
    attribute: 'framework',
    limit: 50,
    sortBy: ['isRefined:desc', 'count:desc', 'name:asc'],
  })

  React.useEffect(() => {
    if (!subpathname) return

    const isAlreadyRefined = items.some(
      (item) => item.value === subpathname && item.isRefined
    )

    const framework = frameworkOptions.find((f) => f.value === subpathname)

    if (!isAlreadyRefined && framework) {
      refine(subpathname)
    }
  }, [subpathname])

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-2 p-2 min-w-max">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
          Frameworks:
        </span>
        <div className="flex gap-1.5">
          {items.map((item) => {
            const framework = frameworkOptions.find(
              (f) => f.value === item.value
            )

            return (
              <button
                key={item.value}
                onClick={() => refine(item.value)}
                className={twMerge(
                  'px-2 py-0.5 text-xs rounded-full transition-colors font-bold text-white',
                  item.isRefined
                    ? framework?.color || 'bg-black dark:bg-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {capitalize(item.label)}{' '}
                <span className="tabular-nums">
                  ({item.count.toLocaleString()})
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NoResults() {
  const { results } = useInstantSearch()

  if (results.__isArtificial || results.nbHits > 0) {
    return null
  }

  return (
    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
      <p className="text-lg font-medium">No results found</p>
      <p className="mt-2 text-sm">
        Try adjusting your search or filters to find what you're looking for.
      </p>
    </div>
  )
}

const submitIconComponent = () => {
  return <MdSearch />
}

const resetIconComponent = () => {
  return <MdClose />
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
    <Dialog
      open={isOpen}
      onClose={closeSearch}
      className="fixed inset-0 z-1000 overflow-y-auto"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <div className="min-h-screen text-center">
        <Dialog.Overlay className="fixed inset-0 bg-black/60 xl:bg-black/30" />
        <div className="inline-block w-[98%] xl:w-full max-w-2xl mt-8 overflow-hidden text-left align-middle transition-all transform bg-white/80 dark:bg-black/80 shadow-xl rounded-lg xl:rounded-xl divide-y divide-gray-500/20 backdrop-blur-lg dark:border dark:border-white/20">
          <InstantSearch searchClient={searchClient} indexName="tanstack">
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
              filters="version:latest"
            />
            <div className="flex justify-between items-center gap-2">
              <SearchBox
                placeholder="Search..."
                classNames={{
                  root: 'w-full',
                  form: 'text-xl flex items-center gap-2 px-4',
                  input:
                    'flex-1 p-4 pl-0 outline-none font-bold [&::-webkit-search-cancel-button]:hidden bg-transparent',
                  submit: 'p-2',
                  reset: 'p-2',
                }}
                submitIconComponent={submitIconComponent}
                resetIconComponent={resetIconComponent}
                autoFocus
              />
            </div>
            <SearchResults focusedIndex={focusedIndex} />
          </InstantSearch>
        </div>
      </div>
    </Dialog>
  )
}

function SearchResults({ focusedIndex }: { focusedIndex: number }) {
  const { results } = useInstantSearch()

  if (!results.query) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Search TanStack</p>
        <p className="mt-2 text-sm">
          Start typing to search through our documentation, guides, and more.
        </p>
      </div>
    )
  }

  return (
    <>
      <LibraryRefinement />
      <FrameworkRefinement />
      <div
        className="max-h-[70dvh] lg:max-h-[60dvh] overflow-y-auto"
        role="listbox"
        aria-label="Search results"
      >
        <NoResults />
        <Hits
          hitComponent={({ hit }) => {
            const index = results.hits.findIndex(
              (h) => h.objectID === hit.objectID
            )
            return <Hit hit={hit} isFocused={index === focusedIndex} />
          }}
        />
        <Pagination
          padding={2}
          className={twMerge(
            'border-t text-sm dark:border-white/20 px-4 py-3',
            '[&>ul]:w-full [&>ul]:flex [&>ul]:justify-center [&>ul]:gap-2 lg:[&>ul]:gap-4',
            '[&_li>*]:px-3 [&_li>*]:py-1.5',
            '[&_li>span]:cursor-not-allowed',
            '[&_.ais-Pagination-item--selected>*]:bg-emerald-500 [&_.ais-Pagination-item--selected>*]:text-white [&_.ais-Pagination-item--selected>*]:rounded-lg'
          )}
        />
      </div>
    </>
  )
}
