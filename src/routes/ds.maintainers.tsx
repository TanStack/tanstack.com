import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/ds/maintainers')({
  beforeLoad: () => {
    throw redirect({ to: '/ds/avatar', hash: 'maintainer-card' })
  },
})
