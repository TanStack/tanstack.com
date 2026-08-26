import type { BuilderProjectSyncProject } from './builder-project-sync'

type BuilderProjectRevisionHead = Pick<
  BuilderProjectSyncProject,
  'currentRevisionId' | 'currentRevisionNumber' | 'snapshotHash'
>

export async function settleBuilderProjectRevisionHydration<
  TSnapshot,
  TResult,
>({
  commit,
  getLocalVersion,
  getSyncedProject,
  isActive,
  loadSnapshot,
  onLocalChange,
  project,
}: {
  commit: (input: {
    project: BuilderProjectSyncProject
    snapshot: TSnapshot
  }) => TResult
  getLocalVersion: () => number
  getSyncedProject: () => BuilderProjectSyncProject | undefined
  isActive: () => boolean
  loadSnapshot: (project: BuilderProjectSyncProject) => Promise<TSnapshot>
  onLocalChange: () => void
  project: BuilderProjectSyncProject
}): Promise<TResult | undefined> {
  const localVersion = getLocalVersion()
  const snapshot = await loadSnapshot(project)
  if (!isActive()) return undefined

  const latestProject = getSyncedProject()
  if (!latestProject) {
    throw new Error('Builder project sync state is unavailable.')
  }
  if (getLocalVersion() !== localVersion) {
    onLocalChange()
    return undefined
  }
  if (!isSameRevisionHead(project, latestProject)) return undefined

  return commit({ project: latestProject, snapshot })
}

export async function settleBuilderProjectBootstrap<
  TSnapshot,
  TWorkingCopy,
  TResult,
>({
  commit,
  getLocalVersion,
  getSyncedProject,
  isActive,
  loadSnapshot,
  reconcileWorkingCopy,
}: {
  commit: (input: {
    project: BuilderProjectSyncProject
    snapshot: TSnapshot
    workingCopy: TWorkingCopy
  }) => TResult
  getLocalVersion: () => number
  getSyncedProject: () => BuilderProjectSyncProject | undefined
  isActive: () => boolean
  loadSnapshot: (project: BuilderProjectSyncProject) => Promise<TSnapshot>
  reconcileWorkingCopy: (
    project: BuilderProjectSyncProject,
  ) => Promise<TWorkingCopy>
}): Promise<TResult | undefined> {
  while (isActive()) {
    const project = getSyncedProject()
    if (!project) {
      throw new Error('Builder project sync state is unavailable.')
    }
    const localVersion = getLocalVersion()
    const snapshot = await loadSnapshot(project)
    if (!isActive()) return undefined
    const workingCopy = await reconcileWorkingCopy(project)
    if (!isActive()) return undefined

    const latestProject = getSyncedProject()
    if (!latestProject) {
      throw new Error('Builder project sync state is unavailable.')
    }
    if (
      getLocalVersion() !== localVersion ||
      !isSameRevisionHead(project, latestProject)
    ) {
      continue
    }

    return commit({
      project: latestProject,
      snapshot,
      workingCopy,
    })
  }

  return undefined
}

function isSameRevisionHead(
  left: BuilderProjectRevisionHead,
  right: BuilderProjectRevisionHead,
) {
  return (
    left.currentRevisionId === right.currentRevisionId &&
    left.currentRevisionNumber === right.currentRevisionNumber &&
    left.snapshotHash === right.snapshotHash
  )
}
