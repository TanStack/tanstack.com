import { redirect, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { ShowcaseSubmitForm } from '~/components/ShowcaseSubmitForm'
import { requireAuth } from '~/utils/auth.functions'

export const Route = createFileRoute('/showcase/submit')({
  beforeLoad: async () => {
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({
        to: '/login',
        search: { redirect: '/showcase/submit' },
      })
    }
  },
  component: ShowcaseSubmitForm,
  head: () => ({
    meta: seo({
      noindex: true,
      title: 'Submit Your Project | Showcase | TanStack',
      description:
        'Submit a TanStack project for Community review and possible Showcase selection.',
    }),
  }),
})
