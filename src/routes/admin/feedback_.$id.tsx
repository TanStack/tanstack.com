import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adminGetDocFeedback,
  moderateDocFeedback,
} from '~/utils/docFeedback.functions'
import { libraries } from '~/libraries'
import {
  ArrowLeft,
  MessageSquare,
  User,
  Calendar,
  FileText,
  Check,
  X,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '~/components/Card'
import { Button } from '~/components/Button'
import { Badge } from '~/ui'
import { format } from '~/utils/dates'

export const Route = createFileRoute('/admin/feedback_/$id')({
  component: FeedbackDetailPage,
})

function FeedbackDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()

  const feedbackQuery = useQuery({
    queryKey: ['admin', 'feedback', id],
    queryFn: () => adminGetDocFeedback({ data: { feedbackId: id } }),
  })

  const moderateMutation = useMutation({
    mutationFn: (params: {
      action: 'approve' | 'deny'
      moderationNote?: string
    }) =>
      moderateDocFeedback({
        data: {
          feedbackId: id,
          action: params.action,
          moderationNote: params.moderationNote,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feedback', id] })
      queryClient.invalidateQueries({ queryKey: ['docFeedback', 'moderation'] })
    },
  })

  if (feedbackQuery.isLoading) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    )
  }

  const data = feedbackQuery.data

  if (!data) {
    return (
      <div className="w-full p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Feedback not found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The feedback you're looking for doesn't exist.
            </p>
            <Link
              to="/admin/feedback"
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feedback
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { feedback, user } = data
  const library = libraries.find((l) => l.id === feedback.libraryId)

  const statusVariant = {
    pending: 'warning',
    approved: 'success',
    denied: 'error',
  } as const

  const typeVariant = {
    improvement: 'info',
    note: 'purple',
  } as const

  return (
    <div className="w-full p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/admin/feedback"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feedback
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Feedback
                </h1>
                <Badge
                  variant={
                    statusVariant[feedback.status as keyof typeof statusVariant]
                  }
                >
                  {feedback.status}
                </Badge>
                <Badge
                  variant={
                    typeVariant[feedback.type as keyof typeof typeVariant]
                  }
                >
                  {feedback.type}
                </Badge>
                {feedback.isDetached && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    <AlertTriangle className="w-3 h-3" />
                    Detached
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {library?.name || feedback.libraryId} ·{' '}
                {feedback.libraryVersion}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Original Block Content */}
          {feedback.blockMarkdown && (
            <Card className="p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Original Block Content
              </h2>
              <div className="text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono whitespace-pre-wrap max-h-60 overflow-auto">
                {feedback.blockMarkdown}
              </div>
            </Card>
          )}

          {/* Feedback */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Feedback
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-gray-900 dark:text-white">
                {feedback.content}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
              {feedback.characterCount} characters
            </div>
          </Card>

          {/* Location */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Location
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Page Path
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                  {feedback.pagePath}
                </dd>
              </div>
              {feedback.blockSelector && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Block Selector
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono text-xs break-all">
                    {feedback.blockSelector}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Submitted
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {format(new Date(feedback.createdAt), 'PPpp')}
                </dd>
              </div>
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
        </div>

        {/* Moderation Actions */}
        {feedback.status === 'pending' && (
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
        {feedback.status !== 'pending' && feedback.moderatedAt && (
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
                  {format(new Date(feedback.moderatedAt), 'PPpp')}
                </dd>
              </div>
              {feedback.moderationNote && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Note
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {feedback.moderationNote}
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
              search={{ targetType: 'feedback' }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View audit logs for feedback →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
