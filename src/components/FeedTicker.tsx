import * as React from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listFeedEntriesQueryOptions } from '~/queries/feed'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from '~/utils/dates'
import { libraries } from '~/libraries'

const DISPLAY_DURATION = 7000 // 7 seconds in milliseconds
const TRANSITION_DURATION = 500 // 0.5 seconds for crossfade

export function FeedTicker() {
  // Fetch feed entries with default filters (major, minor releases only)
  const feedQuery = useQuery({
    ...listFeedEntriesQueryOptions({
      pagination: {
        limit: 10, // Fetch first 10 entries
        page: 0,
      },
      filters: {
        releaseLevels: ['major', 'minor'],
        includePrerelease: false,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [previousIndex, setPreviousIndex] = React.useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = React.useState(false)

  const entries = feedQuery.data?.page || []

  React.useEffect(() => {
    if (entries.length === 0) return

    // Rotate to next item after DISPLAY_DURATION
    const rotateTimeout = setTimeout(() => {
      setPreviousIndex(currentIndex)
      setIsTransitioning(true)
      setCurrentIndex((prev) => (prev + 1) % entries.length)

      // Clear previous after transition completes
      setTimeout(() => {
        setPreviousIndex(null)
        setIsTransitioning(false)
      }, TRANSITION_DURATION)
    }, DISPLAY_DURATION)

    return () => clearTimeout(rotateTimeout)
  }, [currentIndex, entries.length])

  // Reset to first item when entries change
  React.useEffect(() => {
    if (entries.length > 0) {
      setCurrentIndex(0)
      setPreviousIndex(null)
      setIsTransitioning(false)
    }
  }, [entries.length])

  // Don't show ticker if loading/empty
  if (feedQuery.isLoading || entries.length === 0) {
    return null
  }

  const currentEntry = entries[currentIndex]
  const previousEntry = previousIndex !== null ? entries[previousIndex] : null
  if (!currentEntry) return null

  const renderEntry = (entry: typeof currentEntry) => {
    // Entry type badge configs
    const badgeConfigs: Record<string, { label: string; className: string }> = {
      release: {
        label: 'Release',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      },
      blog: {
        label: 'Blog',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      },
      announcement: {
        label: 'News',
        className:
          'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      },
    }

    const badge = badgeConfigs[entry.entryType] || {
      label: entry.entryType,
      className:
        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
    }

    const isRelease = entry.entryType === 'release'

    // For releases, get release level and version
    const releaseLevelTag = isRelease
      ? entry.tags.find(
          (tag) =>
            tag === 'release:major' ||
            tag === 'release:minor' ||
            tag === 'release:patch',
        )
      : null
    const releaseLevel = releaseLevelTag?.replace('release:', '') || ''
    const version = isRelease
      ? (
          (entry.metadata as { version?: string } | null)?.version || ''
        ).replace(/@tanstack\//gi, '')
      : ''

    return (
      <Link
        to="/feed/$id"
        params={{ id: entry._id }}
        search={{} as any}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors group"
      >
        {/* Entry type badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase flex-shrink-0 ${badge.className}`}
        >
          {badge.label}
        </span>

        {/* Release level (for releases only) */}
        {isRelease && releaseLevel && (
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 flex-shrink-0 uppercase">
            {releaseLevel}
          </span>
        )}

        {/* Library name (for releases) */}
        {isRelease &&
          entry.libraryIds[0] &&
          (() => {
            const library = libraries.find(
              (lib) => lib.id === entry.libraryIds[0],
            )
            return library ? (
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0">
                {library.name}
              </span>
            ) : null
          })()}

        {/* Version (for releases) */}
        {isRelease && version && (
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 flex-shrink-0">
            {version}
          </span>
        )}

        {/* Time ago */}
        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
          {formatDistanceToNow(new Date(entry.publishedAt), {
            addSuffix: true,
          })}
        </span>

        {/* Title or excerpt */}
        {(entry.title || entry.excerpt) && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
            {isRelease ? entry.excerpt : entry.title || entry.excerpt}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-white dark:bg-black border border-gray-200/50 dark:border-gray-700/50"
      style={{
        height: '32px',
        maxWidth: '320px',
        width: '100%',
      }}
    >
      <div className="h-full flex items-center">
        {/* Previous entry fading out */}
        {previousEntry && isTransitioning && (
          <div
            key={`prev-${previousIndex}`}
            className="absolute inset-0 flex items-center animate-fade-out"
          >
            {renderEntry(previousEntry)}
          </div>
        )}
        {/* Current entry fading in */}
        <div
          key={`curr-${currentIndex}`}
          className={`absolute inset-0 flex items-center ${isTransitioning ? 'animate-fade-in' : ''}`}
        >
          {renderEntry(currentEntry)}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-fade-in {
          animation: fadeIn 500ms ease-out forwards;
        }
        .animate-fade-out {
          animation: fadeOut 500ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
