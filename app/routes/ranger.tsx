import type { LoaderFunction, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { Scarf } from '~/components/Scarf'
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
  return (
    <>
      <Outlet />
      <Scarf id="dd278e06-bb3f-420c-85c6-6e42d14d8f61" />
    </>
  )
}
