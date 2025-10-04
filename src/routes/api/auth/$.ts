import { createFileRoute } from '@tanstack/react-router'
import { reactStartHandler } from "~/server/auth.server"

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return reactStartHandler(request)
      },
      POST: ({ request }) => {
        return reactStartHandler(request)
      },
    },
  },
})