import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/query')({
  meta: () =>
    seo({
      title:
        'TanStack Query | React Query | Vue Query | Svelte Query | Solid Query | Angular Query',
      description:
        'Powerful asynchronous state management, server-state utilities and data fetching. Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid, Svelte & Angular applications all without touching any "global state"',
      image: 'https://github.com/TanStack/ranger/raw/main/media/header.png',
    }),
  component: RouteComp,
})

export default function RouteComp() {
  return (
    <>
      <Outlet />
      <Scarf id="53afb586-3934-4624-a37a-e680c1528e17" />
    </>
  )
}
