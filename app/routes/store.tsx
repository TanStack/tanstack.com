import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/store')({
  meta: () =>
    seo({
      title:
        'TanStack Store | React Store, Solid Store, Svelte Store, Vue Store',
      description:
        'Framework agnostic, type-safe store w/ reactive framework adapters',
      image: 'https://github.com/tanstack/store/raw/main/media/repo-header.png',
    }),
  component: StoreComp,
})

function StoreComp() {
  return (
    <>
      <Outlet />
      {/* <Scarf id="dc8b39e1-3fe9-4f3a-8e56-d4e2cf420a9e" /> */}
    </>
  )
}
