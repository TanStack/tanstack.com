import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useToggleFeedEntryVisibility,
  useSetFeedEntryFeatured,
  useDeleteFeedEntry,
} from '~/utils/mutations'
import { z } from 'zod'
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
const librarySchema = z.enum(libraryIds as [LibraryId, ...LibraryId[]])
const entryTypeSchema = z.enum(ENTRY_TYPES)
const releaseLevelSchema = z.enum(RELEASE_LEVELS)
const viewModeSchema = z
  .enum(['table', 'timeline'])
  .optional()
  .default('table')
  .catch('table')

export const Route = createFileRoute('/admin/feed/')({
  component: FeedAdminPage,
  validateSearch: (search: Record<string, unknown>) => {
    const hasReleaseLevels = 'releaseLevels' in search
    const releaseLevelsValue = search.releaseLevels

    return z
      .object({
        entryTypes: z.array(entryTypeSchema).optional().catch(undefined),
        libraries: z.array(librarySchema).optional().catch(undefined),
        partners: z.array(z.string()).optional().catch(undefined),
        tags: z.array(z.string()).optional().catch(undefined),
        releaseLevels: hasReleaseLevels
          ? z
              .array(releaseLevelSchema)
              .catch(
                Array.isArray(releaseLevelsValue) ? releaseLevelsValue : [],
              )
          : z.array(releaseLevelSchema).optional().catch(undefined),
        includePrerelease: z.boolean().optional().catch(undefined),
        featured: z.boolean().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(50).catch(50),
        viewMode: viewModeSchema,
        expanded: z.array(z.string()).optional().catch(undefined),
      })
      .parse(search)
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
          <Plus size={14} />
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
