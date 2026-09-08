import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AiAdapters } from '~/components/ai-adapters/AiAdapters'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { aiCoverageQueryOptions } from '~/utils/ai-coverage'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/_library/ai/adapters')({
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
      title: 'TanStack AI Adapters',
      description:
        'Every TanStack AI adapter package and the activities it supports, read from the packages.',
    }),
  }),
  component: AiAdaptersRoute,
})

function AiAdaptersRoute() {
  const { data: coverage } = useSuspenseQuery(aiCoverageQueryOptions('latest'))
  return <AiAdapters coverage={coverage} />
}
