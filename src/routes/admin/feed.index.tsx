import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useToggleFeedEntryVisibility,
  useSetFeedEntryFeatured,
  useDeleteFeedEntry,
} from '~/utils/mutations'
import * as v from 'valibot'
import { Plus } from 'lucide-react'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedSyncStatus } from '~/components/admin/FeedSyncStatus'
import { FeedPage as FeedPageComponent } from '~/components/FeedPage'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { libraries, type LibraryId } from '~/libraries'
import { ENTRY_TYPES, RELEASE_LEVELS } from '~/utils/feedSchema'
const libraryIds = libraries.map((lib) => lib.id) as readonly LibraryId[]
const librarySchema = v.picklist(libraryIds as [LibraryId, ...LibraryId[]])
const entryTypeSchema = v.picklist(ENTRY_TYPES)
const releaseLevelSchema = v.picklist(RELEASE_LEVELS)

export const Route = createFileRoute('/admin/feed/')({
  component: FeedAdminPage,
  validateSearch: (search: Record<string, unknown>) => {
    const hasReleaseLevels = 'releaseLevels' in search
    const releaseLevelsValue = search.releaseLevels

    return v.parse(
      v.object({
        entryTypes: v.optional(v.array(entryTypeSchema)),
        libraries: v.optional(v.array(librarySchema)),
        partners: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
        releaseLevels: hasReleaseLevels
          ? v.fallback(
              v.array(releaseLevelSchema),
              Array.isArray(releaseLevelsValue) ? releaseLevelsValue : [],
            )
          : v.optional(v.array(releaseLevelSchema)),
        includePrerelease: v.optional(v.boolean()),
        featured: v.optional(v.boolean()),
        search: v.optional(v.string()),
        page: v.optional(v.number(), 1),
        pageSize: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(1)),
          50,
        ),
        viewMode: v.optional(
          v.fallback(v.picklist(['table', 'timeline']), 'table'),
          'table',
        ),
        expanded: v.optional(v.array(v.string())),
      }),
      search,
    )
  },
})

function FeedAdminPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()

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
    await toggleVisibility.mutateAsync({ id: entry.id, isVisible })
    feedQuery.refetch()
  }

  const handleToggleFeatured = async (entry: FeedEntry, featured: boolean) => {
    await setFeatured.mutateAsync({ id: entry.id, featured })
    feedQuery.refetch()
  }

  const handleDelete = async (entry: FeedEntry) => {
    if (window.confirm(`Are you sure you want to delete "${entry.title}"?`)) {
      await deleteEntry.mutateAsync({ id: entry.id })
      feedQuery.refetch()
    }
  }

  const handleEdit = (entry: FeedEntry) => {
    navigate({
      to: '/admin/feed/$id',
      params: { id: entry.id },
    })
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  const canAdmin = capabilities.includes('admin')
  if (user && !canAdmin) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4 pt-4 pb-0 min-h-0">
      <div className="px-2 sm:px-4 flex items-center justify-between">
        <h1 className="text-3xl font-black">Feed Admin</h1>
        <Link
          to="/admin/feed/$id"
          params={{ id: 'new' }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
        >
          <Plus />
          Create Entry
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
