import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/chat/w/$workspaceId/home/$homeSection')({
  beforeLoad: ({ params, search }) => {
    if (
      params.homeSection === 'conversations' ||
      params.homeSection === 'attention'
    ) {
      throw redirect({
        to: '/chat/w/$workspaceId',
        params: { workspaceId: params.workspaceId },
        search:
          params.homeSection === 'attention'
            ? { ...search, view: 'attention', sort: 'unread', group: 'section' }
            : search,
        replace: true,
      })
    }
  },
})
