import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/query/$version/docs/framework/$framework/examples/'
)({
  loader: (ctx) => {
    throw redirect({
      href: ctx.location.href.replace(
        /\/docs.*/,
        '/docs/framework/react/overview'
      ),
    })
  },
})
