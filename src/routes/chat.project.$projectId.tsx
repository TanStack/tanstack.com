import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getCurrentUser } from '~/utils/auth.functions'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { defaultWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/project/$projectId')({
  beforeLoad: async ({ params }) => {
    const parsed = z.uuid().safeParse(params.projectId)
    if (!parsed.success) throw notFound()
    const user = await getCurrentUser()
    if (!user)
      throw redirect({
        to: '/login',
        search: { returnTo: `/chat/project/${parsed.data}` },
      })
    const workspace = await loadChatWorkspace()
    throw redirect({
      to: '/chat/w/$workspaceId/b/$botId',
      params: {
        workspaceId: workspace.workspace.id,
        botId: workspace.assistantId,
      },
      search: {
        ...defaultWorkspaceSearch,
        project: parsed.data,
        panel: 'projects',
        panels: ['projects'],
      },
    })
  },
})
