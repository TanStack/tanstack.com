import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BannerEditor } from '~/components/admin/BannerEditor'
import { getBanner, type BannerWithMeta } from '~/utils/banner.functions'
import { useCapabilities } from '~/hooks/useCapabilities'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { hasCapability } from '~/db/types'
import { Button } from '~/ui'
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
    queryFn: () => getBanner({ data: { id } }),
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
          <Button
            className="mt-4"
            onClick={() =>
              navigate({
                to: '/admin/banners',
                search: { includeInactive: true },
              })
            }
          >
            Back to Banners
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <BannerEditor
          banner={isNew ? null : (bannerQuery.data as BannerWithMeta)}
          onSave={() =>
            navigate({
              to: '/admin/banners',
              search: { includeInactive: true },
            })
          }
          onCancel={() =>
            navigate({
              to: '/admin/banners',
              search: { includeInactive: true },
            })
          }
        />
      </div>
    </div>
  )
}
