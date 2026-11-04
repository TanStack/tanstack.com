import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/merch')({
  beforeLoad: () => {
    throw redirect({ to: '/shop', statusCode: 308 })
  },
})
