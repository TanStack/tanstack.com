import { createFileRoute, redirect } from '@tanstack/react-router'
import * as v from 'valibot'
import { getCurrentUser } from '~/utils/auth.functions'
import { loadChatWorkspace } from '~/chat/workspace.functions'
import { defaultWorkspaceSearch } from '~/chat/core/navigation'

export const Route = createFileRoute('/chat/new-project')({
  validateSearch: v.object({
    template: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  }),
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
      to: '/chat/c/$conversationId',
      params: {
        conversationId: workspace.conversationId,
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
