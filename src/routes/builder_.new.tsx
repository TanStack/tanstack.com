import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/builder_/new')({
  validateSearch: z.object({ template: z.string().min(1).max(200).optional() }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/chat/new-project',
      search,
      replace: true,
      reloadDocument: true,
    })
  },
})
