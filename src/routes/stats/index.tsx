import { createFileRoute } from '@tanstack/react-router'
import {  redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/stats/')({
  beforeLoad: () => {
    throw redirect({ to: '/stats/npm' })
  },
})
