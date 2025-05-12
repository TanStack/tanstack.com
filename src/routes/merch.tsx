import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/merch')({
  beforeLoad: () => {
    throw redirect({
      href: `https://cottonbureau.com/people/tanstack`,
      code: 301,
    })
  },
})
