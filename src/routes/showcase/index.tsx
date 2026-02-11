import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseGallery } from '~/components/ShowcaseGallery'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import { libraryIdSchema, showcaseUseCaseSchema } from '~/utils/schemas'

const searchSchema = v.object({
  page: v.optional(v.number(), 1),
  libraryIds: v.optional(v.array(libraryIdSchema)),
  useCases: v.optional(v.array(showcaseUseCaseSchema)),
  hasSourceCode: v.optional(v.boolean()),
  q: v.optional(v.string()),
})

export const Route = createFileRoute('/showcase/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    libraryIds: search.libraryIds,
    useCases: search.useCases,
    hasSourceCode: search.hasSourceCode,
    q: search.q,
  }),
  loader: async ({ deps, context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      getApprovedShowcasesQueryOptions({
        pagination: {
          page: deps.page,
          pageSize: 24,
        },
        filters: {
          libraryIds: deps.libraryIds,
          useCases: deps.useCases,
          hasSourceCode: deps.hasSourceCode,
          q: deps.q,
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
