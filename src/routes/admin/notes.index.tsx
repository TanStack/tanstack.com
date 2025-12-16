import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { NotesModerationPage } from '~/components/NotesModerationPage'
import { listDocFeedbackForModerationQueryOptions } from '~/queries/docFeedback'
import { requireCapability } from '~/utils/auth.server'
import { libraries, type LibraryId } from '~/libraries'

const libraryIds = libraries.map((lib) => lib.id) as readonly LibraryId[]
const librarySchema = z.enum(libraryIds as [LibraryId, ...LibraryId[]])

export const Route = createFileRoute('/admin/notes/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  beforeLoad: async () => {
    try {
      const user = await requireCapability({
        data: { capability: 'moderate-feedback' }, // Using same capability for now
      })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: (search) => {
    const parsed = z
      .object({
        page: z.number().optional().default(1).catch(1),
        pageSize: z.number().int().positive().optional().default(50).catch(50),
        libraryId: librarySchema.optional().catch(undefined),
        isDetached: z.boolean().optional().catch(undefined),
        dateFrom: z.string().optional().catch(undefined),
        dateTo: z.string().optional().catch(undefined),
      })
      .parse(search)

    return parsed
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    libraryId: search.libraryId,
    isDetached: search.isDetached,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      listDocFeedbackForModerationQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: deps.pageSize,
        },
        filters: {
          type: ['note'], // Only show notes
          libraryId: deps.libraryId,
          isDetached: deps.isDetached,
          dateFrom: deps.dateFrom,
          dateTo: deps.dateTo,
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'private, max-age=0, must-revalidate',
  }),
  component: NotesModerationPage,
  head: () => ({
    meta: seo({
      title: 'View Notes | Admin | TanStack',
      description: 'View user documentation notes',
    }),
  }),
})
