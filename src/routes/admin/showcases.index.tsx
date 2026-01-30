import { redirect, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseModerationPage } from '~/components/ShowcaseModerationPage'
import { listShowcasesForModerationQueryOptions } from '~/queries/showcases'
import { requireCapability } from '~/utils/auth.server'
import { libraryIdSchema, showcaseStatusSchema } from '~/utils/schemas'

const searchSchema = v.object({
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50),
  status: v.optional(v.array(showcaseStatusSchema)),
  libraryId: v.optional(v.array(libraryIdSchema)),
  isFeatured: v.optional(v.boolean()),
})

export const Route = createFileRoute('/admin/showcases/')({
  staleTime: 1000 * 60 * 5, // 5 minutes
  beforeLoad: async () => {
    try {
      const user = await requireCapability({
        data: { capability: 'moderate-showcases' },
      })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
    status: search.status,
    libraryId: search.libraryId,
    isFeatured: search.isFeatured,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      listShowcasesForModerationQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: deps.pageSize,
        },
        filters: {
          status: deps.status,
          libraryId: deps.libraryId,
          isFeatured: deps.isFeatured,
        },
      }),
    )
  },
  headers: () => ({
    'cache-control': 'private, max-age=0, must-revalidate',
  }),
  component: ShowcaseModerationPage,
  head: () => ({
    meta: seo({
      title: 'Moderate Showcases | Admin | TanStack',
      description: 'Moderate product showcase submissions',
    }),
  }),
})
