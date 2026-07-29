import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { seo } from '~/utils/seo'

const LazyBuilderPage = React.lazy(() =>
  import('~/components/builder/BuilderPage.client').then((m) => ({
    default: m.BuilderPage,
  })),
)

// Search params schema for shareable URLs
const builderSearchSchema = z
  .object({
    name: z.string().optional(),
    framework: z.string().optional(),
    features: z.string().optional(), // comma-separated feature IDs
    pm: z.enum(['pnpm', 'npm', 'yarn', 'bun']).optional(),
    tailwind: z.enum(['false']).optional(),
    tab: z.enum(['summary', 'code', 'preview']).optional(),
    file: z.string().optional(), // selected file in files tab
    addon: z.string().optional(), // selected addon in addons tab
    addonFile: z.string().optional(), // selected file in addon view
    template: z.string().optional(),
    // Feature options as key.value params handled dynamically
  })
  .passthrough()

export const Route = createFileRoute('/builder/')({
  ssr: false,
  validateSearch: builderSearchSchema,
  component: RouteComponent,
  staticData: {
    includeSearchInCanonical: true,
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
      <ClientOnly>
        <React.Suspense fallback={null}>
          <LazyBuilderPage />
        </React.Suspense>
      </ClientOnly>
    </div>
  )
}
