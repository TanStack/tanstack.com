import type { LoaderFunction, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { Scarf } from '~/components/Scarf'
import { seo } from '~/utils/seo'

export const meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Router | React Router, Solid Router, Svelte Router, Vue Router',
    description:
      'Powerful routing and first-class search-param APIs for JS/TS, React, Solid, Vue and Svelte',
    image: 'https://github.com/tanstack/router/raw/beta/media/header.png',
  })
}

export const loader: LoaderFunction = async (context) => {
  if (!context.request.url.includes('/router/v')) {
    return redirect(`${new URL(context.request.url).origin}/router/v1`)
  }

  return new Response('OK')
}

export default function RouteReactTable() {
  return (
    <>
      <Outlet />
      <Scarf id="3d14fff2-f326-4929-b5e1-6ecf953d24f4" />
    </>
  )
}
