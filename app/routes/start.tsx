import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
// import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/start')({
  component: RouteStart,
  meta: () =>
    seo({
      title: 'TanStack Start',
      description:
        'Full-stack React Framework powered by TanStack Router. Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router, Vinxi, and Nitro and ready to deploy to your favorite hosting provider.',
      image: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
    }),
})

export default function RouteStart() {
  return (
    <>
      <Outlet />
      {/* <Scarf id="72ec4452-5d77-427c-b44a-57515d2d83aa" /> */}
    </>
  )
}
