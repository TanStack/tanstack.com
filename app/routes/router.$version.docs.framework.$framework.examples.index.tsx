import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/router/$version/docs/framework/$framework/examples/'
)({
  loader: (ctx) => {
    throw redirect({
      href: ctx.location.href.replace(/\/examples.*/, '/examples/basic'),
    })
  },
})
