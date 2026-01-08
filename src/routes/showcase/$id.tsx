import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import { ShowcaseDetail } from '~/components/ShowcaseDetail'
import {
  getShowcaseQueryOptions,
  getRelatedShowcasesQueryOptions,
} from '~/queries/showcases'

export const Route = createFileRoute('/showcase/$id')({
  params: {
    parse: (params) => ({
      id: v.parse(v.pipe(v.string(), v.uuid()), params.id),
    }),
    stringify: ({ id }) => ({ id }),
  },
  loader: async ({ params, context: { queryClient } }) => {
    const showcaseData = await queryClient.ensureQueryData(
      getShowcaseQueryOptions(params.id),
    )

    if (showcaseData?.showcase.libraries.length) {
      await queryClient.ensureQueryData(
        getRelatedShowcasesQueryOptions({
          showcaseId: params.id,
          libraries: showcaseData.showcase.libraries,
          limit: 4,
        }),
      )
    }

    return { showcase: showcaseData?.showcase }
  },
  component: ShowcaseDetailPage,
  head: ({ loaderData }) => {
    const showcase = loaderData?.showcase
    if (!showcase) {
      return {
        meta: seo({
          title: 'Showcase Not Found | TanStack',
          description: 'The project you are looking for could not be found.',
        }),
      }
    }

    return {
      meta: seo({
        title: `${showcase.name} | Showcase | TanStack`,
        description: showcase.tagline,
        image: showcase.screenshotUrl,
      }),
    }
  },
})

function ShowcaseDetailPage() {
  const { id } = Route.useParams()
  return <ShowcaseDetail showcaseId={id} />
}
