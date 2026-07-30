import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_library/charts/catalog/all')({
  beforeLoad: () => {
    throw redirect({ to: '/charts/catalog' })
  },
})
