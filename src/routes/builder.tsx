import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import styles from '~/styles/builder.css?url'
import { BuilderProvider, BuilderLayout } from '~/components/builder'

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
  return (
    <div className="builder-root h-[calc(100dvh-var(--navbar-height))] w-full overflow-hidden">
      <BuilderProvider>
        <BuilderLayout />
      </BuilderProvider>
    </div>
  )
}
