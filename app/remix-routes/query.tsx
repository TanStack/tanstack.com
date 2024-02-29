import { Outlet } from '@tanstack/react-router'
import type { LoaderFunctionArgs } from '@remix-run/node'

import { Scarf } from '~/components/Scarf'

export const loader = async (context) => {
  if (
    !context.request.url.includes('/query/v') &&
    !context.request.url.includes('/query/latest')
  ) {
    return redirect(`${new URL(context.request.url).origin}/query/latest`)
  }

  return new Response('OK')
}

export default function RouteQuery() {
  return (
    <>
      <Outlet />
      <Scarf id="53afb586-3934-4624-a37a-e680c1528e17" />
    </>
  )
}
