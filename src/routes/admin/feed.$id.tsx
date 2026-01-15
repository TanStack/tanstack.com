import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FeedEntryEditor } from '~/components/admin/FeedEntryEditor'
import type { FeedEntry } from '~/components/FeedEntry'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { hasCapability } from '~/db/types'
import { getFeedEntryQueryOptions } from '~/queries/feed'
import { Button } from '~/ui'
import * as v from 'valibot'
export const Route = createFileRoute('/admin/feed/$id')({
  component: FeedEditorPage,
  validateSearch: (search) => v.parse(v.object({}), search),
})

function FeedEditorPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()
  const entryQuery = useQuery({
    ...getFeedEntryQueryOptions(id),
    enabled: !isNew,
  })

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  const canAdmin = hasCapability(capabilities, 'admin')
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

  if (!isNew && entryQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!isNew && !entryQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Entry Not Found</h1>
          <Button
            className="mt-4"
            onClick={() => navigate({ to: '/admin/feed' })}
          >
            Back to Feed Admin
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <FeedEntryEditor
          entry={
            isNew ? null : ((entryQuery.data as FeedEntry | undefined) ?? null)
          }
          onSave={() => navigate({ to: '/admin/feed' })}
          onCancel={() => navigate({ to: '/admin/feed' })}
        />
      </div>
    </div>
  )
}
