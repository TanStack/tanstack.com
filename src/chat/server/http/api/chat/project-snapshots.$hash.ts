import { z } from 'zod'
import { defineHttpRoute } from '~/server/runtime/http-route.server'

export default defineHttpRoute(
  '/api/chat/project-snapshots/$hash',
  z.object({ hash: z.string() }),
  {
    GET: async ({ params }) => {
      const { jsonError } = await import('~/utils/api-boundary.server')
      const {
        getBuilderProjectSnapshotCacheTag,
        getBuilderProjectSnapshotObject,
        isBuilderProjectSnapshotHash,
        BuilderProjectSnapshotStorageUnavailableError,
      } = await import('~/utils/builder-project-snapshot-storage.server')

      if (!isBuilderProjectSnapshotHash(params.hash)) {
        return jsonError('Project snapshot not found', 404)
      }

      try {
        const object = await getBuilderProjectSnapshotObject(params.hash)
        if (!object) return jsonError('Project snapshot not found', 404)

        const body = new Blob([await object.arrayBuffer()])
          .stream()
          .pipeThrough(new DecompressionStream('gzip'))

        return new Response(body, {
          headers: {
            'Cache-Control': 'public, max-age=300, must-revalidate',
            'Cache-Tag': getBuilderProjectSnapshotCacheTag(params.hash),
            'Cloudflare-CDN-Cache-Control':
              'public, max-age=31536000, immutable',
            'Content-Type': 'application/json; charset=utf-8',
            ETag: `"${params.hash}"`,
          },
        })
      } catch (error) {
        if (error instanceof BuilderProjectSnapshotStorageUnavailableError) {
          return jsonError('Project snapshot storage is unavailable', 503)
        }
        throw error
      }
    },
  },
)
