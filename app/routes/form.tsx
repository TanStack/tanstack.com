import { Outlet } from '@remix-run/react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const meta: MetaFunction = () => {
  return seo({
    title: 'TanStack Form | React Form, Solid Form, Vue Form, Lit Form',
    description:
      'Simple, performant, type-safe forms for TS/JS, React, Solid, Vue, and Lit',
    image: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
  })
}

export const loader = async (context: LoaderFunctionArgs) => {
  if (
    !context.request.url.includes('/form/v') &&
    !context.request.url.includes('/form/latest')
  ) {
    return redirect(`${new URL(context.request.url).origin}/form/latest`)
  }

  return new Response('OK')
}

export default function RouteForm() {
  return (
    <>
      <Outlet />
      <Scarf id="72ec4452-5d77-427c-b44a-57515d2d83aa" />
    </>
  )
}
