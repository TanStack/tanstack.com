import { lazy, Suspense } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'

const loadPanel = createIsomorphicFn()
  .client(() =>
    import('./ProjectsPanel.client').then((module) => ({
      default: module.ProjectsPanel,
    })),
  )
  .server(async () => {
    throw new Error('The project panel can only load in the browser.')
  })
const Panel = lazy(loadPanel)

export function ProjectsPanel({ userId }: { userId: string }) {
  return (
    <ClientOnly fallback={<p role="status">Loading projects…</p>}>
      <Suspense fallback={<p role="status">Loading projects…</p>}>
        <Panel userId={userId} />
      </Suspense>
    </ClientOnly>
  )
}
