import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import { FeedEntryEditor } from '~/components/admin/FeedEntryEditor'
import { z } from 'zod'

export const Route = createFileRoute('/admin/feed/$id')({
  component: FeedEditorPage,
  validateSearch: z.object({}),
})

function FeedEditorPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const user = useConvexQuery(api.auth.getCurrentUser)
  const entryQuery = useConvexQuery(
    api.feed.queries.getFeedEntry,
    isNew ? 'skip' : { id }
  )

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

  if (!isNew && entryQuery === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!isNew && entryQuery === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Entry Not Found</h1>
          <button
            onClick={() => navigate({ to: '/admin/feed' })}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Back to Feed Admin
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <FeedEntryEditor
          entry={isNew ? null : entryQuery ?? null}
          onSave={() => navigate({ to: '/admin/feed' })}
          onCancel={() => navigate({ to: '/admin/feed' })}
        />
      </div>
    </div>
  )
}
