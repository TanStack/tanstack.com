import { reactStartHandler } from 'src/libraries/server-auth-utils'

export const ServerRoute = createServerFileRoute().methods({
  GET: ({ request }) => {
    return reactStartHandler(request)
  },
  POST: ({ request }) => {
    return reactStartHandler(request)
  },
})