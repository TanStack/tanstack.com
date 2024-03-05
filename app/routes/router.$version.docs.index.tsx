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
      to: '/router/$version/docs/framework/$framework',
      params: {
        version: 'latest',
        framework: 'react',
      },
    })
  },
})
