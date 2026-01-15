import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyShowcasesQueryOptions } from '~/queries/showcases'
import { deleteShowcase } from '~/utils/showcase.functions'
import { libraries } from '~/libraries'
import { useToast } from '~/components/ToastProvider'
import { seo } from '~/utils/seo'
import {
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Check,
  X,
  Pencil,
} from 'lucide-react'
import type { Showcase } from '~/db/types'
import { Badge, Button } from '~/ui'

export const Route = createFileRoute('/account/submissions')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      getMyShowcasesQueryOptions({
        pagination: { page: 1, pageSize: 20 },
      }),
    )
  },
  component: AccountSubmissionsPage,
  head: () => ({
    meta: seo({
      title: 'My Submissions | Account | TanStack',
      description: 'View and manage your showcase submissions.',
    }),
  }),
})

const libraryMap = new Map(libraries.map((lib) => [lib.id as string, lib]))

function AccountSubmissionsPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()

  const { data, isLoading } = useQuery(
    getMyShowcasesQueryOptions({
      pagination: { page: 1, pageSize: 20 },
    }),
  )

  const deleteMutation = useMutation({
    mutationFn: deleteShowcase,
    onSuccess: () => {
      notify(
        <div>
          <div className="font-medium">Showcase deleted</div>
        </div>,
      )
      queryClient.invalidateQueries({ queryKey: ['showcases', 'mine'] })
    },
    onError: (error: Error) => {
      notify(
        <div>
          <div className="font-medium">Delete failed</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs">
            {error.message}
          </div>
        </div>,
      )
    },
  })

  const handleDelete = (showcaseId: string) => {
    if (confirm('Are you sure you want to delete this showcase?')) {
      deleteMutation.mutate({ data: { showcaseId } })
    }
  }

  const getStatusBadge = (status: Showcase['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="w-3 h-3" />
            Pending Review
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="success" className="gap-1">
            <Check className="w-3 h-3" />
            Approved
          </Badge>
        )
      case 'denied':
        return (
          <Badge variant="error" className="gap-1">
            <X className="w-3 h-3" />
            Denied
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your showcase submissions
        </p>
        <Button
          size="xs"
          as={Link}
          to="/showcase/submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none"
        >
          <Plus className="w-4 h-4" />
          New Submission
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 animate-pulse"
            >
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mt-2" />
            </div>
          ))}
        </div>
      ) : data?.showcases && data.showcases.length > 0 ? (
        <div className="space-y-4">
          {data.showcases.map((showcase) => (
            <div
              key={showcase.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="flex">
                {/* Screenshot */}
                <div className="w-48 h-32 flex-shrink-0 bg-gray-100 dark:bg-gray-900">
                  <img
                    src={showcase.screenshotUrl}
                    alt={showcase.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                        {showcase.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {showcase.tagline}
                      </p>
                    </div>
                    {getStatusBadge(showcase.status)}
                  </div>

                  {/* Libraries */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {showcase.libraries.map((libId) => {
                      const lib = libraryMap.get(libId)
                      return (
                        <span
                          key={libId}
                          className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700"
                        >
                          {lib?.name?.replace('TanStack ', '') || libId}
                        </span>
                      )
                    })}
                  </div>

                  {/* Moderation note */}
                  {showcase.status === 'denied' && showcase.moderationNote && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                      <strong>Reason:</strong> {showcase.moderationNote}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      as="a"
                      href={showcase.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visit
                    </Button>
                    <Link to="/showcase/edit/$id" params={{ id: showcase.id }}>
                      <Button variant="ghost" size="xs">
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Button>
                    </Link>
                    <Button onClick={() => handleDelete(showcase.id)}>
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            You haven't submitted any showcases yet.
          </p>
          <Button
            as={Link}
            to="/showcase/submit"
            className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none"
          >
            <Plus className="w-5 h-5" />
            Submit Your First Project
          </Button>
        </div>
      )}
    </div>
  )
}
