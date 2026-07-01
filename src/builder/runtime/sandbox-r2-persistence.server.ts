import { createHash } from 'node:crypto'
import type { SandboxFileEvent } from '@tanstack/ai'
import type { SandboxHandle, SandboxHooks } from '@tanstack/ai-sandbox'
import type { BlobStorage } from '~/server/runtime/blob-storage.server'
import {
  persistForgeCloudBlob,
  readForgeCloudBlob,
  readForgeCloudManifest,
} from './forge-cloud-store.server'
import { appendLocalForgeRuntimeEvent } from './local-store.server'

const FORGE_WORKSPACE_APP_DIR = '/workspace/app'
const FORGE_MANIFEST_MARKER_PATH = `${FORGE_WORKSPACE_APP_DIR}/.forge-manifest`
// Debounce window for mirroring a single file's edits to R2 — bursts of
// rapid writes to the same path within this window collapse into one
// persisted blob instead of one R2 write per keystroke-level event.
const FORGE_FILE_MIRROR_DEBOUNCE_MS = 500

export type ForgeSandboxPersistenceEnv = {
  FORGE_RUNTIME?: BlobStorage
}

/**
 * KEEP-layer R2 persistence hooks bridging forge's durable project state
 * (manifest + blobs in R2, written by `local-store.server.ts`'s
 * `persistLocalForgeManifestBundle`/`persistLocalForgeBlob`) to the
 * TanStack AI sandbox lifecycle. Spread the returned object into
 * `defineSandbox({ hooks })`.
 *
 * NOTE ON `projectId`: R2 manifests are addressed by `manifestVersionId`
 * (see `getForgeCloudManifestKey` in `forge-cloud-store.server.ts`), and
 * this repo does not yet have an R2-resident "current manifest version for
 * a project" pointer — that mapping lives in the `forgeChatSessions` DB
 * table (`currentManifestVersionId`), which is out of scope for this
 * Node-executable, DB-free module. `forgePersistenceHooks` therefore treats
 * `projectId` AS the current manifest's `manifestVersionId` to look up in
 * R2. Task 4.1 (the real `defineSandbox({ hooks })` call site, which has
 * DB access) must pass the project's *resolved current manifestVersionId*
 * as `projectId`, not the raw project row id.
 *
 * `onReady` is a marker-guarded materialize: it reads the sandbox's
 * `.forge-manifest` marker file and only re-writes the workspace when the
 * marker is missing or does not match the manifest's version id. A warm
 * sandbox with a matching marker performs zero filesystem writes.
 *
 * `onFile` mirrors sandbox file edits back to R2 (debounced per path,
 * using the `SandboxHandle` captured by the preceding `onReady` call to
 * read the changed file's live content) and appends a runtime
 * activity-feed event so the live feed reflects sandbox writes the same
 * way it reflects local-materializer writes.
 */
export function forgePersistenceHooks({
  env,
  projectId,
}: {
  projectId: string
  env: ForgeSandboxPersistenceEnv
}): Pick<SandboxHooks, 'onFile' | 'onReady'> {
  const storage = env.FORGE_RUNTIME
  const pendingMirrors = new Map<string, ReturnType<typeof setTimeout>>()
  let readyHandle: SandboxHandle | undefined

  return {
    async onReady(handle) {
      readyHandle = handle
      await materializeForgeWorkspace({ handle, projectId, storage })
    },
    onFile(event) {
      scheduleForgeFileMirror({
        event,
        getHandle: () => readyHandle,
        pendingMirrors,
        projectId,
        storage,
      })
    },
  }
}

async function materializeForgeWorkspace({
  handle,
  projectId,
  storage,
}: {
  handle: SandboxHandle
  projectId: string
  storage: BlobStorage | undefined
}) {
  const manifest = await readForgeCloudManifest({
    manifestVersionId: projectId,
    storage,
  })

  if (!manifest) {
    // No R2 manifest recorded for this project yet — nothing to
    // materialize. The sandbox starts from its provider-default workspace.
    return
  }

  const currentMarker = await readForgeManifestMarker(handle)

  if (currentMarker === manifest.manifestVersionId) {
    // Warm sandbox already matches the current R2 manifest — zero writes.
    return
  }

  for (const file of Object.values(manifest.files)) {
    const blob = await readForgeCloudBlob({ blobRef: file.blobRef, storage })

    if (!blob) {
      throw new Error(
        `Forge R2 manifest ${manifest.manifestVersionId} is missing blob ${file.blobRef} for ${file.path}.`,
      )
    }

    await handle.fs.write(
      `${FORGE_WORKSPACE_APP_DIR}/${file.path}`,
      blob.content,
    )
  }

  await handle.fs.write(FORGE_MANIFEST_MARKER_PATH, manifest.manifestVersionId)
}

async function readForgeManifestMarker(handle: SandboxHandle) {
  if (!(await handle.fs.exists(FORGE_MANIFEST_MARKER_PATH))) {
    return undefined
  }

  return (await handle.fs.read(FORGE_MANIFEST_MARKER_PATH)).trim()
}

function scheduleForgeFileMirror({
  event,
  getHandle,
  pendingMirrors,
  projectId,
  storage,
}: {
  event: SandboxFileEvent
  getHandle: () => SandboxHandle | undefined
  pendingMirrors: Map<string, ReturnType<typeof setTimeout>>
  projectId: string
  storage: BlobStorage | undefined
}) {
  const existingTimer = pendingMirrors.get(event.path)

  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    pendingMirrors.delete(event.path)
    void mirrorForgeFileEvent({
      event,
      handle: getHandle(),
      projectId,
      storage,
    }).catch((error: unknown) => {
      console.error('[forge-sandbox-r2-persistence] mirror failed', error)
    })
  }, FORGE_FILE_MIRROR_DEBOUNCE_MS)

  timer.unref?.()
  pendingMirrors.set(event.path, timer)
}

async function mirrorForgeFileEvent({
  event,
  handle,
  projectId,
  storage,
}: {
  event: SandboxFileEvent
  handle: SandboxHandle | undefined
  projectId: string
  storage: BlobStorage | undefined
}) {
  await appendLocalForgeRuntimeEvent({
    detail: event.path,
    message: `Sandbox file ${event.type}`,
    name: `workflow.sandbox.file.${event.type}`,
    path: event.path,
    producerId: 'forge-sandbox-r2-persistence',
    runId: projectId,
    status: 'finished',
  })

  if (!storage || !handle || event.type === 'delete') {
    // Deletions are reflected in the activity feed above only: tombstoning
    // a path out of the manifest happens through the normal
    // manifest-snapshot flow (`appendLocalForgeManifestTimeline`), not here.
    return
  }

  const relativePath = toForgeWorkspaceRelativePath(event.path)

  if (!relativePath) {
    return
  }

  const content = await handle.fs.read(event.path)

  await persistForgeCloudBlob({
    blob: buildForgeMirrorBlob({ content, path: relativePath }),
    scope: {
      projectId,
      sessionId: projectId,
    },
    storage,
  })
}

function toForgeWorkspaceRelativePath(absolutePath: string) {
  const prefix = `${FORGE_WORKSPACE_APP_DIR}/`

  if (!absolutePath.startsWith(prefix)) {
    return undefined
  }

  return absolutePath.slice(prefix.length)
}

function buildForgeMirrorBlob({
  content,
  path,
}: {
  content: string
  path: string
}) {
  const sha256 = sha256Hex(content)

  return {
    blobRef: `sha256:forge-sandbox-mirror/${path}/${sha256}`,
    content,
    contentType: 'text/plain',
    encoding: 'utf8' as const,
    kind: 'file' as const,
    sha256,
    size: content.length,
  }
}

function sha256Hex(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}
