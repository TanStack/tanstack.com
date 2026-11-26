import * as React from 'react'
import { getLibrary } from '~/libraries'
import { getClientExampleConfig } from '~/utils/client-example-config'
import { fetchClientExampleFiles } from '~/utils/docs'
import type { ExampleDefinition } from '~/utils/example-workspace'
import { createRepositoryExampleDefinition } from '~/utils/repository-example'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

export function ClientExampleDocEmbedClient({
  fallback,
  framework,
  library,
  slug,
  version,
}: {
  fallback: React.ReactNode
  framework: string
  library: string
  slug: string
  version: string
}) {
  const config = getClientExampleConfig({
    framework,
    libraryId: library,
    slug,
    version,
  })
  const [definition, setDefinition] = React.useState<ExampleDefinition>()

  React.useEffect(() => {
    let cancelled = false
    setDefinition(undefined)

    const currentConfig = getClientExampleConfig({
      framework,
      libraryId: library,
      slug,
      version,
    })
    if (!currentConfig) return

    void fetchClientExampleFiles({
      data: {
        example: currentConfig.slug,
        framework: currentConfig.framework,
        libraryId: currentConfig.libraryId,
        version,
      },
    })
      .then((result) => {
        if (cancelled || !result.success) return

        try {
          const nextDefinition = createRepositoryExampleDefinition({
            binaryFiles: result.binaryFiles,
            entry: currentConfig.entry,
            files: result.files,
            id: `${currentConfig.libraryId}-${currentConfig.framework}-${currentConfig.slug}`,
            runtime: currentConfig.runtime,
            title: currentConfig.slug,
          })
          if (!cancelled) setDefinition(nextDefinition)
        } catch {
          if (!cancelled) setDefinition(undefined)
        }
      })
      .catch(() => {
        if (!cancelled) setDefinition(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [framework, library, slug, version])

  if (!config || !definition) return fallback

  return (
    <React.Suspense fallback={fallback}>
      <LazyExampleWorkbench
        autoRun={config.autoStart}
        definition={definition}
        libraryColor={getLibrary(config.libraryId).bgStyle}
        packageResolution="dynamic"
      />
    </React.Suspense>
  )
}
