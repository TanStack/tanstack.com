import { reactStartHandler } from 'src/utils/auth'

export const ServerRoute = createServerFileRoute().methods({
  GET: ({ request }) => {
    return reactStartHandler(request)
  },
  POST: ({ request }) => {
    return reactStartHandler(request)
  },
})