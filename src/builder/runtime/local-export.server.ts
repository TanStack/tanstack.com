import JSZip from 'jszip'
import {
  decodeLocalBase64File,
  getLocalManifestFiles,
} from '~/builder/manifest'
import type { LocalBuilderTimelineEvent } from '~/builder/projection'
import type {
  BuilderLocalManifestBundle,
  BuilderManifest,
} from '~/builder/schema'
import {
  createRepository,
  generateRepoDescription,
  pushFiles,
  validateBranchName,
  validateRepoName,
} from '~/utils/github-repo.server'
import {
  appendLocalForgeRuntimeEvent,
  appendLocalForgeTimelineEvents,
  assertNoActiveLocalForgeRun,
  createLocalForgeProducer,
  getActiveLocalForgeSessionId,
  isActiveLocalForgeRunStatus,
  LOCAL_FORGE_PROJECT_ID,
  LOCAL_FORGE_WORKFLOW_LOCK_NAME,
  readLocalForgeBlob,
  readLocalForgeManifest,
  readLocalForgeSnapshot,
  readLocalForgeTimeline,
  withLocalForgeLock,
} from './local-store.server'

const LOCAL_FORGE_EXPORT_LOCK_STALE_MS = 10 * 60_000
const LOCAL_FORGE_GITHUB_EXPORT_LOCK_WAIT_MS = 100
const LOCAL_FORGE_WORKFLOW_EXPORT_LOCK_WAIT_MS = 100
const LOCAL_FORGE_ZIP_EXPORT_LOCK_WAIT_MS = 30_000

export interface LocalForgeZipExport {
  fileName: string
  manifestVersionId: string
  zip: ArrayBuffer
}

export interface LocalForgeGitHubExport {
  branch: string
  commitSha: string
  manifestVersionId: string
  owner: string
  repoName: string
  repoUrl: string
}

export interface LocalForgeGitHubClient {
  createRepository: typeof createRepository
  pushFiles: typeof pushFiles
}

export async function createLocalForgeZipArchive({
  manifestVersionId,
}: {
  manifestVersionId?: string
} = {}): Promise<LocalForgeZipExport> {
  const resolvedManifestVersionId = await resolveLocalForgeManifestVersionId({
    errorMessage: 'Forge has no manifest to download.',
    manifestVersionId,
  })
  const manifest = await readLocalForgeManifest(resolvedManifestVersionId)
  const zip = await createManifestZipArchive(manifest)

  return {
    fileName: `${toExportFolderName(manifest.app.name)}.zip`,
    manifestVersionId: manifest.manifestVersionId,
    zip,
  }
}

export async function createLocalForgeZipExport({
  manifestVersionId,
}: {
  manifestVersionId?: string
} = {}): Promise<LocalForgeZipExport> {
  const resolvedManifestVersionId = await resolveLocalForgeManifestVersionId({
    errorMessage: 'Forge has no manifest to download.',
    manifestVersionId,
  })

  return withLocalForgeLock({
    name: createLocalForgeExportLockName({
      kind: 'zip',
      manifestVersionId: resolvedManifestVersionId,
    }),
    staleMs: LOCAL_FORGE_EXPORT_LOCK_STALE_MS,
    task: () =>
      withLocalForgeWorkflowExportLock({
        action: 'export the local Forge workspace as a ZIP',
        task: () =>
          createLocalForgeZipExportLocked({
            manifestVersionId: resolvedManifestVersionId,
          }),
      }),
    waitMs: LOCAL_FORGE_ZIP_EXPORT_LOCK_WAIT_MS,
  })
}

async function createLocalForgeZipExportLocked({
  manifestVersionId,
}: {
  manifestVersionId: string
}): Promise<LocalForgeZipExport> {
  const manifest = await readLocalForgeManifest(manifestVersionId)
  const runId = `local-export-${crypto.randomUUID()}`
  const exportId = `local-export-${crypto.randomUUID()}`
  const folderName = toExportFolderName(manifest.app.name)
  const fileName = `${folderName}.zip`
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()

  await appendLocalForgeExportTimelineEvent({
    exportId,
    fileName,
    manifestVersionId: manifest.manifestVersionId,
    runId,
    startedAt,
    type: 'export.started',
  })

  await appendLocalForgeRuntimeEvent({
    detail: manifest.manifestVersionId,
    message: 'Export ZIP started',
    name: 'workflow.export.started',
    producerId: 'local-exporter',
    runId,
    startedAt: startedAtMs,
    status: 'running',
  })

  try {
    const zipBlob = await createManifestZipArchive(manifest)

    await appendLocalForgeExportTimelineEvent({
      byteLength: zipBlob.byteLength,
      exportId,
      fileName,
      manifestVersionId: manifest.manifestVersionId,
      runId,
      startedAt,
      type: 'export.completed',
    })

    await appendLocalForgeRuntimeEvent({
      detail: `${Object.keys(manifest.files).length} files from ${manifest.manifestVersionId}`,
      message: 'Export ZIP completed',
      name: 'workflow.export.completed',
      producerId: 'local-exporter',
      runId,
      startedAt: startedAtMs,
      status: 'finished',
    })

    return {
      fileName,
      manifestVersionId: manifest.manifestVersionId,
      zip: zipBlob,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Export failed'

    await appendLocalForgeExportTimelineEvent({
      error: errorMessage,
      exportId,
      fileName,
      manifestVersionId: manifest.manifestVersionId,
      runId,
      startedAt,
      type: 'export.failed',
    })

    await appendLocalForgeRuntimeEvent({
      detail: errorMessage,
      message: 'Export ZIP failed',
      name: 'workflow.export.failed',
      producerId: 'local-exporter',
      runId,
      startedAt: startedAtMs,
      status: 'failed',
    })

    throw error
  }
}

export async function createLocalForgeGitHubExport({
  accessToken,
  branch = 'main',
  github = {
    createRepository,
    pushFiles,
  },
  isPrivate,
  manifestVersionId,
  repoName,
}: {
  accessToken: string
  branch?: string
  github?: LocalForgeGitHubClient
  isPrivate: boolean
  manifestVersionId?: string
  repoName: string
}): Promise<LocalForgeGitHubExport> {
  const validation = validateRepoName(repoName)

  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid repository name')
  }

  const branchValidation = validateBranchName(branch)

  if (!branchValidation.valid) {
    throw new Error(branchValidation.error ?? 'Invalid branch name')
  }

  const resolvedManifestVersionId = await resolveLocalForgeManifestVersionId({
    errorMessage: 'Forge has no manifest to export.',
    manifestVersionId,
  })

  try {
    return await withLocalForgeLock({
      name: createLocalForgeExportLockName({
        kind: 'github',
        manifestVersionId: resolvedManifestVersionId,
      }),
      staleMs: LOCAL_FORGE_EXPORT_LOCK_STALE_MS,
      task: () =>
        withLocalForgeWorkflowExportLock({
          action: 'export the local Forge workspace to GitHub',
          task: () =>
            createLocalForgeGitHubExportLocked({
              accessToken,
              branch,
              github,
              isPrivate,
              manifestVersionId: resolvedManifestVersionId,
              repoName,
            }),
        }),
      waitMs: LOCAL_FORGE_GITHUB_EXPORT_LOCK_WAIT_MS,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('export-github-')) {
      throw new Error(
        `A local Forge GitHub export is already active for ${resolvedManifestVersionId}.`,
      )
    }

    throw error
  }
}

async function createLocalForgeGitHubExportLocked({
  accessToken,
  branch,
  github,
  isPrivate,
  manifestVersionId,
  repoName,
}: {
  accessToken: string
  branch: string
  github: LocalForgeGitHubClient
  isPrivate: boolean
  manifestVersionId: string
  repoName: string
}): Promise<LocalForgeGitHubExport> {
  const manifest = await readLocalForgeManifest(manifestVersionId)
  const runId = `local-export-${crypto.randomUUID()}`
  const exportId = `local-export-${crypto.randomUUID()}`
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const visibility = isPrivate ? 'private' : 'public'

  await appendLocalForgeExportTimelineEvent({
    branch,
    exportId,
    kind: 'github',
    manifestVersionId: manifest.manifestVersionId,
    repoName,
    runId,
    startedAt,
    type: 'export.started',
    visibility,
  })

  await appendLocalForgeRuntimeEvent({
    detail: `${repoName} from ${manifest.manifestVersionId}`,
    message: 'GitHub export started',
    name: 'workflow.export.github.started',
    producerId: 'local-exporter',
    runId,
    startedAt: startedAtMs,
    status: 'running',
  })

  try {
    const files = await readLocalForgeManifestFiles(manifest)
    const createResult = await github.createRepository(accessToken, {
      description: generateRepoDescription(manifest.source.selectedFeatures),
      isPrivate,
      name: repoName,
    })

    if (!createResult.success) {
      throw new Error(createResult.error)
    }

    const pushResult = await github.pushFiles(accessToken, {
      branch,
      files,
      message: createGitHubExportCommitMessage(manifest),
      owner: createResult.owner,
      repo: createResult.name,
    })

    if (!pushResult.success) {
      throw new Error(
        `Repository created but failed to push files: ${pushResult.error}`,
      )
    }

    await appendLocalForgeExportTimelineEvent({
      branch,
      commitSha: pushResult.commitSha,
      exportId,
      kind: 'github',
      manifestVersionId: manifest.manifestVersionId,
      repoName: createResult.name,
      repoOwner: createResult.owner,
      repoUrl: createResult.repoUrl,
      runId,
      startedAt,
      type: 'export.completed',
      visibility,
    })

    await appendLocalForgeRuntimeEvent({
      detail: `${createResult.repoUrl} at ${pushResult.commitSha}`,
      message: 'GitHub export completed',
      name: 'workflow.export.github.completed',
      producerId: 'local-exporter',
      runId,
      startedAt: startedAtMs,
      status: 'finished',
    })

    return {
      branch,
      commitSha: pushResult.commitSha,
      manifestVersionId: manifest.manifestVersionId,
      owner: createResult.owner,
      repoName: createResult.name,
      repoUrl: createResult.repoUrl,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'GitHub export failed'

    await appendLocalForgeExportTimelineEvent({
      branch,
      error: errorMessage,
      exportId,
      kind: 'github',
      manifestVersionId: manifest.manifestVersionId,
      repoName,
      runId,
      startedAt,
      type: 'export.failed',
      visibility,
    })

    await appendLocalForgeRuntimeEvent({
      detail: errorMessage,
      message: 'GitHub export failed',
      name: 'workflow.export.github.failed',
      producerId: 'local-exporter',
      runId,
      startedAt: startedAtMs,
      status: 'failed',
    })

    throw error
  }
}

async function withLocalForgeWorkflowExportLock<T>({
  action,
  task,
}: {
  action: string
  task: () => Promise<T>
}) {
  try {
    return await withLocalForgeLock({
      name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
      staleMs: LOCAL_FORGE_EXPORT_LOCK_STALE_MS,
      task: async () => {
        await assertNoActiveLocalForgeRun(action)
        return task()
      },
      waitMs: LOCAL_FORGE_WORKFLOW_EXPORT_LOCK_WAIT_MS,
    })
  } catch (error) {
    if (!isLocalForgeWorkflowLockError(error)) {
      throw error
    }

    const snapshot = await readLocalForgeSnapshot()
    const latestRun = snapshot.latestRun

    if (latestRun && isActiveLocalForgeRunStatus(latestRun.status)) {
      throw new Error(
        `Cannot ${action} while Forge run ${latestRun.id} is ${latestRun.status}.`,
      )
    }

    throw new Error(`Cannot ${action} while another Forge workflow is active.`)
  }
}

function isLocalForgeWorkflowLockError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(`${LOCAL_FORGE_WORKFLOW_LOCK_NAME}.lock`)
  )
}

type LocalForgeExportTimelineEventInput =
  | {
      branch?: string
      exportId: string
      fileName: string
      kind?: 'zip'
      manifestVersionId: string
      runId: string
      startedAt: string
      type: 'export.started'
    }
  | {
      branch: string
      exportId: string
      kind: 'github'
      manifestVersionId: string
      repoName: string
      runId: string
      startedAt: string
      type: 'export.started'
      visibility: 'private' | 'public'
    }
  | {
      byteLength: number
      exportId: string
      fileName: string
      kind?: 'zip'
      manifestVersionId: string
      runId: string
      startedAt: string
      type: 'export.completed'
    }
  | {
      branch: string
      commitSha: string
      exportId: string
      kind: 'github'
      manifestVersionId: string
      repoName: string
      repoOwner: string
      repoUrl: string
      runId: string
      startedAt: string
      type: 'export.completed'
      visibility: 'private' | 'public'
    }
  | {
      branch?: string
      error: string
      exportId: string
      fileName?: string
      kind?: 'zip' | 'github'
      manifestVersionId: string
      repoName?: string
      runId: string
      startedAt: string
      type: 'export.failed'
      visibility?: 'private' | 'public'
    }

async function appendLocalForgeExportTimelineEvent(
  input: LocalForgeExportTimelineEventInput,
) {
  const existing = await readLocalForgeTimeline()
  const createdAt =
    input.type === 'export.started' ? input.startedAt : new Date().toISOString()

  switch (input.type) {
    case 'export.started': {
      const payload =
        input.kind === 'github'
          ? {
              branch: input.branch,
              exportId: input.exportId,
              kind: input.kind,
              manifestVersionId: input.manifestVersionId,
              repoName: input.repoName,
              runId: input.runId,
              startedAt: input.startedAt,
              visibility: input.visibility,
            }
          : {
              branch: input.branch,
              exportId: input.exportId,
              fileName: input.fileName,
              kind: input.kind ?? 'zip',
              manifestVersionId: input.manifestVersionId,
              runId: input.runId,
              startedAt: input.startedAt,
            }
      const event: LocalBuilderTimelineEvent = {
        createdAt,
        eventId: `local-export-event-${crypto.randomUUID()}`,
        projectId: LOCAL_FORGE_PROJECT_ID,
        producer: createLocalForgeProducer({
          index: existing.length,
          kind: 'system',
          producerId: 'local-exporter',
        }),
        runId: input.runId,
        schemaVersion: 1,
        sessionId: getActiveLocalForgeSessionId(),
        type: 'export.started',
        payload,
      }

      await appendLocalForgeTimelineEvents([event])
      break
    }

    case 'export.completed': {
      const payload =
        input.kind === 'github'
          ? {
              branch: input.branch,
              commitSha: input.commitSha,
              exportId: input.exportId,
              kind: input.kind,
              manifestVersionId: input.manifestVersionId,
              repoName: input.repoName,
              repoOwner: input.repoOwner,
              repoUrl: input.repoUrl,
              runId: input.runId,
              startedAt: input.startedAt,
              visibility: input.visibility,
            }
          : {
              byteLength: input.byteLength,
              exportId: input.exportId,
              fileName: input.fileName,
              kind: input.kind ?? 'zip',
              manifestVersionId: input.manifestVersionId,
              runId: input.runId,
              startedAt: input.startedAt,
            }
      const event: LocalBuilderTimelineEvent = {
        createdAt,
        eventId: `local-export-event-${crypto.randomUUID()}`,
        projectId: LOCAL_FORGE_PROJECT_ID,
        producer: createLocalForgeProducer({
          index: existing.length,
          kind: 'system',
          producerId: 'local-exporter',
        }),
        runId: input.runId,
        schemaVersion: 1,
        sessionId: getActiveLocalForgeSessionId(),
        type: 'export.completed',
        payload,
      }

      await appendLocalForgeTimelineEvents([event])
      break
    }

    case 'export.failed': {
      const event: LocalBuilderTimelineEvent = {
        createdAt,
        eventId: `local-export-event-${crypto.randomUUID()}`,
        projectId: LOCAL_FORGE_PROJECT_ID,
        producer: createLocalForgeProducer({
          index: existing.length,
          kind: 'system',
          producerId: 'local-exporter',
        }),
        runId: input.runId,
        schemaVersion: 1,
        sessionId: getActiveLocalForgeSessionId(),
        type: 'export.failed',
        payload: {
          branch: input.branch,
          error: input.error,
          exportId: input.exportId,
          fileName: input.fileName,
          kind: input.kind ?? 'zip',
          manifestVersionId: input.manifestVersionId,
          repoName: input.repoName,
          runId: input.runId,
          startedAt: input.startedAt,
          visibility: input.visibility,
        },
      }

      await appendLocalForgeTimelineEvents([event])
      break
    }
  }
}

async function readLocalForgeManifestFiles(manifest: BuilderManifest) {
  const bundle: BuilderLocalManifestBundle = {
    blobs: {},
    manifest,
  }

  for (const file of Object.values(manifest.files)) {
    assertSafeManifestExportPath(file.path)
    const blob = await readLocalForgeBlob(file.blobRef)
    bundle.blobs[blob.blobRef] = blob
  }

  return getLocalManifestFiles(bundle)
}

async function createManifestZipArchive(manifest: BuilderManifest) {
  const zip = new JSZip()
  const rootFolder = zip.folder(toExportFolderName(manifest.app.name))

  if (!rootFolder) {
    throw new Error('Failed to create Forge ZIP folder.')
  }

  for (const file of Object.values(manifest.files)) {
    assertSafeManifestExportPath(file.path)
    const blob = await readLocalForgeBlob(file.blobRef)
    const binaryContent = decodeLocalBase64File(blob.content)

    if (binaryContent) {
      rootFolder.file(file.path, binaryContent, { binary: true })
    } else {
      rootFolder.file(file.path, blob.content)
    }
  }

  return zip.generateAsync({ type: 'arraybuffer' })
}

export function assertSafeManifestExportPath(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    filePath.startsWith('/') ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${filePath} is not a safe manifest export path.`)
  }
}

async function resolveLocalForgeManifestVersionId({
  errorMessage,
  manifestVersionId,
}: {
  errorMessage: string
  manifestVersionId?: string
}) {
  if (manifestVersionId) {
    return manifestVersionId
  }

  const snapshot = await readLocalForgeSnapshot()

  if (!snapshot.manifestVersionId) {
    throw new Error(errorMessage)
  }

  return snapshot.manifestVersionId
}

function createLocalForgeExportLockName({
  kind,
  manifestVersionId,
}: {
  kind: 'github' | 'zip'
  manifestVersionId: string
}) {
  return `export-${kind}-${Buffer.from(manifestVersionId).toString('base64url')}`
}

function createGitHubExportCommitMessage(manifest: BuilderManifest) {
  return [
    `Export ${manifest.app.name} from TanStack Forge`,
    '',
    `Project: ${manifest.projectId ?? LOCAL_FORGE_PROJECT_ID}`,
    `Session: ${manifest.sessionId ?? getActiveLocalForgeSessionId()}`,
    `Manifest: ${manifest.manifestVersionId}`,
  ].join('\n')
}

function toExportFolderName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'forge-app'
}
