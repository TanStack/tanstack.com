import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import {
  Table,
  TableHeader,
  TableHeaderRow,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from './TableComponents'
import { PaginationControls } from './PaginationControls'
import { Spinner } from './Spinner'
import type { Showcase } from '~/db/schema'
import { Check, X, Star, ExternalLink, Trash2 } from 'lucide-react'
import { libraries } from '~/libraries'

interface ShowcaseModerationListProps {
  data:
    | {
        showcases: Array<{
          showcase: Showcase
          user: {
            id: string
            name: string | null
            email: string
            image: string | null
          } | null
        }>
        pagination: {
          page: number
          pageSize: number
          total: number
          totalPages: number
        }
      }
    | undefined
  isLoading: boolean
  error: Error | null
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onModerate: (
    showcaseId: string,
    action: 'approve' | 'deny',
    note?: string,
  ) => void
  onToggleFeatured: (showcaseId: string, isFeatured: boolean) => void
  onDelete: (showcaseId: string) => void
  isModeratingId?: string
}

const libraryMap = new Map(libraries.map((lib) => [lib.id, lib]))

export function ShowcaseModerationList({
  data,
  isLoading,
  error,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onModerate,
  onToggleFeatured,
  onDelete,
  isModeratingId,
}: ShowcaseModerationListProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [moderationNotes, setModerationNotes] = React.useState<
    Record<string, string>
  >({})

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleModerationNoteChange = (showcaseId: string, note: string) => {
    setModerationNotes((prev) => ({ ...prev, [showcaseId]: note }))
  }

  const handleModerate = (showcaseId: string, action: 'approve' | 'deny') => {
    const note = moderationNotes[showcaseId]
    onModerate(showcaseId, action, note)
    setModerationNotes((prev) => {
      const next = { ...prev }
      delete next[showcaseId]
      return next
    })
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Failed to load showcases: {error.message}
        </p>
      </div>
    )
  }

  const showcaseList = data?.showcases || []
  const pagination = data?.pagination || {
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Spinner className="text-3xl" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading showcases...
        </p>
      </div>
    )
  }

  if (showcaseList.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          No showcases found matching the current filters.
        </p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableHeaderRow>
            <TableHeaderCell className="w-12">#</TableHeaderCell>
            <TableHeaderCell>Project</TableHeaderCell>
            <TableHeaderCell className="w-24">Status</TableHeaderCell>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Libraries</TableHeaderCell>
            <TableHeaderCell className="w-20">Featured</TableHeaderCell>
            <TableHeaderCell className="w-32">Date</TableHeaderCell>
            <TableHeaderCell className="w-40">Actions</TableHeaderCell>
          </TableHeaderRow>
        </TableHeader>
        <TableBody>
          {showcaseList.map((entry, index) => {
            const { showcase, user } = entry
            const isExpanded = expandedIds.has(showcase.id)
            const isPending = showcase.status === 'pending'
            const isModeratingThis = isModeratingId === showcase.id

            return (
              <React.Fragment key={showcase.id}>
                <TableRow
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggleExpanded(showcase.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {(page - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/admin/showcases_/$id"
                      params={{ id: showcase.id }}
                      className="flex items-center gap-3 hover:opacity-80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showcase.logoUrl && (
                        <img
                          src={showcase.logoUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium text-sm">
                          {showcase.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {showcase.tagline}
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={twMerge(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        showcase.status === 'pending' &&
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                        showcase.status === 'approved' &&
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                        showcase.status === 'denied' &&
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                      )}
                    >
                      {showcase.status.charAt(0).toUpperCase() +
                        showcase.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">
                        {user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">{user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {showcase.libraries.slice(0, 3).map((libId) => {
                        const lib = libraryMap.get(libId)
                        return (
                          <span
                            key={libId}
                            className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700"
                          >
                            {lib?.name || libId}
                          </span>
                        )
                      })}
                      {showcase.libraries.length > 3 && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700">
                          +{showcase.libraries.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        onToggleFeatured(showcase.id, !showcase.isFeatured)
                      }
                      className={twMerge(
                        'p-1.5 rounded transition-colors',
                        showcase.isFeatured
                          ? 'text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                      )}
                      title={
                        showcase.isFeatured
                          ? 'Remove from featured'
                          : 'Add to featured'
                      }
                    >
                      <Star
                        className={twMerge(
                          'w-4 h-4',
                          showcase.isFeatured && 'fill-current',
                        )}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(showcase.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isModeratingThis ? (
                      <div className="text-xs text-gray-500">Processing...</div>
                    ) : (
                      <div className="flex gap-1">
                        {showcase.status !== 'approved' && (
                          <button
                            onClick={() =>
                              handleModerate(showcase.id, 'approve')
                            }
                            className="p-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                            title="Approve"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {showcase.status !== 'denied' && (
                          <button
                            onClick={() => handleModerate(showcase.id, 'deny')}
                            className="p-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
                            title="Deny"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                'Are you sure you want to delete this showcase?',
                              )
                            ) {
                              onDelete(showcase.id)
                            }
                          }}
                          className="p-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="bg-gray-50 dark:bg-gray-900"
                    >
                      <div className="p-4 space-y-4">
                        {/* Screenshot */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Screenshot:
                          </h4>
                          <img
                            src={showcase.screenshotUrl}
                            alt={showcase.name}
                            className="max-w-md rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                        </div>

                        {/* Project Details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              Project URL:
                            </h4>
                            <a
                              href={showcase.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {showcase.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              All Libraries:
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {showcase.libraries.map((libId) => {
                                const lib = libraryMap.get(libId)
                                return (
                                  <span
                                    key={libId}
                                    className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700"
                                  >
                                    {lib?.name || libId}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {showcase.description && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              Description:
                            </h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                              {showcase.description}
                            </div>
                          </div>
                        )}

                        {/* Use Cases */}
                        {showcase.useCases && showcase.useCases.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              Use Cases:
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {showcase.useCases.map((useCase) => (
                                <span
                                  key={useCase}
                                  className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                >
                                  {useCase}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Moderation Note Input (for pending only) */}
                        {isPending && (
                          <div>
                            <label className="block text-sm font-semibold mb-2">
                              Internal Moderation Note (optional):
                            </label>
                            <textarea
                              value={moderationNotes[showcase.id] || ''}
                              onChange={(e) =>
                                handleModerationNoteChange(
                                  showcase.id,
                                  e.target.value,
                                )
                              }
                              placeholder="Add an internal note about this moderation decision..."
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={2}
                            />
                          </div>
                        )}

                        {/* Existing Moderation Info */}
                        {!isPending && showcase.moderatedBy && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              Moderation Info:
                            </h4>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">
                                  Moderated at:
                                </span>{' '}
                                {showcase.moderatedAt &&
                                  new Date(
                                    showcase.moderatedAt,
                                  ).toLocaleString()}
                              </div>
                              {showcase.moderationNote && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Note:
                                  </span>{' '}
                                  {showcase.moderationNote}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>

      <PaginationControls
        currentPage={page - 1}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={pageSize}
        pageSizeOptions={[25, 50, 100]}
        onPageChange={(newPage) => onPageChange(newPage + 1)}
        onPageSizeChange={onPageSizeChange}
        canGoPrevious={page > 1}
        canGoNext={page < pagination.totalPages}
        showPageSizeSelector={true}
        itemLabel="showcases"
        sticky
      />
    </>
  )
}
