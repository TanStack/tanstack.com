import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseGallery } from '~/components/ShowcaseGallery'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import { libraryIdSchema, showcaseUseCaseSchema } from '~/utils/schemas'

const searchSchema = v.object({
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.number(), 24),
  libraryIds: v.optional(v.array(libraryIdSchema)),
  useCases: v.optional(v.array(showcaseUseCaseSchema)),
  hasSourceCode: v.optional(v.boolean()),
  q: v.optional(v.string()),
})

export const PAGE_SIZE_OPTIONS = [24, 48, 96, 192] as const

function hasNonCanonicalSearch(search: v.InferOutput<typeof searchSchema>) {
  return Boolean(
    search.page > 1 ||
    search.pageSize !== PAGE_SIZE_OPTIONS[0] ||
    search.libraryIds?.length ||
    search.useCases?.length ||
    search.hasSourceCode ||
    search.q,
  )
}

export const Route = createFileRoute('/community-projects')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page,
    pageSize: search.pageSize,
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
          pageSize: deps.pageSize,
        },
        filters: {
          placement: 'community',
          libraryIds: deps.libraryIds,
          useCases: deps.useCases,
          hasSourceCode: deps.hasSourceCode,
          q: deps.q,
        },
      }),
    )

    return {
      hasNonCanonicalSearch: hasNonCanonicalSearch(deps),
    }
  },
  component: () => <ShowcaseGallery community />,
  head: () => ({
    meta: seo({
      title: 'Community Projects | TanStack',
      description: 'Explore projects built by the TanStack community.',
      noindex: true,
    }),
  }),
})
