import * as React from 'react'
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from '~/utils/dates'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { renderMarkdownToJsx } from '~/utils/markdown'
import { Card } from '~/components/Card'

// Serializable context passed to action slots
export interface FeedActionContext {
  id: string
  entryType: 'release' | 'blog' | 'announcement'
  showInFeed: boolean
  featured: boolean
  externalLink: string | null
}

// Entry data shape for composites
interface FeedEntryData {
  _id: string
  id: string
  entryType: 'release' | 'blog' | 'announcement'
  title: string
  content: string
  excerpt?: string | null
  publishedAt: number
  metadata?: Record<string, string | number | boolean | null | undefined>
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  showInFeed: boolean
  featured?: boolean
}

// Badge config helpers
function getTypeBadge(entry: FeedEntryData) {
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

function getReleaseLevelBadge(entry: FeedEntryData) {
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

function getExternalLink(entry: FeedEntryData): string | null {
  if (entry.metadata) {
    if (entry.entryType === 'release' && entry.metadata.url) {
      return entry.metadata.url as string
    }
    if (entry.entryType === 'blog' && entry.metadata.url) {
      return entry.metadata.url as string
    }
  }
  return null
}

function getEntryLibraries(entry: FeedEntryData) {
  return entry.libraryIds
    .map((id) => libraries.find((lib) => lib.id === id))
    .filter((lib): lib is (typeof libraries)[number] => lib !== undefined)
}

function getEntryPartners(entry: FeedEntryData) {
  return entry.partnerIds
    ? entry.partnerIds
        .map((id) => partners.find((p) => p.id === id))
        .filter((p): p is (typeof partners)[number] => p !== undefined)
    : []
}

// Timeline card composite props
type TimelineCardCompositeProps = {
  renderActions?: (ctx: FeedActionContext) => React.ReactNode
  renderExpandToggle?: (ctx: { id: string }) => React.ReactNode
  children?: React.ReactNode
}

// Detail view composite props
type DetailCompositeProps = {
  renderActions?: (ctx: FeedActionContext) => React.ReactNode
  children?: React.ReactNode
}

/**
 * Create a composite for timeline card view.
 * Content is always rendered, expand/collapse is handled via CSS (line-clamp) on client.
 */
export async function createFeedTimelineComposite(entry: FeedEntryData) {
  const { content: contentJsx } = entry.content
    ? await renderMarkdownToJsx(entry.content)
    : { content: null }

  const badge = getTypeBadge(entry)
  const releaseLevelBadge = getReleaseLevelBadge(entry)
  const externalLink = getExternalLink(entry)
  const entryLibraries = getEntryLibraries(entry)
  const entryPartners = getEntryPartners(entry)

  const actionCtx: FeedActionContext = {
    id: entry._id,
    entryType: entry.entryType,
    showInFeed: entry.showInFeed,
    featured: entry.featured ?? false,
    externalLink,
  }

  return createCompositeComponent((props: TimelineCardCompositeProps) => (
    <Card
      as="article"
      className={twMerge(
        'p-6 transition-all',
        'hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700',
        entry.featured &&
          'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800',
      )}
      data-entry-id={entry._id}
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
                Featured
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
            {entryLibraries.length > 0 && (
              <div className="flex items-center gap-2">
                <span>Libraries:</span>
                <div className="flex gap-1 flex-wrap">
                  {entryLibraries.map((lib) => (
                    <span
                      key={lib.id}
                      className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs"
                    >
                      {lib.name}
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
                      key={partner.id}
                      className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs"
                    >
                      {partner.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {props.renderActions?.(actionCtx)}
        </div>
      </div>

      {/* Content container - expand toggle applies line-clamp via data attribute */}
      <div
        className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed prose prose-sm dark:prose-invert max-w-none feed-timeline-content"
        data-content-id={entry._id}
      >
        {contentJsx}
      </div>

      {/* Expand toggle slot */}
      {props.renderExpandToggle?.({ id: entry._id })}

      {/* External Link */}
      {externalLink && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on {entry.entryType === 'release' ? 'GitHub' : 'External'}
          </a>
        </div>
      )}

      {/* Client slot */}
      {props.children}
    </Card>
  ))
}

/**
 * Create a composite for detail view.
 */
export async function createFeedDetailComposite(entry: FeedEntryData) {
  const { content: contentJsx } = entry.content
    ? await renderMarkdownToJsx(entry.content)
    : { content: null }

  const badge = getTypeBadge(entry)
  const releaseLevelBadge = getReleaseLevelBadge(entry)
  const externalLink = getExternalLink(entry)
  const entryLibraries = getEntryLibraries(entry)
  const entryPartners = getEntryPartners(entry)

  const actionCtx: FeedActionContext = {
    id: entry._id,
    entryType: entry.entryType,
    showInFeed: entry.showInFeed,
    featured: entry.featured ?? false,
    externalLink,
  }

  return createCompositeComponent((props: DetailCompositeProps) => (
    <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span
            className={twMerge(
              'px-3 py-1.5 rounded-md text-sm font-medium uppercase',
              badge.className,
            )}
          >
            {badge.label}
          </span>
          {releaseLevelBadge && (
            <span
              className={twMerge(
                'px-3 py-1.5 rounded-md text-sm font-medium uppercase',
                releaseLevelBadge.className,
              )}
            >
              {releaseLevelBadge.label}
            </span>
          )}
          {entry.featured && (
            <span className="px-3 py-1.5 rounded-md text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
              Featured
            </span>
          )}
          {!entry.showInFeed && (
            <span className="px-3 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
              Hidden
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {entry.title}
        </h1>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
          <time
            dateTime={new Date(entry.publishedAt).toISOString()}
            title={format(new Date(entry.publishedAt), 'PPpp')}
            className="cursor-help"
          >
            {format(new Date(entry.publishedAt), 'MMMM d, yyyy')} (
            {formatDistanceToNow(new Date(entry.publishedAt), {
              addSuffix: true,
            })}
            )
          </time>
        </div>

        {/* Libraries and Partners */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {entryLibraries.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Libraries:
              </span>
              <div className="flex gap-1 flex-wrap">
                {entryLibraries.map((lib) => (
                  <span
                    key={lib.id}
                    className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium"
                  >
                    {lib.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entryPartners.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Partners:
              </span>
              <div className="flex gap-1 flex-wrap">
                {entryPartners.map((partner) => (
                  <span
                    key={partner.id}
                    className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs font-medium"
                  >
                    {partner.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admin Actions slot */}
        {props.renderActions?.(actionCtx)}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none mb-4 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 styled-markdown-content">
          {contentJsx}
        </div>

        {/* External Link */}
        {externalLink && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium inline-flex items-center gap-2"
            >
              View on {entry.entryType === 'release' ? 'GitHub' : 'Blog'}
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}

        {/* Client slot */}
        {props.children}
      </div>
    </article>
  ))
}

// Re-export types for consumers
export type { FeedEntryData }
