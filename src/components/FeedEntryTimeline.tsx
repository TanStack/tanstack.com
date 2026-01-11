import * as React from 'react'
import { format, formatDistanceToNow } from '~/utils/dates'
import { Markdown } from '~/components/markdown/Markdown'
import { Card } from '~/components/Card'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { twMerge } from 'tailwind-merge'
import { FeedEntry } from './FeedEntry'
import { Link } from '@tanstack/react-router'
import { Eye, EyeOff, SquarePen, Star, Trash } from 'lucide-react'

interface FeedEntryTimelineProps {
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

export function FeedEntryTimeline({
  entry,
  expanded: expandedProp = false,
  onExpandedChange,
  adminActions,
}: FeedEntryTimelineProps) {
  const expanded = expandedProp
  const setExpanded = (value: boolean) => {
    onExpandedChange?.(value)
  }

  // Get library info
  const entryLibraries = entry.libraryIds
    .map((id) => libraries.find((lib) => lib.id === id))
    .filter(Boolean)

  // Get partner info
  const entryPartners = entry.partnerIds
    ? entry.partnerIds
        .map((id) => partners.find((p) => p.id === id))
        .filter(Boolean)
    : []

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
      update: {
        label: 'Update',
        className:
          'bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200',
      },
    }

    const key =
      entry.entryType === 'release' && isPrerelease
        ? 'prerelease'
        : entry.entryType

    return (
      badgeConfigs[key] || {
        label: entry.entryType,
        className:
          'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
      }
    )
  }

  const badge = getTypeBadge()

  // Get release level badge if present
  const getReleaseLevelBadge = () => {
    const releaseLevelTag = entry.tags.find(
      (tag) =>
        tag.startsWith('release:') &&
        tag !== 'release:prerelease' &&
        (tag === 'release:major' ||
          tag === 'release:minor' ||
          tag === 'release:patch'),
    )
    if (!releaseLevelTag) return null

    const level = releaseLevelTag.replace('release:', '')
    const badgeConfigs: Record<string, { label: string; className: string }> = {
      major: {
        label: 'Major',
        className:
          'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      },
      minor: {
        label: 'Minor',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      },
      patch: {
        label: 'Patch',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      },
    }

    return badgeConfigs[level] || null
  }

  const releaseLevelBadge = getReleaseLevelBadge()

  // Determine external link if available
  const getExternalLink = () => {
    if (entry.metadata) {
      if (entry.entryType === 'release' && entry.metadata.url) {
        return entry.metadata.url
      }
      if (entry.entryType === 'blog' && entry.metadata.url) {
        return entry.metadata.url
      }
    }
    return null
  }

  const externalLink = getExternalLink()

  return (
    <Card
      as="article"
      className={twMerge(
        'p-6 transition-all',
        'hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700',
        entry.featured &&
          'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          {/* Badges and Date */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={twMerge(
                'px-2.5 py-1 rounded-md text-xs font-medium uppercase',
                badge.className,
              )}
            >
              {badge.label}
            </span>
            {releaseLevelBadge && (
              <span
                className={twMerge(
                  'px-2.5 py-1 rounded-md text-xs font-medium uppercase',
                  releaseLevelBadge.className,
                )}
              >
                {releaseLevelBadge.label}
              </span>
            )}
            {entry.featured && (
              <span className="px-2.5 py-1 rounded-md text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                ⭐ Featured
              </span>
            )}
            {!entry.showInFeed && (
              <span className="px-2.5 py-1 rounded-md text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                Hidden
              </span>
            )}
          </div>

          {/* Title */}
          <Link
            to="/feed/$id"
            params={{ id: entry._id }}
            className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block"
          >
            {entry.title}
          </Link>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
            <time
              dateTime={new Date(entry.publishedAt).toISOString()}
              title={format(new Date(entry.publishedAt), 'PPpp')}
              className="cursor-help"
            >
              {formatDistanceToNow(new Date(entry.publishedAt), {
                addSuffix: true,
              })}
            </time>
            {entry.autoSynced && (
              <span className="capitalize">
                {entry.entryType === 'release' ? 'GitHub' : entry.entryType}
              </span>
            )}
            {entryLibraries.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Libraries:</span>
                <div className="flex gap-1 flex-wrap">
                  {entryLibraries.map((lib) => (
                    <span
                      key={lib!.id}
                      className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs"
                    >
                      {lib!.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entryPartners.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Partners:</span>
                <div className="flex gap-1 flex-wrap">
                  {entryPartners.map((partner) => (
                    <span
                      key={partner!.id}
                      className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs"
                    >
                      {partner!.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        {adminActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {adminActions.onEdit && (
              <button
                onClick={() => adminActions.onEdit!(entry)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
                title="Edit"
              >
                <SquarePen className="w-4 h-4" />
              </button>
            )}
            {adminActions.onToggleVisibility && (
              <button
                onClick={() =>
                  adminActions.onToggleVisibility!(entry, !entry.showInFeed)
                }
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
                title={entry.showInFeed ? 'Hide' : 'Show'}
              >
                {entry.showInFeed ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}
            {adminActions.onToggleFeatured && (
              <button
                onClick={() =>
                  adminActions.onToggleFeatured!(entry, !entry.featured)
                }
                className={twMerge(
                  'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors',
                  entry.featured
                    ? 'text-yellow-500'
                    : 'text-gray-600 dark:text-gray-400',
                )}
                title="Toggle Featured"
              >
                <Star className="w-4 h-4" />
              </button>
            )}
            {adminActions.onDelete && (
              <button
                onClick={() => adminActions.onDelete!(entry)}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors text-red-500"
                title="Delete"
              >
                <Trash className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mb-4">
        {/* Tags - Only show when expanded */}
        {expanded && entry.tags.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Tags:
            </span>
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content - Truncated when not expanded */}
        <div
          className={twMerge(
            'text-sm text-gray-900 dark:text-gray-100 leading-relaxed prose prose-sm dark:prose-invert max-w-none',
            !expanded && 'line-clamp-6',
          )}
        >
          <Markdown rawContent={entry.content} />
        </div>

        {/* Show more/less button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      </div>

      {/* Footer */}
      {externalLink && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            View on {entry.entryType === 'release' ? 'GitHub' : 'Blog'} →
          </a>
        </div>
      )}
    </Card>
  )
}
