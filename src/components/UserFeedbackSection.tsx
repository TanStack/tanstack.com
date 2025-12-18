import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getUserDocFeedbackQueryOptions } from '~/queries/docFeedback'
import { twMerge } from 'tailwind-merge'
import { PaginationControls } from './PaginationControls'
import { Spinner } from './Spinner'
import { calculatePoints } from '~/utils/docFeedback.client'
import { Award, ExternalLink, Lightbulb, MessageSquare } from 'lucide-react'

interface UserFeedbackSectionProps {
  userId: string
}

export function UserFeedbackSection({ userId }: UserFeedbackSectionProps) {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const { data, isLoading } = useQuery(
    getUserDocFeedbackQueryOptions({
      pagination: { page, pageSize },
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
                    approved contributions
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
            <ExternalLink className="text-xs" size={16} />
          </Link>
        </div>
      </div>

      {/* Feedback List */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          My Feedback History
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
              Visit any documentation page while logged in to add notes or
              suggest improvements.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Icon */}
                      <div className="mt-1">
                        {item.type === 'note' ? (
                          <MessageSquare className="text-blue-500" size={14} />
                        ) : (
                          <Lightbulb className="text-yellow-500" size={14} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {item.type === 'note'
                              ? 'Personal Note'
                              : 'Improvement Suggestion'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {item.libraryId}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
                          {item.content}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{item.pagePath}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Points */}
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={twMerge(
                          'px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap',
                          item.status === 'pending' &&
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                          item.status === 'approved' &&
                            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                          item.status === 'denied' &&
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                        )}
                      >
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1)}
                      </span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {calculatePoints(
                          item.characterCount,
                          item.type,
                        ).toFixed(1)}{' '}
                        pts
                      </span>
                    </div>
                  </div>

                  {/* Detached warning */}
                  {item.isDetached && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ The referenced section may have moved or been
                        updated. Moderators can review this feedback.
                      </p>
                    </div>
                  )}
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
                  itemLabel="feedback items"
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
