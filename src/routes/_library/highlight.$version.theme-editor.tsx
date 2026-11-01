import { createFileRoute, redirect } from '@tanstack/react-router'
import { docsConfigQueryOptions } from '~/queries/docsConfig'
import { ThemeEditorPage } from '~/components/highlight-theme-editor/ThemeEditorPage'
import { validateLibraryVersion } from '../-library-landing'

export const Route = createFileRoute(
  '/_library/highlight/$version/theme-editor',
)({
  beforeLoad: ({ params, location }) => {
    validateLibraryVersion('highlight', params.version, () => {
      throw redirect({
        to: '/highlight/$version/theme-editor',
        params: { version: 'latest' },
        search: true,
        hash: location.hash,
        statusCode: 308,
      })
    })
  },
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
