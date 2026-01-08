import { createFileRoute, redirect } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { ShowcaseSubmitForm } from '~/components/ShowcaseSubmitForm'
import { requireAuth } from '~/utils/auth.server'
import { getShowcase } from '~/utils/showcase.functions'

export const Route = createFileRoute('/showcase/edit/$id')({
  beforeLoad: async ({ params }) => {
    try {
      const user = await requireAuth()
      return { user }
    } catch {
      throw redirect({
        to: '/login',
        search: { redirect: `/showcase/edit/${params.id}` },
      })
    }
  },
  loader: async ({ params, context }) => {
    const result = await getShowcase({ data: { showcaseId: params.id } })

    // Verify ownership for editing
    if (result.showcase.userId !== context.user.userId) {
      throw redirect({ to: '/account/submissions' })
    }

    return { showcase: result.showcase }
  },
  component: EditShowcasePage,
  head: () => ({
    meta: seo({
      title: 'Edit Your Project | Showcase | TanStack',
      description: 'Edit your showcase submission.',
    }),
  }),
})

function EditShowcasePage() {
  const { showcase } = Route.useLoaderData()
  return <ShowcaseSubmitForm showcase={showcase} />
}
