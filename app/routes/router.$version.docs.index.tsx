import {
  createFileRoute,
  redirect,
  RegisteredRouter,
  RouteIds,
} from '@tanstack/react-router'

type test = RouteIds<RegisteredRouter['routeTree']>

export const Route = createFileRoute('/router/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/',
      // href: ctx.location.href.replace(
      //   /\/docs.*/,
      //   '/docs/framework/react/overview'
      // ),
    })
  },
})
