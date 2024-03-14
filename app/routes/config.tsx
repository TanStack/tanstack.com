import { seo } from '~/utils/seo'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/config')({
  component: RouteComp,
  meta: () =>
    seo({
      title: 'TanStack Config',
      description:
        'Configuration and tools for publishing and maintaining high-quality JavaScript packages',
      image:
        'https://github.com/tanstack/config/raw/main/media/repo-header.png',
    }),
})

export default function RouteComp() {
  return (
    <>
      <Outlet />
      {/* <Scarf id="72ec4452-5d77-427c-b44a-57515d2d83aa" /> */}
    </>
  )
}
