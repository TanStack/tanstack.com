import * as React from 'react'
import { ExampleWorkbench } from './ExampleWorkbench.client'
import { decodeSharedExampleProject } from '~/utils/example-share.client'
import {
  parseSharedExampleProject,
  sharedProjectToExampleDefinition,
  type SharedExampleProject,
} from '~/utils/example-project'

export function SharedExamplePage({ hash }: { hash?: string }) {
  const [project, setProject] = React.useState<SharedExampleProject>()
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true

    async function load() {
      try {
        const nextProject = hash
          ? await fetchStoredProject(hash)
          : await decodeSharedExampleProject(window.location.hash)

        if (!nextProject) throw new Error('This notebook link is invalid.')
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
        <h1 className="text-xl font-semibold">Unable to open notebook</h1>
        <p className="mt-2 text-sm text-text-muted">{error}</p>
      </main>
    )
  }

  if (!project) return null

  const definition = sharedProjectToExampleDefinition(
    hash ?? 'shared-notebook',
    project,
  )

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
      <ExampleWorkbench allowSharing definition={definition} />
    </main>
  )
}

async function fetchStoredProject(hash: string) {
  const response = await fetch(`/api/notebook/projects/${hash}`)
  if (!response.ok) throw new Error('This notebook was not found.')
  return parseSharedExampleProject(await response.json())
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
