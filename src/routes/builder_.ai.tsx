import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/builder_/ai')({
  beforeLoad: () => {
    throw redirect({ to: '/chat', replace: true, reloadDocument: true })
  },
})
