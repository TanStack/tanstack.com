import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/router')({
  component: RouteReactTable,
  meta: () =>
    seo({
      title:
        'TanStack Router | React Router, Solid Router, Svelte Router, Vue Router',
      description:
        'Powerful routing and first-class search-param APIs for JS/TS, React, Solid, Vue and Svelte',
      image: 'https://github.com/tanstack/router/raw/main/media/header.png',
    }),
})

function RouteReactTable() {
  return (
    <>
      <Outlet />
      <Scarf id="3d14fff2-f326-4929-b5e1-6ecf953d24f4" />
    </>
  )
}
