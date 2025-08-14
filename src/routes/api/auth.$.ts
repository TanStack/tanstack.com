import { reactStartHandler } from '~/lib/auth-server-utils'

export const ServerRoute = createServerFileRoute().methods({
  GET: ({ request }) => {
    return reactStartHandler(request)
  },
  POST: ({ request }) => {
    return reactStartHandler(request)
  },
})
