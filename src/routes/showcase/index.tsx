import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { ShowcaseGallery } from '~/components/ShowcaseGallery'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import { SHOWCASE_USE_CASES } from '~/db/types'

const useCaseSchema = z.enum(SHOWCASE_USE_CASES as [string, ...string[]])

export const Route = createFileRoute('/showcase/')({
  validateSearch: (search) => {
    const parsed = z
      .object({
        page: z.number().optional().default(1).catch(1),
        libraryId: z.string().optional().catch(undefined),
        useCases: z.array(useCaseSchema).optional().catch(undefined),
      })
      .parse(search)

    return parsed
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    libraryId: search.libraryId,
    useCases: search.useCases,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      getApprovedShowcasesQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: 24,
        },
        filters: {
          libraryId: deps.libraryId,
          useCases: deps.useCases as any,
        },
      }),
    )
  },
  component: ShowcaseGallery,
  head: () => ({
    meta: seo({
      title: 'Showcase | TanStack',
      description:
        'Discover projects built with TanStack libraries. See how developers are using TanStack Query, Router, Table, Form, and more in production.',
    }),
  }),
})
