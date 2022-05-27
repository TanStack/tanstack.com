import { LoaderFunction, MetaFunction, Outlet, redirect } from 'remix'
import { seo } from '~/utils/seo'

export let meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Table | React Table, Solid Table, Svelte Table, Vue Table',
    description:
      'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
  })
}

export const loader: LoaderFunction = async (context) => {
  if (!context.request.url.includes('/table/v')) {
    return redirect(`${new URL(context.request.url).origin}/table/v8`)
  }

  return new Response('OK')
}

export default function RouteReactTable() {
  return <Outlet />
}
