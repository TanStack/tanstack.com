import { LoaderFunction, MetaFunction, Outlet, redirect } from 'remix'
import { seo } from '~/utils/seo'

export let meta: MetaFunction = () => {
  return seo({
    title:
      'TanStack Virtual | React Virtual, Solid Virtual, Svelte Virtual, Vue Virtual',
    description:
      'Headless UI for virtualizing large element lists with TS/JS, React, Solid, Svelte and Vue',
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
