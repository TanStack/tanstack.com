import { createFileRoute } from '@tanstack/react-router'
import { ensureForgeMetaSession } from '~/builder/runtime/forge-meta.server'
import { createLocalForgeZipArchive } from '~/builder/runtime/local-export.server'
import { withLocalForgeRuntimeSession } from '~/builder/runtime/local-store.server'
import {
  getForgeAccessErrorResponse,
  requireForgeAccess,
} from '~/utils/forge-access.server'
import { getForgeDownloadErrorResponse } from '~/utils/forge-download'

export const Route = createFileRoute('/api/forge/download')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          return getForgeAccessErrorResponse(error)
        }

        const url = new URL(request.url)

        try {
          const meta = await ensureForgeMetaSession(user.userId)

          if (!meta.activeChatSession) {
            return Response.json(
              { error: 'Forge has no active chat.' },
              { status: 404 },
            )
          }

          const result = await withLocalForgeRuntimeSession(
            meta.activeChatSession.runtimeSessionId,
            () =>
              createLocalForgeZipArchive({
                manifestVersionId:
                  url.searchParams.get('manifestVersionId') ?? undefined,
              }),
          )

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
