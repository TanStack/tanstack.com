import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { seo } from '~/utils/seo'

const LazyApplicationStarterPage = React.lazy(() =>
  import('~/components/application-starter/ApplicationStarterPage.client').then(
    (m) => ({
      default: m.ApplicationStarterPage,
    }),
  ),
)

// Search params schema for shareable URLs
const applicationStarterSearchSchema = v.pipe(
  v.unknown(),
  v.check(
    (input) => !Array.isArray(input),
    'Expected a search parameters object',
  ),
  v.looseObject({
    name: v.optional(v.string()),
    framework: v.optional(v.string()),
    features: v.optional(v.string()), // comma-separated feature IDs
    pm: v.optional(v.picklist(['pnpm', 'npm', 'yarn', 'bun'])),
    tailwind: v.optional(v.literal('false')),
    tab: v.optional(v.picklist(['summary', 'code', 'preview'])),
    file: v.optional(v.string()), // selected file in files tab
    addon: v.optional(v.string()), // selected addon in addons tab
    addonFile: v.optional(v.string()), // selected file in addon view
    template: v.optional(v.string()),
    // Feature options as key.value params handled dynamically
  }),
)

export const Route = createFileRoute('/application-starter/')({
  ssr: false,
  validateSearch: applicationStarterSearchSchema,
  component: RouteComponent,
  staticData: {
    includeSearchInCanonical: true,
  },
  head: () => ({
    meta: seo({
      title: 'TanStack Application Starter',
      description: 'Build amazing applications with TanStack',
    }),
  }),
})

function RouteComponent() {
  return (
    <div className="h-[calc(100dvh-var(--navbar-height))] w-full overflow-hidden">
      <ClientOnly>
        <React.Suspense fallback={null}>
          <LazyApplicationStarterPage />
        </React.Suspense>
      </ClientOnly>
    </div>
  )
}
