import { createFileRoute, Outlet } from '@tanstack/react-router'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/application-starter')({
  head: () => ({
    meta: seo({
      title: 'TanStack Application Starter',
      description: 'Build amazing applications with TanStack',
    }),
  }),
  component: () => <Outlet />,
})
