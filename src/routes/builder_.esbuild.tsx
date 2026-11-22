import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/builder_/esbuild')({
  beforeLoad: () => {
    throw redirect({ to: '/chat', replace: true })
  },
})
