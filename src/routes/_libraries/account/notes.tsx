import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getUserDocFeedbackQueryOptions } from '~/queries/docFeedback'
import { FaExternalLinkAlt } from 'react-icons/fa'
import { PaginationControls } from '~/components/PaginationControls'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { DocFeedbackNote } from '~/components/DocFeedbackNote'
import { Spinner } from '~/components/Spinner'

export const Route = createFileRoute('/_libraries/account/notes')({
  component: AccountNotesPage,
})

function AccountNotesPage() {
  const userQuery = useCurrentUserQuery()
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  const user = userQuery.data
  const userId = user && typeof user === 'object' && 'userId' in user ? user.userId : null

  const { data, isLoading } = useQuery(
    getUserDocFeedbackQueryOptions({
      pagination: { page, pageSize },
      filters: { type: ['note'] },
    }),
  )

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
        <p className="text-gray-600 dark:text-gray-400">Please log in to view your notes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Notes List */}
      <div>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          My Notes
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <Spinner />
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              You haven't created any notes yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Visit any documentation page while logged in to create personal notes.
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
                    {item.libraryId}{item.pagePath}
                    <FaExternalLinkAlt className="text-[10px]" />
                  </Link>

                  {/* Feedback card */}
                  <DocFeedbackNote
                    note={item}
                    anchorName=""
                    inline={true}
                  />
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
                  itemLabel="notes"
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
