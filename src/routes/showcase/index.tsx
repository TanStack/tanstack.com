import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseGallery } from '~/components/ShowcaseGallery'
import { getApprovedShowcasesQueryOptions } from '~/queries/showcases'
import {
  libraryIdSchema,
  showcaseUseCaseSchema,
  pageNumberSchema,
  pageSizeSchema,
} from '~/utils/schemas'

const searchSchema = v.object({
  page: v.optional(pageNumberSchema, 1),
  pageSize: v.optional(pageSizeSchema, 24),
  libraryIds: v.optional(v.pipe(v.array(libraryIdSchema), v.maxLength(16))),
  useCases: v.optional(v.pipe(v.array(showcaseUseCaseSchema), v.maxLength(12))),
  hasSourceCode: v.optional(v.boolean()),
  q: v.optional(v.pipe(v.string(), v.maxLength(120))),
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

export const Route = createFileRoute('/showcase/')({
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
          placement: 'showcase',
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
  component: ShowcaseGallery,
  head: ({ loaderData }) => ({
    meta: seo({
      title: 'Showcase | TanStack',
      description:
        'Projects selected by the TanStack team for their adoption, craft, and technical depth.',
      noindex: loaderData?.hasNonCanonicalSearch,
    }),
  }),
})
