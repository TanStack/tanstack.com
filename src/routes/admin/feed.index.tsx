import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useToggleFeedEntryVisibility,
  useSetFeedEntryFeatured,
  useDeleteFeedEntry,
} from '~/utils/mutations'
import { FaPlus } from 'react-icons/fa'
import { z } from 'zod'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedSyncStatus } from '~/components/admin/FeedSyncStatus'
import { FeedPage as FeedPageComponent } from '~/components/FeedPage'
import { useFeedQuery } from '~/hooks/useFeedQuery'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { FEED_DEFAULTS } from '~/utils/feedDefaults'
import { libraries, type LibraryId } from '~/libraries'
import { FEED_CATEGORIES, RELEASE_LEVELS } from '~/utils/feedSchema'
const libraryIds = libraries.map((lib) => lib.id) as readonly LibraryId[]
const librarySchema = z.enum(libraryIds as [LibraryId, ...LibraryId[]])
const categorySchema = z.enum(FEED_CATEGORIES)
const releaseLevelSchema = z.enum(RELEASE_LEVELS)
const viewModeSchema = z
  .enum(['table', 'timeline'])
  .optional()
  .default('table')
  .catch('table')

export const Route = createFileRoute('/admin/feed/')({
  component: FeedAdminPage,
  validateSearch: (search) => {
    const hasReleaseLevels = 'releaseLevels' in search
    const releaseLevelsValue = search.releaseLevels

    return z
      .object({
        sources: z.array(z.string()).optional().catch(undefined),
        libraries: z.array(librarySchema).optional().catch(undefined),
        categories: z.array(categorySchema).optional().catch(undefined),
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
      sources: search.sources,
      libraries: search.libraries,
      categories: search.categories,
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
    <div className="flex-1 min-w-0 flex flex-col gap-4 p-2 sm:p-4 pb-0 min-h-0">
      <FeedSyncStatus
        onSyncComplete={() => {
          feedQuery.refetch()
        }}
      />
      <div className="flex-1 min-h-0 relative">
        <FeedPageComponent
          search={search}
          onNavigate={(updates) => {
            navigate({
              search: (s) => ({ ...s, ...updates.search }),
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
          headerTitle="Feed Admin"
          headerActions={
            <Link
              to="/admin/feed/$id"
              params={{ id: 'new' }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <FaPlus />
              Create Entry
            </Link>
          }
          showFooter={false}
        />
      </div>
    </div>
  )
}
