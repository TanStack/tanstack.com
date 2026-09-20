import * as React from 'react'
import { ExampleWorkbench } from './ExampleWorkbench.client'
import { BuilderEmbeddedSkeleton } from '~/components/builder/BuilderLoading'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { shouldAutoRunBuilder } from '~/utils/builder-auto-run.client'
import { decodeSharedExampleProject } from '~/utils/example-share.client'
import {
  parseSharedExampleProject,
  sharedProjectToExampleDefinition,
  type SharedExampleProject,
} from '~/utils/example-project'

export function SharedExamplePage({ hash }: { hash?: string }) {
  const user = useCurrentUser()
  const [project, setProject] = React.useState<SharedExampleProject>()
  const [error, setError] = React.useState('')
  const definition = React.useMemo(
    () =>
      project
        ? sharedProjectToExampleDefinition(hash ?? 'shared-builder', project)
        : undefined,
    [hash, project],
  )

  React.useEffect(() => {
    let active = true

    async function load() {
      try {
        const nextProject = hash
          ? await fetchStoredProject(hash)
          : await decodeSharedExampleProject(window.location.hash)

        if (!nextProject) throw new Error('This builder link is invalid.')
        if (active) setProject(nextProject)
      } catch (cause) {
        if (active) setError(formatError(cause))
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [hash])

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Unable to open builder</h1>
        <p className="mt-2 text-sm text-text-muted">{error}</p>
      </main>
    )
  }

  if (!project || !definition) return <BuilderEmbeddedSkeleton />

  return (
    <main className="w-full p-3 sm:p-4">
      <header className="mb-3 min-w-0">
        <h1 className="truncate text-base font-semibold">{project.title}</h1>
        {project.description ? (
          <p className="truncate text-sm text-text-muted">
            {project.description}
          </p>
        ) : null}
      </header>
      <ExampleWorkbench
        allowSharing={Boolean(user)}
        autoRun={shouldAutoRunBuilder(window.navigator)}
        definition={definition}
        runLabel="Run builder"
      />
    </main>
  )
}

async function fetchStoredProject(hash: string) {
  const response = await fetch(`/api/builder/projects/${hash}`)
  if (!response.ok) throw new Error('This builder was not found.')
  return parseSharedExampleProject(await response.json())
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
