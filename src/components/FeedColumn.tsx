import * as React from 'react'
import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listFeedEntries } from '~/utils/feed.functions'
import { FeedEntry } from '~/components/FeedEntry'
import { FaSpinner } from 'react-icons/fa'
import { LuExpand } from 'react-icons/lu'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'
import type { FeedFilters } from '~/queries/feed'

interface FeedColumnProps {
  source: string
  filters: Omit<FeedFilters, 'sources'>
  pageSize: number
  expandedIds?: string[]
  onExpandedChange?: (expandedIds: string[]) => void
  onViewModeChange?: (viewMode: 'table' | 'timeline' | 'columns') => void
  onFiltersChange?: (filters: { sources?: string[] }) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

export function FeedColumn({
  source,
  filters,
  pageSize,
  expandedIds,
  onExpandedChange,
  onViewModeChange,
  onFiltersChange,
  adminActions,
}: FeedColumnProps) {
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['feed', 'infinite', source, filters],
    queryFn: ({ pageParam = 0 }) =>
      listFeedEntries({
        data: {
          pagination: {
            limit: pageSize,
            page: pageParam,
          },
          filters: {
            ...filters,
            sources: [source],
          },
        },
      }),
    getNextPageParam: (
      lastPage: { isDone: boolean },
      allPages: Array<{ isDone: boolean }>,
    ) => {
      if (lastPage.isDone) {
        return undefined
      }
      return allPages.length
    },
    initialPageParam: 0,
  })

  // Derive accumulated entries from all pages
  const allEntries = useMemo(() => {
    const entries: FeedEntry[] = []
    const seenIds = new Set<string>()

    for (const page of infiniteQuery.data?.pages ?? []) {
      if (page.page) {
        for (const entry of page.page) {
          if (!seenIds.has(entry._id)) {
            seenIds.add(entry._id)
            entries.push(entry)
          }
        }
      }
    }

    return entries
  }, [infiniteQuery.data?.pages])

  const isLoading = infiniteQuery.isLoading && !infiniteQuery.data
  const isLoadingMore = infiniteQuery.isFetchingNextPage
  const hasError = infiniteQuery.isError
  const hasNoData = !isLoading && allEntries.length === 0
  const isBackgroundFetching = infiniteQuery.isFetching && !isLoading
  const hasNextPage = infiniteQuery.hasNextPage
  const totalCount = infiniteQuery.data?.pages[0]?.counts.total ?? 0

  const { ref: loadMoreRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0,
    triggerOnce: false,
  })

  // Load more when intersection observer triggers
  React.useEffect(() => {
    if (
      isIntersecting &&
      hasNextPage &&
      !infiniteQuery.isFetchingNextPage &&
      allEntries.length > 0
    ) {
      infiniteQuery.fetchNextPage()
    }
  }, [
    isIntersecting,
    hasNextPage,
    infiniteQuery.isFetchingNextPage,
    allEntries.length,
    infiniteQuery,
  ])

  const handleExpand = () => {
    // Determine target view mode - check localStorage for preference, default to table
    let targetViewMode: 'table' | 'timeline' = 'table'
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('feedViewMode')
      if (savedViewMode === 'table' || savedViewMode === 'timeline') {
        targetViewMode = savedViewMode
      }
    }
    onViewModeChange?.(targetViewMode)
    onFiltersChange?.({ sources: [source] })
  }

  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col h-full max-h-full overflow-hidden">
      {/* Column Header */}
      <div className="flex-shrink-0 sticky top-0 z-10 bg-white dark:bg-black border-b-2 border-gray-300 dark:border-gray-700 pb-2 mb-3">
        {/* Background Fetching Indicator */}
        {isBackgroundFetching && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 animate-pulse" />
        )}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              {source}
            </h3>
            {isBackgroundFetching && (
              <FaSpinner className="w-3 h-3 text-gray-400 dark:text-gray-500 animate-spin" />
            )}
          </div>
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors whitespace-nowrap"
            title={`Expand ${source} column`}
          >
            <LuExpand className="w-3 h-3" />
            <span className="hidden sm:inline">Expand</span>
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
          {allEntries.length > 0 && allEntries.length < totalCount && (
            <span className="ml-1">({allEntries.length} loaded)</span>
          )}
        </div>
      </div>

      {/* Column Content */}
      <div className="space-y-2.5 flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <FaSpinner className="animate-spin text-xl text-gray-500" />
          </div>
        )}

        {hasError && (
          <div className="text-center py-8">
            <p className="text-xs text-red-500 dark:text-red-400">
              Error loading {source} entries
            </p>
          </div>
        )}

        {hasNoData && !isLoading && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No {source} entries found
            </p>
          </div>
        )}

        {allEntries.map((entry) => (
          <FeedEntryColumn
            key={entry._id}
            entry={entry}
            expanded={expandedIds?.includes(entry._id) ?? false}
            onExpandedChange={(expanded) => {
              if (!onExpandedChange) return
              const current = expandedIds ?? []
              if (expanded) {
                onExpandedChange([...current, entry._id])
              } else {
                onExpandedChange(current.filter((id) => id !== entry._id))
              }
            }}
            adminActions={adminActions}
          />
        ))}

        {/* Load More Sentinel */}
        {hasNextPage && allEntries.length > 0 && (
          <div
            ref={loadMoreRef}
            className="py-4 flex items-center justify-center"
          >
            {isLoadingMore && (
              <FaSpinner className="animate-spin text-sm text-gray-500" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface FeedEntryColumnProps {
  entry: FeedEntry
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

function FeedEntryColumn({
  entry,
  expanded = false,
  onExpandedChange,
  adminActions,
}: FeedEntryColumnProps) {
  const setExpanded = (value: boolean) => {
    onExpandedChange?.(value)
  }

  // Determine entry type badge
  const getTypeBadge = () => {
    const isPrerelease = entry.tags.includes('release:prerelease')

    const badgeConfigs: Record<string, { label: string; className: string }> = {
      release: {
        label: 'Release',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      },
      prerelease: {
        label: 'Prerelease',
        className:
          'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      },
      blog: {
        label: 'Blog',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      },
      announcement: {
        label: 'Announcement',
        className:
          'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      },
      partner: {
        label: 'Partner',
        className:
          'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200',
      },
    }

    const category = entry.category
    const key = category === 'release' && isPrerelease ? 'prerelease' : category

    return (
      badgeConfigs[key] || {
        label: entry.source,
        className:
          'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      }
    )
  }

  const badge = getTypeBadge()

  return (
    <article
      className={twMerge(
        'bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-md p-2.5 transition-all',
        'hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700',
        entry.featured &&
          'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800',
      )}
    >
      {/* Badge and Date */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span
          className={twMerge(
            'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
            badge.className,
          )}
        >
          {badge.label}
        </span>
        {entry.featured && <span className="px-1 py-0.5 text-[10px]">⭐</span>}
        <time
          dateTime={new Date(entry.publishedAt).toISOString()}
          className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto"
        >
          {formatDistanceToNow(new Date(entry.publishedAt), {
            addSuffix: true,
          })}
        </time>
      </div>

      {/* Title */}
      <Link
        to="/feed/$id"
        params={{ id: entry._id }}
        search={{} as any}
        className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 block leading-tight"
      >
        {entry.title}
      </Link>

      {/* Excerpt */}
      {entry.excerpt && !expanded && (
        <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 mb-1.5 leading-relaxed">
          {entry.excerpt}
        </p>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="text-[11px] text-gray-700 dark:text-gray-300 mb-1.5">
          {entry.excerpt && (
            <p className="mb-1.5 leading-relaxed">{entry.excerpt}</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      </div>
    </article>
  )
}
