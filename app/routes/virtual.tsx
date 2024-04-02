import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/virtual')({
  meta: () =>
    seo({
      title:
        'TanStack Virtual | React Virtual, Solid Virtual, Svelte Virtual, Vue Virtual',
      description:
        'Headless UI for virtualizing large element lists with TS/JS, React, Solid, Svelte and Vue',
      image: 'https://github.com/tanstack/virtual/raw/main/media/header.png',
    }),
  component: Virtual,
})

function Virtual() {
  return (
    <>
      <Outlet />
      <Scarf id="32372eb1-91e0-48e7-8df1-4808a7be6b94" />
    </>
  )
}
