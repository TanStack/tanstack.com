import { Outlet } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { seo } from '~/utils/seo'

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Config',
    description:
      'Configuration and tools for publishing and maintaining high-quality JavaScript packages',
    image: 'https://github.com/tanstack/config/raw/main/media/repo-header.png',
  })
}

export const loader = async (context: LoaderFunctionArgs) => {
  if (
    !context.request.url.includes('/config/v') &&
    !context.request.url.includes('/config/latest')
  ) {
    return redirect(`${new URL(context.request.url).origin}/config/latest`)
  }

  return new Response('OK')
}

export default function RouteForm() {
  return <Outlet />
}
