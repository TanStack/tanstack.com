import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AiCoverage } from '~/components/ai-coverage/AiCoverage'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { aiCoverageQueryOptions } from '~/utils/ai-coverage'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_library/ai/coverage')({
  staleTime: 1000 * 60 * 5,
  loader: async ({ context: { queryClient } }) => {
    const [config] = await Promise.all([
      queryClient.ensureQueryData(docsConfigQueryOptions('ai', 'latest')),
      queryClient.ensureQueryData(aiCoverageQueryOptions('latest')),
    ])
    return { config, version: 'latest' }
  },
  head: () => ({
    meta: seo({
      title: 'TanStack AI Coverage',
      description:
        'Every TanStack AI adapter and the activities, models, and modalities it supports, generated from the packages.',
    }),
  }),
  component: AiCoverageRoute,
})

function AiCoverageRoute() {
  const { data: coverage } = useSuspenseQuery(aiCoverageQueryOptions('latest'))
  return <AiCoverage coverage={coverage} />
}
