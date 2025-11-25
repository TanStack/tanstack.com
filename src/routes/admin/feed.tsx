import { Link, createFileRoute } from '@tanstack/react-router'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaEyeSlash,
  FaStar,
  FaPlus,
} from 'react-icons/fa'
import { convexQuery } from '@convex-dev/react-query'
import { z } from 'zod'
import { FeedEntry } from '~/components/FeedEntry'
import { FeedSyncStatus } from '~/components/admin/FeedSyncStatus'
import { format } from 'date-fns'

export const Route = createFileRoute('/admin/feed')({
  component: FeedAdminPage,
  validateSearch: z.object({
    page: z.number().int().nonnegative().optional(),
    source: z.string().optional(),
    search: z.string().optional(),
  }),
})

function FeedAdminPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const currentPageIndex = search.page ?? 0
  const pageSize = 20

  const user = useConvexQuery(api.auth.getCurrentUser)
  const feedQuery = useQuery({
    ...convexQuery(api.feed.queries.listFeedEntries, {
      pagination: {
        limit: pageSize,
        page: currentPageIndex,
      },
      filters: {
        sources: search.source ? [search.source] : undefined,
        search: search.search,
        includeHidden: true, // Show all entries including hidden ones in admin
      },
    }),
    placeholderData: keepPreviousData,
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access the admin area.
          </p>
        </div>
      </div>
    )
  }

  const data = feedQuery.data

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black">Feed Admin</h1>
          <Link
            to="/admin/feed/$id"
            params={{ id: 'new' }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <FaPlus />
            Create Entry
          </Link>
        </div>

        {/* Sync Status */}
        <div className="mb-6">
          <FeedSyncStatus />
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search entries..."
            value={search.search || ''}
            onChange={(e) => {
              const value = e.target.value || undefined
              navigate({
                search: {
                  search: value,
                  source: search.source,
                  page: value !== search.search ? 0 : search.page,
                },
              })
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          />
          <select
            value={search.source || ''}
            onChange={(e) => {
              const value = e.target.value || undefined
              navigate({
                search: {
                  search: search.search,
                  source: value,
                  page: value !== search.source ? 0 : search.page,
                },
              })
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
          >
            <option value="">All Sources</option>
            <option value="github">GitHub</option>
            <option value="blog">Blog</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {/* Feed Entries List */}
        {feedQuery.isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : feedQuery.isError ? (
          <div className="text-center py-12 text-red-500">
            Error loading feed entries
          </div>
        ) : !data || data.page.length === 0 ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            No feed entries found
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {data.page.map((entry) => (
                <div
                  key={entry._id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700">
                          {entry.source}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900">
                          {entry.category}
                        </span>
                        {!entry.isVisible && (
                          <span className="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900">
                            Hidden
                          </span>
                        )}
                        {entry.featured && (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-100 dark:bg-yellow-900">
                            Featured
                          </span>
                        )}
                        {entry.autoSynced && (
                          <span className="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900">
                            Auto-synced
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold mb-1">{entry.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {format(new Date(entry.publishedAt), 'MMM dd, yyyy')} •{' '}
                        Priority: {entry.priority ?? 0}
                      </p>
                      {entry.excerpt && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {entry.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/admin/feed/$id"
                        params={{ id: entry.id }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <FaEdit />
                      </Link>
                      <button
                        onClick={() =>
                          handleToggleVisibility(entry, !entry.isVisible)
                        }
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title={entry.isVisible ? 'Hide' : 'Show'}
                      >
                        {entry.isVisible ? <FaEye /> : <FaEyeSlash />}
                      </button>
                      <button
                        onClick={() =>
                          handleToggleFeatured(entry, !entry.featured)
                        }
                        className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors ${
                          entry.featured ? 'text-yellow-500' : ''
                        }`}
                        title="Toggle Featured"
                      >
                        <FaStar />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors text-red-500"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data.counts.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => {
                    navigate({
                      search: {
                        ...search,
                        page: Math.max(0, currentPageIndex - 1),
                      },
                    })
                  }}
                  disabled={currentPageIndex === 0}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm">
                  Page {currentPageIndex + 1} of {data.counts.pages}
                </span>
                <button
                  onClick={() => {
                    navigate({
                      search: {
                        ...search,
                        page: currentPageIndex + 1,
                      },
                    })
                  }}
                  disabled={data.isDone}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
