import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import * as v from 'valibot'
import { getCurrentUser } from '~/utils/auth.functions'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { defaultWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/project/$projectId')({
  beforeLoad: async ({ params }) => {
    const parsed = v.safeParse(v.pipe(v.string(), v.uuid()), params.projectId)
    if (!parsed.success) throw notFound()
    const user = await getCurrentUser()
    if (!user)
      throw redirect({
        to: '/login',
        search: { returnTo: `/chat/project/${parsed.output}` },
      })
    const workspace = await loadChatWorkspace()
    throw redirect({
      to: '/chat/c/$conversationId',
      params: {
        conversationId: workspace.conversationId,
      },
      search: {
        ...defaultWorkspaceSearch,
        project: parsed.output,
        panel: 'projects',
        panels: ['projects'],
      },
    })
  },
})
