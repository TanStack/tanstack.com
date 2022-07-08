import { Outlet } from '@remix-run/react'
import { LoaderFunction, MetaFunction, redirect } from '@remix-run/node'
import { seo } from '~/utils/seo'

export let meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Virtual | React Virtual, Solid Virtual, Svelte Virtual, Vue Virtual',
    description:
      'Headless UI for virtualizing large element lists with TS/JS, React, Solid, Svelte and Vue',
    image: 'https://github.com/tanstack/virtual/raw/beta/media/header.png',
  })
}

export const loader: LoaderFunction = async (context) => {
  if (!context.request.url.includes('/virtual/v')) {
    return redirect(`${new URL(context.request.url).origin}/virtual/v3`)
  }

  return new Response('OK')
}

export default function RouteReactVirtual() {
  return <Outlet />
}
