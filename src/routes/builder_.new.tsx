import { createFileRoute, redirect } from '@tanstack/react-router'
import * as v from 'valibot'

export const Route = createFileRoute('/builder_/new')({
  validateSearch: v.object({
    template: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/chat/new-project',
      search,
      replace: true,
      reloadDocument: true,
    })
  },
})
