import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/form')({
  component: RouteForm,
  meta: () =>
    seo({
      title: 'TanStack Form | React Form, Solid Form, Svelte Form, Vue Form',
      description:
        'Simple, performant, type-safe forms for TS/JS, React, Solid, Svelte and Vue',
      image: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
    }),
})

export default function RouteForm() {
  return (
    <>
      <Outlet />
      <Scarf id="72ec4452-5d77-427c-b44a-57515d2d83aa" />
    </>
  )
}
