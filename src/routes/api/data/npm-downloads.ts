import { createFileRoute } from '@tanstack/react-router'
import { readNpmDownloads } from '~/utils/npm-downloads-api.server'

export const Route = createFileRoute('/api/data/npm-downloads')({
  server: {
    handlers: {
      POST: ({ request }) => readNpmDownloads(request),
    },
  },
})
