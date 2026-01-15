import { redirect, createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { useCapabilities } from '~/hooks/useCapabilities'
import { hasCapability } from '~/db/types'
import { requireCapability } from '~/utils/auth.server'
import { seo } from '~/utils/seo'
import styles from '~/styles/builder.css?url'
import { BuilderProvider, BuilderLayout } from '~/components/builder'

const isDev = import.meta.env.DEV

// Search params schema for shareable URLs
const builderSearchSchema = z.object({
  name: z.string().optional(),
  mode: z.enum(['file-router', 'code-router']).optional(),
  ts: z.boolean().optional(),
  tw: z.boolean().optional(),
  starter: z.string().optional(),
  addons: z.string().optional(),
  // UI state
  tab: z.enum(['files', 'preview']).optional(),
  file: z.string().optional(),
  terminal: z.boolean().optional(),
})

export const Route = createFileRoute('/builder')({
  ssr: false,
  validateSearch: builderSearchSchema,
  component: RouteComponent,
  staticData: {
    Title: () => (
      <Link
        to="/builder"
        className="hover:text-blue-500 flex items-center gap-2 text-gray-500"
      >
        Builder
      </Link>
    ),
  },
  beforeLoad: async () => {
    // Bypass auth in dev mode
    if (isDev) {
      return { user: null }
    }
    try {
      const user = await requireCapability({ data: { capability: 'builder' } })
      return { user }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
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
})

function RouteComponent() {
  const capabilities = useCapabilities()
  const canAccess = isDev || hasCapability(capabilities, 'builder')

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        You are not authorized to access this page. Please contact support.
      </div>
    )
  }

  return (
    <div className="builder-root h-[calc(100dvh-var(--navbar-height))] w-full overflow-hidden">
      <BuilderProvider>
        <BuilderLayout />
      </BuilderProvider>
    </div>
  )
}
