import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getUserDocFeedbackQueryOptions } from '~/queries/docFeedback'
import { FaExternalLinkAlt } from 'react-icons/fa'
import { PaginationControls } from '~/components/PaginationControls'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { DocFeedbackNote } from '~/components/DocFeedbackNote'
import { Spinner } from '~/components/Spinner'
import { Award } from 'lucide-react'

export const Route = createFileRoute('/_libraries/account/feedback')({
  component: AccountFeedbackPage,
})

function AccountFeedbackPage() {
  const userQuery = useCurrentUserQuery()
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const user = userQuery.data
  const userId =
    user && typeof user === 'object' && 'userId' in user ? user.userId : null

  const { data, isLoading } = useQuery(
    getUserDocFeedbackQueryOptions({
      pagination: { page, pageSize },
      filters: { type: ['improvement'] },
    }),
  )

  const stats = data?.stats
  const feedback = data?.feedback || []
  const pagination = data?.pagination || {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  }

  if (!userId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          Please log in to view your feedback.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Points Summary Box */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-2xl text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Feedback Points
              </h3>
            </div>
            {stats ? (
              <>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {stats.totalApprovedPoints.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>
                    <span className="font-medium">
                      {stats.byStatus.approved.count}
                    </span>{' '}
                    approved
                  </div>
                  <div>
                    <span className="font-medium">
                      {stats.byStatus.pending.count}
                    </span>{' '}
                    pending review
                  </div>
                  {stats.byStatus.denied.count > 0 && (
                    <div className="text-red-600 dark:text-red-400">
                      <span className="font-medium">
                        {stats.byStatus.denied.count}
                      </span>{' '}
                      denied
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Loading stats...
              </div>
            )}
          </div>
          <Link
            to="/feedback-leaderboard"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          >
            View Leaderboard
            <FaExternalLinkAlt className="text-xs" />
          </Link>
        </div>
      </div>

      {/* Feedback List */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          My Feedback
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <Spinner />
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              You haven't submitted any feedback yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Visit any documentation page while logged in to submit feedback.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {feedback.map((item) => (
                <div key={item.id} className="flex flex-col gap-2">
                  {/* Page link */}
                  <Link
                    to={item.pagePath}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 font-mono"
                  >
                    {item.libraryId}
                    {item.pagePath}
                    <FaExternalLinkAlt className="text-[10px]" />
                  </Link>

                  {/* Feedback card */}
                  <DocFeedbackNote note={item} anchorName="" inline={true} />
                </div>
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="mt-6">
                <PaginationControls
                  currentPage={page - 1}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  pageSize={pageSize}
                  pageSizeOptions={[10, 25, 50]}
                  onPageChange={(newPage) => setPage(newPage + 1)}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setPage(1)
                  }}
                  canGoPrevious={page > 1}
                  canGoNext={page < pagination.totalPages}
                  showPageSizeSelector={true}
                  itemLabel="feedback"
                  sticky={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
