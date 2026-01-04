import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminGetShowcase, moderateShowcase } from '~/utils/showcase.functions'
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
} from 'lucide-react'
import { Card } from '~/components/Card'
import { Button } from '~/components/Button'
import { format } from 'date-fns'
import type { ShowcaseUseCase } from '~/db/schema'

export const Route = createFileRoute('/admin/showcases_/$id')({
  component: ShowcaseDetailPage,
})

function ShowcaseDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()

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
  const showcaseLibraries = showcase.libraries
    .map((libId: string) => libraries.find((l) => l.id === libId))
    .filter(Boolean)

  const statusColors = {
    pending:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div className="w-full p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/admin/showcases"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Showcases
          </Link>

          <div className="flex items-start gap-4">
            {showcase.logoUrl ? (
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
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {showcase.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[showcase.status as keyof typeof statusColors]}`}
                >
                  {showcase.status}
                </span>
                {showcase.isFeatured && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    Featured
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {showcase.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Screenshot */}
        {showcase.screenshotUrl && (
          <Card className="p-4 mb-6">
            <img
              src={showcase.screenshotUrl}
              alt={`${showcase.name} screenshot`}
              className="w-full rounded-lg"
            />
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Showcase Details
            </h2>
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
            </dl>
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
            <div className="flex flex-wrap gap-2">
              {showcaseLibraries.map((lib: any) => (
                <span
                  key={lib.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {lib.name}
                </span>
              ))}
            </div>
          </Card>

          {/* Use Cases */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Use Cases
            </h2>
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
          </Card>
        </div>

        {/* Moderation Actions */}
        {showcase.status === 'pending' && (
          <Card className="p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Review
            </h2>
            <div className="flex gap-4">
              <Button
                onClick={() => moderateMutation.mutate({ action: 'approve' })}
                disabled={moderateMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
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
                className="bg-red-600 hover:bg-red-700"
              >
                <X className="w-4 h-4 mr-2" />
                Deny
              </Button>
            </div>
          </Card>
        )}

        {/* Moderation Info */}
        {showcase.status !== 'pending' && showcase.moderatedAt && (
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
