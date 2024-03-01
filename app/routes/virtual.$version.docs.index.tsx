import {
  createFileRoute,
  redirect,
  RegisteredRouter,
  RouteIds,
} from '@tanstack/react-router'

type test = RouteIds<RegisteredRouter['routeTree']>

export const Route = createFileRoute('/virtual/$version/docs/')({
  loader: (ctx) => {
    throw redirect({
      to: '/virtual/$version/docs/framework/$framework',
      params: {
        version: 'latest',
        framework: 'react',
      },
    })
  },
})
