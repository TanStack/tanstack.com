import { createFileRoute } from '@tanstack/react-router'
import { jsonError } from '~/utils/api-boundary.server'
import {
  getNotebookProjectCacheTag,
  getNotebookProjectObject,
  isNotebookProjectHash,
  NotebookProjectStorageUnavailableError,
} from '~/utils/notebook-project-storage.server'

export const Route = createFileRoute('/api/notebook/projects/$hash')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { hash: string } }) => {
        if (!isNotebookProjectHash(params.hash)) {
          return jsonError('Notebook project not found', 404)
        }

        try {
          const object = await getNotebookProjectObject(params.hash)
          if (!object) return jsonError('Notebook project not found', 404)

          return new Response(object.body ?? (await object.arrayBuffer()), {
            headers: {
              'Cache-Control': 'public, max-age=300, must-revalidate',
              'Cache-Tag': getNotebookProjectCacheTag(params.hash),
              'Cloudflare-CDN-Cache-Control':
                'public, max-age=31536000, immutable',
              'Content-Encoding': 'gzip',
              'Content-Type': 'application/json; charset=utf-8',
              ETag: `"${params.hash}"`,
            },
          })
        } catch (error) {
          if (error instanceof NotebookProjectStorageUnavailableError) {
            return jsonError('Notebook project storage is unavailable', 503)
          }
          throw error
        }
      },
    },
  },
})
