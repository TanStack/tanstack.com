import { redirect } from '@tanstack/react-router'

export const Route = createFileRoute({
  beforeLoad: () => {
    throw redirect({
      href: `https://cottonbureau.com/people/tanstack`,
      code: 301,
    })
  },
})
