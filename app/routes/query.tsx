import { Outlet } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Query | React Query, Solid Query, Svelte Query, Vue Query',
    description:
      'Powerful asynchronous state management, server-state utilities and  data fetching for TS/JS, React, Solid, Svelte and Vue',
    image: 'https://github.com/tanstack/query/raw/main/media/repo-header.png',
  })
}

export const loader = async (context: LoaderFunctionArgs) => {
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
