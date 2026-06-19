export interface ForgeGitHubExportDisplayRow {
  error?: string
  kind: 'github' | 'zip'
  repoUrl?: string
  status: 'completed' | 'failed' | 'running'
}

export function getForgeWorkflowStatusText({
  isExportingGitHub,
  isSubmitting,
  isValidating,
  latestRunStatus,
}: {
  isExportingGitHub: boolean
  isSubmitting: boolean
  isValidating: boolean
  latestRunStatus?: string
}) {
  if (isSubmitting) {
    return 'Run in progress'
  }

  if (isValidating) {
    return 'Validation in progress'
  }

  if (isExportingGitHub) {
    return 'GitHub export in progress'
  }

  if (!latestRunStatus) {
    return 'Ready'
  }

  return `Latest run ${latestRunStatus}`
}

export function getForgeRunSummaryTitle({
  changedFileCount,
  hasParentManifest,
  statusText,
}: {
  changedFileCount: number
  hasParentManifest: boolean
  statusText: string
}) {
  if (changedFileCount <= 0) {
    return statusText
  }

  const fileLabel = changedFileCount === 1 ? 'file' : 'files'
  const verb = hasParentManifest ? 'Edited' : 'Created'

  return `${verb} ${changedFileCount.toLocaleString()} ${fileLabel}`
}

export function getLatestForgeGitHubExport<
  TExport extends ForgeGitHubExportDisplayRow,
>(exports: Array<TExport>) {
  for (let index = exports.length - 1; index >= 0; index -= 1) {
    const exportRow = exports[index]

    if (exportRow.kind === 'github') {
      return exportRow
    }
  }

  return undefined
}

export function getForgeGitHubExportDisplayState<
  TExport extends ForgeGitHubExportDisplayRow,
>({
  latestGitHubExport,
  repoUrl,
}: {
  latestGitHubExport?: TExport
  repoUrl: string | null
}) {
  const completedGitHubExport =
    latestGitHubExport?.status === 'completed' ? latestGitHubExport : undefined

  return {
    latestGitHubExport,
    visibleError:
      latestGitHubExport?.status === 'failed'
        ? latestGitHubExport.error
        : undefined,
    visibleRepoUrl: repoUrl ?? completedGitHubExport?.repoUrl,
  }
}
