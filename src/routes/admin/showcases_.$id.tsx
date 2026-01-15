import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  adminGetShowcase,
  moderateShowcase,
  adminUpdateShowcase,
  adminDeleteShowcase,
  voteShowcase,
} from '~/utils/showcase.functions'
import { libraries } from '~/libraries'
import { USE_CASE_LABELS } from '~/utils/showcase.client'
import {
  ArrowLeft,
  Sparkles,
  User,
  Calendar,
  Link as LinkIcon,
  Check,
  X,
  ExternalLink,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  Save,
  RotateCcw,
} from 'lucide-react'
import { Card } from '~/components/Card'
import { Badge, Button, FormInput } from '~/ui'
import { ImageUpload } from '~/components/ImageUpload'
import { format } from '~/utils/dates'
import {
  SHOWCASE_STATUSES,
  SHOWCASE_USE_CASES_UI,
  type ShowcaseUseCase,
  type ShowcaseStatus,
} from '~/db/types'

export const Route = createFileRoute('/admin/showcases_/$id')({
  component: ShowcaseDetailPage,
})

function ShowcaseDetailPage() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    tagline: string
    description: string
    url: string
    logoUrl: string
    screenshotUrl: string
    sourceUrl: string | null
    libraries: string[]
    useCases: ShowcaseUseCase[]
    status: ShowcaseStatus
    isFeatured: boolean
    moderationNote: string
    trancoRank: number | null
    voteScore: number
  } | null>(null)

  const showcaseQuery = useQuery({
    queryKey: ['admin', 'showcase', id],
    queryFn: () => adminGetShowcase({ data: { showcaseId: id } }),
  })

  const moderateMutation = useMutation({
    mutationFn: (params: {
      action: 'approve' | 'deny'
      moderationNote?: string
    }) =>
      moderateShowcase({
        data: {
          showcaseId: id,
          action: params.action,
          moderationNote: params.moderationNote,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcase', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcases'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminUpdateShowcase>[0]['data']) =>
      adminUpdateShowcase({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcase', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcases'] })
      setIsEditing(false)
      setFormData(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteShowcase({ data: { showcaseId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcases'] })
      navigate({ to: '/admin/showcases' })
    },
  })

  const voteMutation = useMutation({
    mutationFn: (params: { value: 1 | -1 }) =>
      voteShowcase({ data: { showcaseId: id, value: params.value } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcase', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'showcases'] })
    },
  })

  const startEditing = () => {
    if (!showcaseQuery.data) return
    const { showcase } = showcaseQuery.data
    setFormData({
      name: showcase.name,
      tagline: showcase.tagline,
      description: showcase.description || '',
      url: showcase.url,
      logoUrl: showcase.logoUrl || '',
      screenshotUrl: showcase.screenshotUrl,
      sourceUrl: showcase.sourceUrl,
      libraries: showcase.libraries,
      useCases: showcase.useCases,
      status: showcase.status,
      isFeatured: showcase.isFeatured,
      moderationNote: showcase.moderationNote || '',
      trancoRank: showcase.trancoRank,
      voteScore: showcase.voteScore,
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setFormData(null)
  }

  const handleSave = () => {
    if (!formData) return
    updateMutation.mutate({
      showcaseId: id,
      name: formData.name,
      tagline: formData.tagline,
      description: formData.description || null,
      url: formData.url,
      logoUrl: formData.logoUrl || null,
      screenshotUrl: formData.screenshotUrl,
      sourceUrl: formData.sourceUrl,
      libraries: formData.libraries,
      useCases: formData.useCases,
      status: formData.status,
      isFeatured: formData.isFeatured,
      moderationNote: formData.moderationNote || null,
      trancoRank: formData.trancoRank,
      voteScore: formData.voteScore,
    })
  }

  const handleDelete = () => {
    if (
      confirm(
        'Are you sure you want to delete this showcase? This cannot be undone.',
      )
    ) {
      deleteMutation.mutate()
    }
  }

  if (showcaseQuery.isLoading) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  const data = showcaseQuery.data

  if (!data) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Sparkles className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Showcase not found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The showcase you're looking for doesn't exist.
            </p>
            <Link
              to="/admin/showcases"
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Showcases
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { showcase, user } = data
  const displayData = formData || {
    name: showcase.name,
    tagline: showcase.tagline,
    description: showcase.description || '',
    url: showcase.url,
    logoUrl: showcase.logoUrl || '',
    screenshotUrl: showcase.screenshotUrl,
    libraries: showcase.libraries,
    useCases: showcase.useCases,
    status: showcase.status,
    isFeatured: showcase.isFeatured,
    moderationNote: showcase.moderationNote || '',
    trancoRank: showcase.trancoRank,
    voteScore: showcase.voteScore,
  }
  const showcaseLibraries = displayData.libraries
    .map((libId: string) => libraries.find((l) => l.id === libId))
    .filter(Boolean)

  const statusVariant = {
    pending: 'warning',
    approved: 'success',
    denied: 'error',
  } as const

  const labelClass =
    'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <div className="w-full p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/admin/showcases"
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Showcases
            </Link>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={cancelEditing}
                    disabled={updateMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={startEditing}
                    className="hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    onClick={handleDelete}
                    className="hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {updateMutation.isError && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {updateMutation.error.message}
            </div>
          )}

          <div className="flex items-start gap-4">
            {isEditing ? (
              <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {formData?.logoUrl ? (
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className="w-8 h-8 text-gray-400" />
                )}
              </div>
            ) : showcase.logoUrl ? (
              <img
                src={showcase.logoUrl}
                alt={showcase.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <FormInput
                    type="text"
                    value={formData?.name || ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev ? { ...prev, name: e.target.value } : null,
                      )
                    }
                    className="text-xl font-bold"
                    placeholder="Showcase name"
                  />
                  <FormInput
                    type="text"
                    value={formData?.tagline || ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev ? { ...prev, tagline: e.target.value } : null,
                      )
                    }
                    placeholder="Tagline"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {showcase.name}
                    </h1>
                    <Badge
                      variant={
                        statusVariant[
                          showcase.status as keyof typeof statusVariant
                        ]
                      }
                    >
                      {showcase.status}
                    </Badge>
                    {showcase.isFeatured && (
                      <Badge variant="purple">Featured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {showcase.tagline}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Screenshot */}
        <Card className="p-4 mb-6">
          {isEditing ? (
            <ImageUpload
              value={formData?.screenshotUrl || undefined}
              onChange={(url) =>
                setFormData((prev) =>
                  prev ? { ...prev, screenshotUrl: url || '' } : null,
                )
              }
              label="Screenshot"
              hint="16:9 aspect ratio recommended"
              required
              aspectRatio="video"
            />
          ) : showcase.screenshotUrl ? (
            <img
              src={showcase.screenshotUrl}
              alt={`${showcase.name} screenshot`}
              className="w-full rounded-lg"
            />
          ) : (
            <div className="text-center py-8 text-gray-500">No screenshot</div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Showcase Details
            </h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="url" className={labelClass}>
                    URL
                  </label>
                  <FormInput
                    id="url"
                    type="text"
                    value={formData?.url || ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev ? { ...prev, url: e.target.value } : null,
                      )
                    }
                    placeholder="https://..."
                  />
                </div>
                <ImageUpload
                  value={formData?.logoUrl || undefined}
                  onChange={(url) =>
                    setFormData((prev) =>
                      prev ? { ...prev, logoUrl: url || '' } : null,
                    )
                  }
                  label="Logo"
                  hint="Optional: Square logo for your project"
                  aspectRatio="square"
                  size="small"
                />
                <div>
                  <label htmlFor="src" className={labelClass}>
                    Source Code URL (optional)
                  </label>
                  <FormInput
                    id="src"
                    type="url"
                    value={formData?.sourceUrl || ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev
                          ? { ...prev, sourceUrl: e.target.value || null }
                          : null,
                      )
                    }
                    placeholder="https://github.com/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Link to GitHub, GitLab, or other repository
                  </p>
                </div>
                <div>
                  <label htmlFor="description" className={labelClass}>
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={formData?.description || ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev ? { ...prev, description: e.target.value } : null,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]"
                    placeholder="Describe the showcase..."
                  />
                </div>
                <div>
                  <label htmlFor="trancoRank" className={labelClass}>
                    Tranco Rank
                  </label>
                  <FormInput
                    id="trancoRank"
                    type="number"
                    value={formData?.trancoRank ?? ''}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              trancoRank: e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            }
                          : null,
                      )
                    }
                    placeholder="e.g. 1000"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Lower = more popular. Leave empty for unranked.
                  </p>
                </div>
                <div>
                  <label htmlFor="voteScore" className={labelClass}>
                    Vote Score
                  </label>
                  <FormInput
                    id="voteScore"
                    type="number"
                    value={formData?.voteScore ?? 0}
                    onChange={(e) =>
                      setFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              voteScore: parseInt(e.target.value, 10) || 0,
                            }
                          : null,
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    URL
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={showcase.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                      {showcase.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
                {showcase.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {showcase.description}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Submitted
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {format(new Date(showcase.createdAt), 'PPpp')}
                  </dd>
                </div>
                {showcase.trancoRank && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tranco Rank
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      #{showcase.trancoRank.toLocaleString()}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {showcase.voteScore >= 0 ? (
                      <ThumbsUp className="w-4 h-4" />
                    ) : (
                      <ThumbsDown className="w-4 h-4" />
                    )}
                    Community Votes
                  </dt>
                  <dd className="mt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ value: 1 })}
                        disabled={voteMutation.isPending}
                        className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        title="Upvote"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                          showcase.voteScore > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : showcase.voteScore < 0
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {showcase.voteScore > 0 ? '+' : ''}
                        {showcase.voteScore}
                      </span>
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ value: -1 })}
                        disabled={voteMutation.isPending}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Downvote"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                    {showcase.voteScore < 0 && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Negative score may indicate community concerns
                      </p>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          {/* Submitter */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Submitted By
            </h2>
            {user ? (
              <Link
                to="/admin/users/$userId"
                params={{ userId: user.id }}
                className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded-lg -m-2"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {user.email}
                  </div>
                </div>
              </Link>
            ) : (
              <p className="text-sm text-gray-500">User not found</p>
            )}
          </Card>

          {/* Libraries */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Libraries Used
            </h2>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {libraries.map((lib) => {
                  const isSelected = formData?.libraries.includes(lib.id)
                  return (
                    <button
                      key={lib.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => {
                          if (!prev) return null
                          const newLibs = isSelected
                            ? prev.libraries.filter((l) => l !== lib.id)
                            : [...prev.libraries, lib.id]
                          return { ...prev, libraries: newLibs }
                        })
                      }
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {lib.name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {showcaseLibraries.map((lib) => (
                  <span
                    key={lib!.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {lib!.name}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Use Cases */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Use Cases
            </h2>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {SHOWCASE_USE_CASES_UI.map((useCase) => {
                  const isSelected = formData?.useCases.includes(useCase)
                  return (
                    <button
                      key={useCase}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => {
                          if (!prev) return null
                          const newUseCases = isSelected
                            ? prev.useCases.filter((uc) => uc !== useCase)
                            : [...prev.useCases, useCase]
                          return { ...prev, useCases: newUseCases }
                        })
                      }
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {USE_CASE_LABELS[useCase] || useCase}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {showcase.useCases && showcase.useCases.length > 0 ? (
                  showcase.useCases.map((useCase: ShowcaseUseCase) => (
                    <span
                      key={useCase}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {USE_CASE_LABELS[useCase] || useCase}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    None specified
                  </span>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Status & Featured (edit mode only) */}
        {isEditing && (
          <Card className="p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Status & Visibility
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className={labelClass}>
                  Status
                </label>
                <select
                  id="status"
                  value={formData?.status || 'pending'}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev
                        ? { ...prev, status: e.target.value as ShowcaseStatus }
                        : null,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {SHOWCASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="featured" className={labelClass}>
                  Featured
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    id="featured"
                    type="button"
                    onClick={() =>
                      setFormData((prev) =>
                        prev ? { ...prev, isFeatured: !prev.isFeatured } : null,
                      )
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData?.isFeatured
                        ? 'bg-purple-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData?.isFeatured ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {formData?.isFeatured ? 'Featured' : 'Not featured'}
                  </span>
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="note" className={labelClass}>
                  Moderation Note (optional)
                </label>
                <textarea
                  id="note"
                  value={formData?.moderationNote || ''}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev ? { ...prev, moderationNote: e.target.value } : null,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                  placeholder="Add a note about this moderation decision..."
                />
              </div>
            </div>
          </Card>
        )}

        {/* Moderation Actions */}
        {!isEditing && showcase.status === 'pending' && (
          <Card className="p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Review
            </h2>
            <div className="flex gap-4">
              <Button
                onClick={() => moderateMutation.mutate({ action: 'approve' })}
                disabled={moderateMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white border-green-600"
              >
                <Check className="w-4 h-4" />
                Approve
              </Button>
              <Button
                onClick={() =>
                  moderateMutation.mutate({
                    action: 'deny',
                    moderationNote: 'Does not meet guidelines',
                  })
                }
                disabled={moderateMutation.isPending}
                className="hover:text-red-600 hover:border-red-300 dark:hover:border-red-700"
              >
                <X className="w-4 h-4" />
                Deny
              </Button>
            </div>
          </Card>
        )}

        {/* Moderation Info */}
        {!isEditing &&
          showcase.status !== 'pending' &&
          showcase.moderatedAt && (
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Moderation Info
              </h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Moderated At
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {format(new Date(showcase.moderatedAt), 'PPpp')}
                  </dd>
                </div>
                {showcase.moderationNote && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Note
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {showcase.moderationNote}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

        {/* Related */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Related
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/admin/audit"
              search={{ targetType: 'showcase' }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View audit logs for showcases →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
