import { createFileRoute } from '@tanstack/react-router'
import { handleWorkspaceSync } from '~/chat/server/workspace-sync-http.server'
export const Route = createFileRoute('/api/chat/workspace-sync/$operation')({
  server: {handlers: {GET: ({request,params}) => handleWorkspaceSync(request,params.operation)}},
})
