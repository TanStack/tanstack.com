import { Outlet, createFileRoute } from '@tanstack/react-router'

import { seo } from '~/utils/seo'
import { Scarf } from '~/components/Scarf'

export const Route = createFileRoute('/ranger')({
  meta: () =>
    seo({
      title: 'TanStack Ranger | React Ranger',
      description: 'Headless range and multi-range slider utilities, React',
      image: 'https://github.com/TanStack/ranger/raw/main/media/header.png',
    }),
  component: RouteComp,
})

export default function RouteComp() {
  return (
    <>
      <Outlet />
      <Scarf id="dd278e06-bb3f-420c-85c6-6e42d14d8f61" />
    </>
  )
}
