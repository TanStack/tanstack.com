import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listBanners,
  toggleBannerActive,
  deleteBanner,
  type BannerWithMeta,
} from '~/utils/banner.functions'
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  BookOpen,
  Info,
  AlertTriangle,
  CheckCircle,
  Gift,
  ToggleRight,
  ToggleLeft,
  ExternalLink,
  Flag,
} from 'lucide-react'
import { Button } from '~/ui'
import * as v from 'valibot'
import { formatDistanceToNow } from '~/utils/dates'
import {
  AdminAccessDenied,
  AdminLoading,
  AdminPageHeader,
  AdminEmptyState,
} from '~/components/admin'
import { useAdminGuard } from '~/hooks/useAdminGuard'
import { useDeleteWithConfirmation } from '~/hooks/useDeleteWithConfirmation'

const searchSchema = v.object({
  includeInactive: v.optional(v.boolean(), true),
})

export const Route = createFileRoute('/admin/banners/')({
  component: BannersAdminPage,
  validateSearch: searchSchema,
})

const STYLE_CONFIG = {
  info: {
    icon: Info,
    bgClass: 'bg-blue-100 dark:bg-blue-950',
    textClass: 'text-blue-700 dark:text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-100 dark:bg-amber-950',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  success: {
    icon: CheckCircle,
    bgClass: 'bg-green-100 dark:bg-green-950',
    textClass: 'text-green-700 dark:text-green-300',
  },
  promo: {
    icon: Gift,
    bgClass: 'bg-purple-100 dark:bg-purple-950',
    textClass: 'text-purple-700 dark:text-purple-300',
  },
}

function BannersAdminPage() {
  const guard = useAdminGuard()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const queryClient = useQueryClient()

  const bannersQuery = useQuery({
    queryKey: ['banners', { includeInactive: search.includeInactive }],
    queryFn: () =>
      listBanners({ data: { includeInactive: search.includeInactive } }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) =>
      toggleBannerActive({ data: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (params: { id: string }) => deleteBanner({ data: params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] })
    },
  })

  const handleToggleActive = async (banner: BannerWithMeta) => {
    await toggleActiveMutation.mutateAsync({
      id: banner.id,
      isActive: !banner.isActive,
    })
  }

  const { handleDelete } = useDeleteWithConfirmation({
    getItemName: (banner: BannerWithMeta) => banner.title,
    deleteFn: async (banner) => {
      await deleteMutation.mutateAsync({ id: banner.id })
    },
    itemLabel: 'banner',
  })

  if (guard.status === 'loading') {
    return <AdminLoading />
  }
  if (guard.status === 'denied') {
    return <AdminAccessDenied />
  }

  const banners = bannersQuery.data ?? []

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4 pt-4 pb-4">
      <div className="px-4">
        <AdminPageHeader
          icon={<Flag />}
          title="Banner Management"
          isLoading={bannersQuery.isLoading}
          actions={
            <Link to="/admin/banners/$id" params={{ id: 'new' }}>
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Create Banner
              </Button>
            </Link>
          }
        />
      </div>

      {/* Filters */}
      <div className="px-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={search.includeInactive}
            onChange={(e) =>
              navigate({
                search: (s: { includeInactive?: boolean }) => ({
                  ...s,
                  includeInactive: e.target.checked,
                }),
                replace: true,
              })
            }
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Show inactive banners
        </label>
      </div>

      {/* Banners List */}
      <div className="px-4 flex-1">
        {bannersQuery.isLoading ? (
          <div className="text-center py-12 text-gray-500">
            Loading banners...
          </div>
        ) : banners.length === 0 ? (
          <AdminEmptyState
            icon={<Flag className="w-12 h-12" />}
            title="No banners found"
            description="Create your first banner to get started."
            action={{ label: 'Create Banner', to: '/admin/banners/new' }}
          />
        ) : (
          <div className="space-y-4">
            {banners.map((banner) => {
              const styleConfig = STYLE_CONFIG[banner.style]
              const Icon = styleConfig.icon
              const isExpired =
                // eslint-disable-next-line react-hooks/purity
                banner.expiresAt && banner.expiresAt < Date.now()
              const hasntStarted =
                // eslint-disable-next-line react-hooks/purity
                banner.startsAt && banner.startsAt > Date.now()

              return (
                <div
                  key={banner.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${
                    !banner.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Style Icon */}
                      <div
                        className={`p-3 rounded-lg ${styleConfig.bgClass} ${styleConfig.textClass}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {banner.title}
                          </h3>
                          {/* Status badges */}
                          {!banner.isActive && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              Inactive
                            </span>
                          )}
                          {isExpired && (
                            <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                              Expired
                            </span>
                          )}
                          {hasntStarted && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full">
                              Scheduled
                            </span>
                          )}
                        </div>

                        {banner.content && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
                            {banner.content}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          {/* Scope */}
                          <span className="flex items-center gap-1">
                            {banner.scope === 'global' ? (
                              <>
                                <Globe className="w-3 h-3 text-gray-400" />
                                Global
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3 h-3 text-gray-400" />
                                {banner.pathPrefixes.length} path
                                {banner.pathPrefixes.length !== 1 ? 's' : ''}
                              </>
                            )}
                          </span>

                          {/* Link */}
                          {banner.linkUrl && (
                            <a
                              href={banner.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {banner.linkText || 'Link'}
                            </a>
                          )}

                          {/* Schedule */}
                          {banner.startsAt && (
                            <span>
                              Starts:{' '}
                              {formatDistanceToNow(new Date(banner.startsAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                          {banner.expiresAt && (
                            <span>
                              Expires:{' '}
                              {formatDistanceToNow(new Date(banner.expiresAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}

                          {/* Priority */}
                          <span>Priority: {banner.priority}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(banner)}
                          className={`p-2 rounded-lg transition-colors ${
                            banner.isActive
                              ? 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={banner.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {banner.isActive ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <Link
                          to="/admin/banners/$id"
                          params={{ id: banner.id }}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(banner)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Preview Mini Banner */}
                  <div
                    className={`px-4 py-2 text-xs ${styleConfig.bgClass} ${styleConfig.textClass} border-t border-gray-200 dark:border-gray-700`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate font-medium">
                        {banner.title}
                      </span>
                      {banner.linkUrl && (
                        <span className="text-current/70 underline">
                          {banner.linkText || 'Learn More'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
