import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getCurrentUser } from '~/utils/auth.functions'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { defaultWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/new-project')({
  validateSearch: z.object({ template: z.string().min(1).max(200).optional() }),
  beforeLoad: async ({ search }) => {
    const user = await getCurrentUser()
    if (!user) {
      const query = search.template
        ? `?${new URLSearchParams({ template: search.template })}`
        : ''
      throw redirect({
        to: '/login',
        search: { returnTo: `/chat/new-project${query}` },
      })
    }
    const workspace = await loadChatWorkspace()
    throw redirect({
      to: '/chat/w/$workspaceId/b/$botId',
      params: {
        workspaceId: workspace.workspace.id,
        botId: workspace.assistantId,
      },
      search: {
        ...defaultWorkspaceSearch,
        panel: 'projects',
        panels: ['projects'],
        projectTemplate: search.template ?? 'blank',
      },
      replace: true,
    })
  },
})
