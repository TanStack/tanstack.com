import { createFileRoute } from '@tanstack/react-router'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '~/server/uploadthing'

const handlers = createRouteHandler({ router: uploadRouter })

export const Route = createFileRoute('/api/uploadthing')({
  // @ts-expect-error server property not in route types yet
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handlers(request),
      POST: async ({ request }: { request: Request }) => handlers(request),
    },
  },
})
