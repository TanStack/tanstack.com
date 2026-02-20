import * as React from 'react'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { twMerge } from 'tailwind-merge'
import { Eye, EyeOff, SquarePen, Star, Trash } from 'lucide-react'
import type { FeedEntry } from './FeedEntry'
import type { FeedActionContext } from '~/utils/feed.composites'

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

// Type for timeline composite props (matches feed.composites.tsx)
type TimelineCompositeProps = {
  renderActions?: (ctx: FeedActionContext) => React.ReactNode
  renderExpandToggle?: (ctx: { id: string }) => React.ReactNode
  children?: React.ReactNode
}

// CompositeComponent with slot props - cast to avoid type mismatch
const TimelineComposite = CompositeComponent as unknown as React.FC<
  { src: FeedEntry['timelineCompositeSrc'] } & TimelineCompositeProps
>

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

  // If no composite source available, don't render
  if (!entry.timelineCompositeSrc) {
    return null
  }

  return (
    <div
      className={twMerge(
        'feed-timeline-entry',
        !expanded && '[&_.feed-timeline-content]:line-clamp-6',
      )}
    >
      <TimelineComposite
        src={entry.timelineCompositeSrc}
        renderActions={(ctx: FeedActionContext) =>
          adminActions ? (
            <AdminActions ctx={ctx} entry={entry} adminActions={adminActions} />
          ) : null
        }
        renderExpandToggle={() => (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      />
    </div>
  )
}

// Admin actions component (client-side)
function AdminActions({
  ctx,
  entry,
  adminActions,
}: {
  ctx: FeedActionContext
  entry: FeedEntry
  adminActions: NonNullable<FeedEntryTimelineProps['adminActions']>
}) {
  return (
    <>
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
            adminActions.onToggleVisibility!(entry, !ctx.showInFeed)
          }
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-600 dark:text-gray-400"
          title={ctx.showInFeed ? 'Hide' : 'Show'}
        >
          {ctx.showInFeed ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      )}
      {adminActions.onToggleFeatured && (
        <button
          onClick={() => adminActions.onToggleFeatured!(entry, !ctx.featured)}
          className={twMerge(
            'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors',
            ctx.featured
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
    </>
  )
}
