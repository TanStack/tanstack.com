import { redirect, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/showcases')({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: location.href.replace(/^\/showcases/, '/showcase'),
    })
  },
})
