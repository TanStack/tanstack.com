import type { LoaderFunction, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { seo } from '~/utils/seo'

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Ranger | React Ranger',
    description: 'Headless range and multi-range slider utilities, React',
    image: 'https://github.com/TanStack/ranger/raw/main/media/header.png',
  })
}

export const loader: LoaderFunction = async (context) => {
  if (!context.request.url.includes('/ranger/v')) {
    return redirect(`${new URL(context.request.url).origin}/ranger/v1`)
  }

  return new Response('OK')
}

export default function RouteReactTable() {
  return <Outlet />
}
