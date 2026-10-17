import { createFileRoute } from '@tanstack/react-router'
import { handleWorkspaceIndex } from '~/chat/server/workspace-index-http.server'
export const Route = createFileRoute('/api/chat/workspace-index')({
  server: { handlers: { GET: ({request}) => handleWorkspaceIndex(request) } },
})
