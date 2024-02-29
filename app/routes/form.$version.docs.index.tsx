import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/form/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      href: ctx.location.href.replace(
        /\/docs.*/,
        '/docs/framework/react/overview'
      ),
    })
  },
})
