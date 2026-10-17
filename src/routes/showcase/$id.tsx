import { isCuratedShowcase } from '~/utils/showcase.shared'
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
  headers: () => ({ 'cache-control': 'private, no-store' }),
  component: ShowcaseDetailPage,
  head: ({ loaderData }) => {
    const showcase = loaderData?.showcase
    if (!showcase) {
      return {
        meta: seo({
          title: 'Project Not Found | TanStack',
          noindex: true,
          description: 'The project you are looking for could not be found.',
        }),
      }
    }

    return {
      meta: seo({
        title: `${showcase.name} | ${showcase.placement === 'community' ? 'Community' : 'Showcase'} | TanStack`,
        noindex: !isCuratedShowcase(showcase),
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
