import { createFileRoute } from '@tanstack/react-router'
import { handlePlugins } from '../plugins'

export const Route = createFileRoute('/api/chat/plugins/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handlePlugins(request, params.id),
      POST: ({ request, params }) => handlePlugins(request, params.id),
    },
  },
})
