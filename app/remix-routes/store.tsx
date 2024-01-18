import { Outlet } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { seo } from '~/utils/seo'

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Store | React Store, Solid Store, Svelte Store, Vue Store',
    description:
      'Framework agnostic, type-safe store w/ reactive framework adapters',
    image: 'https://github.com/tanstack/store/raw/main/media/repo-header.png',
  })
}

export const loader = async (context: LoaderFunctionArgs) => {
  if (
    !context.request.url.includes('/store/v') &&
    !context.request.url.includes('/store/latest')
  ) {
    return redirect(`${new URL(context.request.url).origin}/store/latest`)
  }

  return new Response('OK')
}

export default function RouteStore() {
  return <Outlet />
}
