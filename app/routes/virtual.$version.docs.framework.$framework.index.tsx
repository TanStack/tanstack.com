import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/virtual/$version/docs/framework/$framework/'
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
