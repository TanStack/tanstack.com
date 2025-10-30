import { createFileRoute } from '@tanstack/react-router'
import styles from '~/styles/builder.css?url'
import { seo } from '~/utils/seo'
import BuilderRoot from '~/cta/components/cta-ui'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { Authenticated } from 'convex/react'
import { requireAuth } from '~/utils/utils'

export const Route = createFileRoute('/builder')({
  ssr: true,
  component: BuilderComponent,
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: styles,
      },
    ],
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
  beforeLoad: async (ctx) => {
    requireAuth(ctx)
  },
  loader: async (opts) => {
    const user = await opts.context.ensureUser()
    return { user }
  },
  headers(ctx) {
    return {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
})

function BuilderComponent() {
  const { isLoading, data: user } = useCurrentUserQuery()

  if (isLoading) {
    return null
  }

  if (!user?.capabilities.includes('builder')) {
    return null
  }

  return (
    <Authenticated>
      <div className="flex h-screen">
        <div className="flex-1 flex">
          <BuilderRoot />
        </div>
      </div>
    </Authenticated>
  )
}
