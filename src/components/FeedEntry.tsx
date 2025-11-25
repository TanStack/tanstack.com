import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Markdown } from '~/components/Markdown'
import { libraries } from '~/libraries'
import { partners } from '~/utils/partners'
import { twMerge } from 'tailwind-merge'

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
  priority?: number
  featured?: boolean
  autoSynced: boolean
}

interface FeedEntryProps {
  entry: FeedEntry
  showFullContent?: boolean
}

export function FeedEntry({ entry, showFullContent = false }: FeedEntryProps) {
  const [expanded, setExpanded] = React.useState(showFullContent)

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
    if (entry.category === 'release') {
      return {
        label: 'Release',
        className:
          'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      }
    }
    if (entry.category === 'blog') {
      return {
        label: 'Blog',
        className:
          'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      }
    }
    if (entry.category === 'announcement') {
      return {
        label: 'Announcement',
        className:
          'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      }
    }
    if (entry.category === 'partner') {
      return {
        label: 'Partner',
        className:
          'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      }
    }
    return {
      label: entry.source,
      className:
        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
    }
  }

  const badge = getTypeBadge()

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

  return (
    <article
      className={twMerge(
        'border-2 border-transparent rounded-lg p-4 md:p-8',
        'transition-all bg-white dark:bg-gray-800',
        'shadow-xl dark:shadow-lg dark:shadow-blue-500/30',
        entry.featured && 'border-blue-500',
        'hover:border-blue-500'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={twMerge(
                'px-2 py-1 rounded text-xs font-semibold uppercase',
                badge.className
              )}
            >
              {badge.label}
            </span>
            {entry.featured && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                Featured
              </span>
            )}
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
          <h2 className="text-xl font-extrabold mb-2">{entry.title}</h2>
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <time dateTime={new Date(entry.publishedAt).toISOString()}>
              {format(new Date(entry.publishedAt), 'MMM dd, yyyy')}
            </time>
            {entry.source !== 'manual' && (
              <span className="capitalize">{entry.source}</span>
            )}
          </div>
        </div>
      </div>

      {/* Libraries and Partners */}
      {(entryLibraries.length > 0 || entryPartners.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {entryLibraries.map((lib) => (
            <span
              key={lib!.id}
              className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
            >
              {lib!.name}
            </span>
          ))}
          {entryPartners.map((partner) => (
            <span
              key={partner!.id}
              className="px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
            >
              {partner!.name}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="text-sm text-black dark:text-white leading-7 mb-4">
        {expanded ? (
          <Markdown rawContent={entry.content} />
        ) : (
          <Markdown rawContent={entry.excerpt || entry.content} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {externalLink ? (
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 uppercase font-black text-sm hover:underline"
          >
            Read More →
          </a>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-500 uppercase font-black text-sm hover:underline"
          >
            {expanded ? 'Show Less' : 'Read More'}
          </button>
        )}
      </div>
    </article>
  )
}
