import { ClientOnly, useParams } from '@tanstack/react-router'
import * as React from 'react'
import { getClientExampleConfig } from '~/utils/client-example-config'

const LazyClientExampleDocEmbed = React.lazy(() =>
  import('./ClientExampleDocEmbed.client').then((module) => ({
    default: module.ClientExampleDocEmbedClient,
  })),
)

const clientExampleAttributeKeys = ['framework', 'library', 'slug']
const clientExampleAttributePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseClientExampleAttributes(value: unknown) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, clientExampleAttributeKeys) ||
    typeof value.library !== 'string' ||
    typeof value.framework !== 'string' ||
    typeof value.slug !== 'string' ||
    !isClientExampleAttribute(value.library) ||
    !isClientExampleAttribute(value.framework) ||
    !isClientExampleAttribute(value.slug)
  ) {
    return null
  }

  return {
    library: value.library,
    framework: value.framework,
    slug: value.slug,
  }
}

export function ClientExampleDocEmbed({
  framework,
  library,
  slug,
}: {
  framework: string
  library: string
  slug: string
}) {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? 'latest'
  const config = getClientExampleConfig({
    framework,
    libraryId: library,
    slug,
    version: resolvedVersion,
  })

  if (!config) return null

  const fallback = <ClientExampleDocEmbedFallback slug={config.slug} />

  return (
    <section className="not-prose my-5">
      <ClientOnly fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <LazyClientExampleDocEmbed
            fallback={fallback}
            framework={config.framework}
            library={config.libraryId}
            slug={config.slug}
            version={resolvedVersion}
          />
        </React.Suspense>
      </ClientOnly>
    </section>
  )
}

function ClientExampleDocEmbedFallback({ slug }: { slug: string }) {
  return (
    <div
      className="flex h-[clamp(520px,75dvh,720px)] min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-background-default"
      data-client-example={slug}
      data-client-example-state="static"
    >
      <header className="flex min-h-10 shrink-0 items-center border-b border-border-default px-3 font-ds-mono text-xs text-text-muted">
        {slug}
      </header>
      <div
        aria-hidden="true"
        className="flex min-h-0 flex-1 flex-col gap-2 bg-background-subtle p-4"
      >
        <div className="h-3 w-2/3 rounded bg-border-subtle" />
        <div className="h-3 w-1/2 rounded bg-border-subtle" />
        <div className="h-3 w-3/4 rounded bg-border-subtle" />
      </div>
    </div>
  )
}

function isClientExampleAttribute(value: string) {
  return clientExampleAttributePattern.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
