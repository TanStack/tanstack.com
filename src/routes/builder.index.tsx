import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'
import { BuilderProvider, BuilderLayout } from '~/components/builder'

// Search params schema for shareable URLs
const builderSearchSchema = z
  .object({
    name: z.string().optional(),
    features: z.string().optional(), // comma-separated feature IDs
    tab: z.enum(['files', 'addons', 'preview']).optional(),
    file: z.string().optional(), // selected file in files tab
    addon: z.string().optional(), // selected addon in addons tab
    addonFile: z.string().optional(), // selected file in addon view
    // Feature options as key.value params handled dynamically
  })
  .passthrough()

export const Route = createFileRoute('/builder/')({
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
        <span className="px-1.5 py-0.5 text-[.6rem] font-black border border-amber-500 text-amber-500 rounded-md uppercase">
          Alpha
        </span>
      </Link>
    ),
  },
  head: () => ({
    meta: seo({
      title: 'TanStack Builder',
      description: 'Build amazing applications with TanStack',
    }),
  }),
})

function RouteComponent() {
  return (
    <div className="h-[calc(100dvh-var(--navbar-height))] w-full overflow-hidden">
      <BuilderProvider>
        <BuilderLayout />
      </BuilderProvider>
    </div>
  )
}
