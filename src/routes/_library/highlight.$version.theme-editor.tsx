import { createFileRoute } from '@tanstack/react-router'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { ThemeEditorPage } from '~/components/highlight-theme-editor/ThemeEditorPage'

export const Route = createFileRoute(
  '/_library/highlight/$version/theme-editor',
)({
  loader: async ({ params, context: { queryClient } }) => {
    return {
      config: await queryClient.ensureQueryData(
        docsConfigQueryOptions('highlight', params.version),
      ),
    }
  },
  component: ThemeEditorPage,
  ssr: false,
})
