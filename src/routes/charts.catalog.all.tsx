import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/charts/catalog/all')({
  beforeLoad: () => {
    throw redirect({ to: '/charts/catalog' })
  },
})
