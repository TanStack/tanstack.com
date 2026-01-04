import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BannerEditor } from '~/components/admin/BannerEditor'
import { getBanner, type BannerWithMeta } from '~/utils/banner.functions'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import * as v from 'valibot'

export const Route = createFileRoute('/admin/banners/$id')({
  component: BannerEditorPage,
  validateSearch: (search) => v.parse(v.object({}), search),
})

function BannerEditorPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const capabilities = useCapabilities()

  const bannerQuery = useQuery({
    queryKey: ['banner', id],
    queryFn: () => getBanner({ id }),
    enabled: !isNew,
  })

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

  if (!isNew && bannerQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!isNew && !bannerQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Banner Not Found</h1>
          <button
            onClick={() => navigate({ to: '/admin/banners' })}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
          >
            Back to Banners
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <BannerEditor
          banner={isNew ? null : (bannerQuery.data as BannerWithMeta)}
          onSave={() => navigate({ to: '/admin/banners' })}
          onCancel={() => navigate({ to: '/admin/banners' })}
        />
      </div>
    </div>
  )
}
