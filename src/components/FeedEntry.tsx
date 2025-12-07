import { format, formatDistanceToNow } from 'date-fns'
import { Markdown } from '~/components/Markdown'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { twMerge } from 'tailwind-merge'
import { FaEdit, FaTrash, FaEye, FaEyeSlash, FaStar } from 'react-icons/fa'
import { Link } from '@tanstack/react-router'
import { TableRow, TableCell } from '~/components/TableComponents'

export interface FeedEntry {
  _id: string
  id: string
  source: string
  title: string
  content: string
  excerpt?: string
  publishedAt: number
  metadata?: any
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  category: 'release' | 'announcement' | 'blog' | 'partner' | 'update' | 'other'
  isVisible: boolean
  featured?: boolean
  autoSynced: boolean
}

interface FeedEntryProps {
  entry: FeedEntry
  showFullContent?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  adminActions?: {
    onEdit?: (entry: FeedEntry) => void
    onToggleVisibility?: (entry: FeedEntry, isVisible: boolean) => void
    onToggleFeatured?: (entry: FeedEntry, featured: boolean) => void
    onDelete?: (entry: FeedEntry) => void
  }
}

export function FeedEntry({
  entry,
  showFullContent = false,
  expanded: expandedProp,
  onExpandedChange,
  adminActions,
}: FeedEntryProps) {
  const expanded = expandedProp ?? showFullContent
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
    // Check if this is a prerelease
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

  // Get release level badge if present
  // Prereleases will have both release:prerelease and release:major/minor/patch tags
  // We want to show the base release level (major/minor/patch) badge
  const getReleaseLevelBadge = () => {
    // Find the base release level tag (major/minor/patch), ignoring prerelease tag
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
      if (entry.source === 'github' && entry.metadata.url) {
        return entry.metadata.url
      }
      if (entry.source === 'blog' && entry.metadata.url) {
        return entry.metadata.url
      }
    }
    return null
  }

  const externalLink = getExternalLink()

  const colSpan = adminActions ? 7 : 6

  return (
    <>
      {/* Table Row */}
      <TableRow
        className={twMerge(
          'cursor-pointer',
          entry.featured && 'bg-yellow-50 dark:bg-yellow-900/10',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand Arrow */}
        <TableCell className="w-5 whitespace-nowrap">
          <button
            className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            <svg
              className={twMerge(
                'w-3.5 h-3.5 transition-transform',
                expanded && 'rotate-90',
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </TableCell>

        {/* Date */}
        <TableCell className="hidden sm:table-cell text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
          <time
            dateTime={new Date(entry.publishedAt).toISOString()}
            title={format(new Date(entry.publishedAt), 'PPpp')}
            className="cursor-help"
          >
            {formatDistanceToNow(new Date(entry.publishedAt), {
              addSuffix: true,
            })}
          </time>
        </TableCell>

        {/* Badges */}
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-1">
            {/* Category Badge (Release, Blog, Announcement, etc.) */}
            <span
              className={twMerge(
                'px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
                badge.className,
              )}
            >
              {badge.label}
            </span>
            {/* Release Level Badge (Major, Minor, Patch, Pre) */}
            {releaseLevelBadge && (
              <span
                className={twMerge(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
                  releaseLevelBadge.className,
                )}
              >
                {releaseLevelBadge.label}
              </span>
            )}
          </div>
        </TableCell>

        {/* Title */}
        <TableCell className="whitespace-nowrap">
          <Link
            to="/feed/$id"
            params={{ id: entry._id }}
            search={{} as any}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {entry.title}
          </Link>
        </TableCell>

        {/* Excerpt */}
        <TableCell className="hidden md:table-cell whitespace-nowrap">
          {entry.excerpt ? (
            <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate">
              {entry.excerpt.replace(/\n/g, ' ')}
            </p>
          ) : (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              —
            </span>
          )}
        </TableCell>

        {/* Tags/Badges */}
        <TableCell className="hidden md:table-cell whitespace-nowrap">
          <div className="flex items-center gap-1">
            {entry.featured && (
              <span className="px-1 py-0.5 rounded text-[10px] bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                ⭐
              </span>
            )}
            {!entry.isVisible && (
              <span className="px-1 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                Hidden
              </span>
            )}
            {entryLibraries.length > 0 && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {entryLibraries.map((lib) => lib!.name).join(', ')}
              </span>
            )}
          </div>
        </TableCell>

        {/* Admin Actions Column */}
        {adminActions && (
          <TableCell
            className="hidden md:table-cell text-right whitespace-nowrap"
            align="right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end gap-0.5">
              {adminActions.onEdit && (
                <button
                  onClick={() => adminActions.onEdit!(entry)}
                  className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
                  title="Edit"
                >
                  <FaEdit className="w-3 h-3" />
                </button>
              )}
              {adminActions.onToggleVisibility && (
                <button
                  onClick={() =>
                    adminActions.onToggleVisibility!(entry, !entry.isVisible)
                  }
                  className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
                  title={entry.isVisible ? 'Hide' : 'Show'}
                >
                  {entry.isVisible ? (
                    <FaEye className="w-3 h-3" />
                  ) : (
                    <FaEyeSlash className="w-3 h-3" />
                  )}
                </button>
              )}
              {adminActions.onToggleFeatured && (
                <button
                  onClick={() =>
                    adminActions.onToggleFeatured!(entry, !entry.featured)
                  }
                  className={`p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors ${
                    entry.featured
                      ? 'text-yellow-500'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="Toggle Featured"
                >
                  <FaStar className="w-3 h-3" />
                </button>
              )}
              {adminActions.onDelete && (
                <button
                  onClick={() => adminActions.onDelete!(entry)}
                  className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors text-red-500"
                  title="Delete"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Expanded Content */}
      {expanded && (
        <TableRow className="bg-gray-50 dark:bg-gray-900/30">
          <TableCell colSpan={colSpan} className="px-2 py-4">
            <div className="pl-8">
              {/* Metadata Row */}
              <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-600 dark:text-gray-400">
                {entry.source !== 'announcement' && (
                  <span className="capitalize">{entry.source}</span>
                )}
                {entryLibraries.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span>Libraries:</span>
                    <div className="flex gap-1">
                      {entryLibraries.map((lib) => (
                        <span
                          key={lib!.id}
                          className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
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
                    <div className="flex gap-1">
                      {entryPartners.map((partner) => (
                        <span
                          key={partner!.id}
                          className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                        >
                          {partner!.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {entry.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span>Tags:</span>
                    <div className="flex gap-1 flex-wrap">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="text-xs text-gray-900 dark:text-gray-100 leading-snug mb-3">
                <Markdown rawContent={entry.content} />
              </div>

              {/* External Link */}
              {externalLink && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on {entry.source === 'github' ? 'GitHub' : 'Blog'} →
                  </a>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
