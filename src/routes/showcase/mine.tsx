import { createFileRoute, redirect } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { MyShowcases } from '~/components/MyShowcases'
import { getMyShowcasesQueryOptions } from '~/queries/showcases'
import { requireAuth } from '~/utils/auth.server'

export const Route = createFileRoute('/showcase/mine')({
  beforeLoad: async () => {
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/showcase/mine' } })
    }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(
      getMyShowcasesQueryOptions({
        pagination: { page: 1, pageSize: 20 },
      }),
    )
  },
  component: MyShowcases,
  head: () => ({
    meta: seo({
      title: 'My Submissions | Showcase | TanStack',
      description: 'View and manage your showcase submissions.',
    }),
  }),
})
