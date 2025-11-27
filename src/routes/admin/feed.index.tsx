import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { api } from 'convex/_generated/api'
import { FaPlus } from 'react-icons/fa'
import { z } from 'zod'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedSyncStatus } from '~/components/admin/FeedSyncStatus'
import { FeedPageLayout } from '~/components/FeedPageLayout'
import { useFeedQuery } from '~/hooks/useFeedQuery'

const librarySchema = z.enum([
  'start',
  'router',
  'query',
  'table',
  'form',
  'virtual',
  'ranger',
  'store',
  'pacer',
  'db',
  'config',
  'react-charts',
  'devtools',
  'create-tsrouter-app',
])

const categorySchema = z.enum([
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
])

const releaseLevelSchema = z.enum(['major', 'minor', 'patch'])

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
                Array.isArray(releaseLevelsValue) ? releaseLevelsValue : []
              )
          : z
              .array(releaseLevelSchema)
              .optional()
              .default(['major', 'minor'])
              .catch(['major', 'minor']),
        includePrerelease: z.boolean().optional().default(true).catch(true),
        featured: z.boolean().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(20).catch(20),
      })
      .parse(search)
  },
})

function FeedAdminPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const currentPage = search.page ?? 1

  const user = useConvexQuery(api.auth.getCurrentUser)
  const pageSize = search.pageSize ?? 20
  const feedQuery = useFeedQuery({
    page: currentPage,
    pageSize,
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

  const toggleVisibility = useConvexMutation(
    api.feed.mutations.toggleFeedEntryVisibility
  )
  const setFeatured = useConvexMutation(api.feed.mutations.setFeedEntryFeatured)
  const deleteEntry = useConvexMutation(api.feed.mutations.deleteFeedEntry)

  const handleToggleVisibility = async (
    entry: FeedEntry,
    isVisible: boolean
  ) => {
    await toggleVisibility({ id: entry.id, isVisible })
    feedQuery.refetch()
  }

  const handleToggleFeatured = async (entry: FeedEntry, featured: boolean) => {
    await setFeatured({ id: entry.id, featured })
    feedQuery.refetch()
  }

  const handleDelete = async (entry: FeedEntry) => {
    if (window.confirm(`Are you sure you want to delete "${entry.title}"?`)) {
      await deleteEntry({ id: entry.id })
      feedQuery.refetch()
    }
  }

  const handleEdit = (entry: FeedEntry) => {
    navigate({
      to: '/admin/feed/$id',
      params: { id: entry.id },
    })
  }

  const handleFiltersChange = (newFilters: Partial<typeof search>) => {
    navigate({
      search: (s) => ({
        ...s,
        ...newFilters,
        page: 1,
      }),
      replace: true,
    })
  }

  const handleClearFilters = () => {
    navigate({
      search: {
        releaseLevels: ['major', 'minor'],
        includePrerelease: true,
        page: 1,
        pageSize: pageSize,
      },
      replace: true,
    })
  }

  const handlePageSizeChange = (newPageSize: number) => {
    navigate({
      search: (s) => ({
        ...s,
        pageSize: newPageSize,
        page: 1,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  const canAdmin = user?.capabilities.includes('admin')
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
    <FeedPageLayout.Root
      feedQuery={feedQuery}
      currentPage={currentPage}
      pageSize={pageSize}
      filters={search as any}
      onFiltersChange={handleFiltersChange as any}
      onClearFilters={handleClearFilters}
      onPageChange={(page) => {
        navigate({
          search: (s) => ({ ...s, page }),
          replace: true,
          resetScroll: false,
        })
      }}
      onPageSizeChange={handlePageSizeChange}
      adminActions={{
        onEdit: handleEdit,
        onToggleVisibility: handleToggleVisibility,
        onToggleFeatured: handleToggleFeatured,
        onDelete: handleDelete,
      }}
    >
      <FeedPageLayout.Header
        title="Feed Admin"
        actions={
          <Link
            to="/admin/feed/$id"
            params={{ id: 'new' }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <FaPlus />
            Create Entry
          </Link>
        }
        extra={<FeedSyncStatus />}
      />
      <div className="flex flex-col lg:flex-row gap-8">
        <FeedPageLayout.Filters />
        <FeedPageLayout.Content />
      </div>
    </FeedPageLayout.Root>
  )
}
