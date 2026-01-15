import { redirect, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { ShowcaseSubmitForm } from '~/components/ShowcaseSubmitForm'
import { requireAuth } from '~/utils/auth.server'

export const Route = createFileRoute('/showcase/submit')({
  beforeLoad: async () => {
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({ to: '/login', search: { redirect: '/showcase/submit' } })
    }
  },
  component: ShowcaseSubmitForm,
  head: () => ({
    meta: seo({
      title: 'Submit Your Project | Showcase | TanStack',
      description:
        'Submit your project to the TanStack showcase. Share what you built with TanStack libraries.',
    }),
  }),
})
