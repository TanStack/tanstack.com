import { reactStartHandler } from '~/utils/auth.server'

export const ServerRoute = createServerFileRoute().methods({
  GET: ({ request }) => {
    return reactStartHandler(request)
  },
  POST: ({ request }) => {
    return reactStartHandler(request)
  },
})