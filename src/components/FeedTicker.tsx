import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { useQuery as useConvexQuery } from 'convex/react'

const DISPLAY_DURATION = 7000 // 7 seconds in milliseconds

export function FeedTicker() {
  const user = useConvexQuery(api.auth.getCurrentUser)

  // Check if user has feed access capability
  const canAccessFeed =
    user?.capabilities?.includes('feed') ||
    user?.capabilities?.includes('admin') ||
    false

  // Fetch feed entries with default filters (major, minor releases, include prerelease)
  const feedQuery = useQuery({
    ...convexQuery(api.feed.queries.listFeedEntries, {
      pagination: {
        limit: 10, // Fetch first 10 entries
        page: 0,
      },
      filters: {
        releaseLevels: ['major', 'minor'],
        includePrerelease: true,
      },
    }),
  })

  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [animationKey, setAnimationKey] = React.useState(0)
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  const [nextIndex, setNextIndex] = React.useState(0)

  const entries = feedQuery.data?.page || []

  React.useEffect(() => {
    if (entries.length === 0) return

    // Rotate to next item after DISPLAY_DURATION
    const rotateTimeout = setTimeout(() => {
      const newIndex = (currentIndex + 1) % entries.length
      setNextIndex(newIndex)
      setIsTransitioning(true)
      setAnimationKey((prev) => prev + 1) // Reset animation

      // After transition completes, update current index
      setTimeout(() => {
        setCurrentIndex(newIndex)
        setIsTransitioning(false)
      }, 500) // Transition duration
    }, DISPLAY_DURATION)

    return () => {
      clearTimeout(rotateTimeout)
    }
  }, [currentIndex, entries.length])

  // Reset to first item when entries change
  React.useEffect(() => {
    if (entries.length > 0) {
      setCurrentIndex(0)
      setNextIndex(0)
      setAnimationKey(0)
      setIsTransitioning(false)
    }
  }, [entries.length])

  // Don't show ticker if user doesn't have access or if loading/empty
  if (!canAccessFeed || feedQuery.isLoading || entries.length === 0) {
    return null
  }

  const currentEntry = entries[currentIndex]
  const nextEntry = entries[nextIndex]
  if (!currentEntry) return null

  const renderEntry = (entry: typeof currentEntry, isExiting: boolean) => {
    // Get release level badge color
    const releaseLevelTag = entry.tags.find((tag) =>
      tag.startsWith('release:')
    )
    const isPrerelease = entry.tags.includes('release:prerelease')
    const releaseLevel = releaseLevelTag?.replace('release:', '') || ''

    const badgeColors: Record<string, string> = {
      major: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      minor: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      patch: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    }

    const badgeColor = isPrerelease
      ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
      : badgeColors[releaseLevel] ||
        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'

    return (
      <Link
        to="/feed"
        className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors group ${
          isExiting ? 'cube-exit' : 'cube-enter'
        }`}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Badge */}
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium uppercase flex-shrink-0 ${badgeColor}`}
        >
          {isPrerelease ? 'Pre' : releaseLevel || 'Release'}
        </span>

        {/* Title */}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
          {entry.title}
        </span>

        {/* Time ago */}
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {formatDistanceToNow(new Date(entry.publishedAt), {
            addSuffix: true,
          })}
        </span>
      </Link>
    )
  }

  return (
    <div
      className="flex-1 max-w-2xl mx-4 relative overflow-hidden rounded-lg"
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Progress bar - full height behind content */}
      <div className="absolute inset-0 bg-gray-200/30 dark:bg-gray-700/30 rounded-lg">
        <div
          key={animationKey}
          className="h-full bg-gray-300/40 dark:bg-gray-600/40 rounded-lg"
          style={{
            width: '0%',
            animation: `progress ${DISPLAY_DURATION}ms linear forwards`,
          }}
        />
      </div>

      <div className="relative z-10" style={{ minHeight: '40px' }}>
        {/* Current entry */}
        <div
          className={`absolute inset-0 ${
            isTransitioning ? 'cube-exit' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {renderEntry(currentEntry, isTransitioning)}
        </div>

        {/* Next entry (entering) */}
        {isTransitioning && nextEntry && (
          <div
            className="absolute inset-0 cube-enter"
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            {renderEntry(nextEntry, false)}
          </div>
        )}
      </div>
      <style>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        @keyframes cubeExit {
          from {
            transform: rotateX(0deg);
            opacity: 1;
          }
          to {
            transform: rotateX(-90deg);
            opacity: 0;
          }
        }
        @keyframes cubeEnter {
          from {
            transform: rotateX(90deg);
            opacity: 0;
          }
          to {
            transform: rotateX(0deg);
            opacity: 1;
          }
        }
        .cube-exit {
          animation: cubeExit 500ms ease-in forwards;
        }
        .cube-enter {
          animation: cubeEnter 500ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}

