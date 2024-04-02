import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/table')({
  meta: () =>
    seo({
      title:
        'TanStack Table | React Table, Solid Table, Svelte Table, Vue Table',
      description:
        'Headless UI for building powerful tables & datagrids with TS/JS, React, Solid, Svelte and Vue',
      image: 'https://github.com/tanstack/table/raw/main/media/repo-header.png',
    }),
  component: Virtual,
})

function Virtual() {
  return (
    <>
      <Outlet />
      <Scarf id="dc8b39e1-3fe9-4f3a-8e56-d4e2cf420a9e" />
    </>
  )
}
