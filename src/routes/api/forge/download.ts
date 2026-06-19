import { createFileRoute } from '@tanstack/react-router'
import { getAuthGuards } from '~/auth/index.server'
import { createLocalForgeZipArchive } from '~/builder/runtime/local-export.server'
import { getForgeDownloadErrorResponse } from '~/utils/forge-download'

export const Route = createFileRoute('/api/forge/download')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const guards = getAuthGuards()
        await guards.requireAuth(request)

        const url = new URL(request.url)

        try {
          const result = await createLocalForgeZipArchive({
            manifestVersionId:
              url.searchParams.get('manifestVersionId') ?? undefined,
          })

          return new Response(result.zip, {
            headers: {
              'Cache-Control': 'no-store',
              'Content-Disposition': `attachment; filename="${result.fileName}"`,
              'Content-Type': 'application/zip',
            },
          })
        } catch (error) {
          const response = getForgeDownloadErrorResponse(error)

          return Response.json(response.body, { status: response.status })
        }
      },
    },
  },
})
