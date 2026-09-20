import type { ExampleWorkspace } from './example-workspace'
import type { BuilderAiExecution } from './builder-ai'

export function requiresBuilderWorkbenchReset(
  currentRuntime: BuilderAiExecution['runtime'],
  currentWorkspace: ExampleWorkspace,
  next: BuilderAiExecution,
) {
  if (JSON.stringify(currentRuntime) !== JSON.stringify(next.runtime)) {
    return true
  }
  if (!next.runtime) return false
  if (
    currentWorkspace.files['/package.json'] !==
    next.workspace.files['/package.json']
  ) {
    return true
  }

  return (
    hasDifferentPaths(currentWorkspace.files, next.workspace.files) ||
    hasDifferentPaths(
      currentWorkspace.binaryFiles ?? {},
      next.workspace.binaryFiles ?? {},
    )
  )
}

export function getBuilderAiHiddenFiles(
  hiddenFiles: ReadonlyArray<string> | undefined,
  workspace: ExampleWorkspace,
) {
  return [
    ...new Set([
      ...(hiddenFiles ?? []).filter((path) => !path.startsWith('/.tanstack/')),
      ...Object.keys(workspace.files).filter((path) =>
        path.startsWith('/.tanstack/'),
      ),
    ]),
  ]
}

function hasDifferentPaths(
  current: Record<string, string>,
  next: Record<string, string>,
) {
  const currentPaths = Object.keys(current)
  const nextPaths = Object.keys(next)
  return (
    currentPaths.length !== nextPaths.length ||
    currentPaths.some((path) => next[path] === undefined)
  )
}
