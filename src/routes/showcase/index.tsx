import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseGallery } from '~/components/ShowcaseGallery'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import { showcaseUseCaseSchema } from '~/utils/schemas'

export const Route = createFileRoute('/showcase/')({
  validateSearch: (search) => {
    const parsed = v.parse(
      v.object({
        page: v.optional(v.number(), 1),
        libraryId: v.optional(v.string()),
        useCases: v.optional(v.array(showcaseUseCaseSchema)),
      }),
      search,
    )

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
