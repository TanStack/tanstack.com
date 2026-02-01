import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useToggleFeedEntryVisibility,
  useSetFeedEntryFeatured,
  useDeleteFeedEntry,
} from '~/utils/mutations'
import * as v from 'valibot'
import { Plus } from 'lucide-react'
import { Button } from '~/ui'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedSyncStatus } from '~/components/admin/FeedSyncStatus'
import { FeedPage as FeedPageComponent } from '~/components/FeedPage'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import {
  libraryIdSchema,
  entryTypeSchema,
  releaseLevelSchema,
} from '~/utils/schemas'
import { AdminAccessDenied, AdminLoading } from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { useDeleteWithConfirmation } from '~/hooks/useDeleteWithConfirmation'

const searchSchema = v.object({
  entryTypes: v.optional(v.array(entryTypeSchema)),
  libraries: v.optional(v.array(libraryIdSchema)),
  partners: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  releaseLevels: v.optional(v.array(releaseLevelSchema)),
  includePrerelease: v.optional(v.boolean()),
  featured: v.optional(v.boolean()),
  search: v.optional(v.string()),
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50),
  viewMode: v.optional(
    v.fallback(v.picklist(['table', 'timeline']), 'table'),
    'table',
  ),
  expanded: v.optional(v.array(v.string())),
})

export const Route = createFileRoute('/admin/feed/')({
  component: FeedAdminPage,
  validateSearch: searchSchema,
})

function FeedAdminPage() {
  const guard = useAdminGuard()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const feedQuery = useFeedQuery({
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 50,
    filters: {
      entryTypes: search.entryTypes,
      libraries: search.libraries,
      partners: search.partners,
      tags: search.tags,
      releaseLevels: search.releaseLevels,
      includePrerelease: search.includePrerelease,
      featured: search.featured,
      search: search.search,
      includeHidden: true,
    },
  })

  const toggleVisibility = useToggleFeedEntryVisibility()
  const setFeatured = useSetFeedEntryFeatured()
  const deleteEntry = useDeleteFeedEntry()

  const handleToggleVisibility = async (
    entry: FeedEntry,
    isVisible: boolean,
  ) => {
    await toggleVisibility.mutateAsync({ id: entry.id, showInFeed: isVisible })
    feedQuery.refetch()
  }

  const handleToggleFeatured = async (entry: FeedEntry, featured: boolean) => {
    await setFeatured.mutateAsync({ id: entry.id, featured })
    feedQuery.refetch()
  }

  const { handleDelete } = useDeleteWithConfirmation({
    getItemName: (entry: FeedEntry) => entry.title,
    deleteFn: async (entry) => {
      await deleteEntry.mutateAsync({ id: entry.id })
      feedQuery.refetch()
    },
    itemLabel: 'entry',
  })

  const handleEdit = (entry: FeedEntry) => {
    navigate({
      to: '/admin/feed/$id',
      params: { id: entry.id },
    })
  }

  if (guard.status === 'loading') {
    return <AdminLoading />
  }
  if (guard.status === 'denied') {
    return <AdminAccessDenied />
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4 pt-4 pb-0 min-h-0">
      <div className="px-2 sm:px-4 flex items-center justify-between">
        <h1 className="text-3xl font-black">Feed Admin</h1>
        <Link to="/admin/feed/$id" params={{ id: 'new' }}>
          <Button size="sm">
            <Plus />
            Create Entry
          </Button>
        </Link>
      </div>
      <div className="px-2 sm:px-4">
        <FeedSyncStatus
          onSyncComplete={() => {
            feedQuery.refetch()
          }}
        />
      </div>
      <div className="flex-1 min-h-0 relative">
        <FeedPageComponent
          search={search}
          onNavigate={(updates) => {
            navigate({
              search: (s: typeof search) => ({ ...s, ...updates.search }),
              replace: updates.replace ?? true,
              resetScroll: updates.resetScroll ?? false,
            })
          }}
          includeHidden={true}
          adminActions={{
            onEdit: handleEdit,
            onToggleVisibility: handleToggleVisibility,
            onToggleFeatured: handleToggleFeatured,
            onDelete: handleDelete,
          }}
        />
      </div>
    </div>
  )
}
