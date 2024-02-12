import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/query/$version/docs/framework/$framework/'
)({
  loader: ({ location, params }) => {
    throw redirect({
      to: location.pathname.replace(
        /\/docs.*/,
        `/docs/framework/${params.framework}/overview`
      ),
    })
  },
})
