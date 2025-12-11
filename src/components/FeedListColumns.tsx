import * as React from 'react'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedColumn } from '~/components/FeedColumn'
import type { FeedFilters } from '~/queries/feed'

interface FeedListColumnsProps {
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

// Known sources - could also be fetched from facet counts
const KNOWN_SOURCES = ['github', 'blog', 'announcement'] as const

export function FeedListColumns({
  filters,
  pageSize,
  expandedIds,
  onExpandedChange,
  onViewModeChange,
  onFiltersChange,
  adminActions,
}: FeedListColumnsProps) {
  return (
    <div
      className="min-w-0 overflow-x-auto -mx-2 pl-2 flex-1 flex gap-2 min-h-0"
    >
      {KNOWN_SOURCES.map((source) => (
        <FeedColumn
          key={source}
          source={source}
          filters={filters}
          pageSize={pageSize}
          expandedIds={expandedIds}
          onExpandedChange={onExpandedChange}
          onViewModeChange={onViewModeChange}
          onFiltersChange={onFiltersChange}
          adminActions={adminActions}
        />
      ))}
      <div className="w-4 flex-grow-1 flex-shrink-0 flex-basis-4" />
    </div>
  )
}
