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
const FORGE_MANIFEST_MARKER_NAME = '.forge-manifest'
// Directory names never scanned back out of the sandbox workspace: build
// output, VCS metadata, and installed dependencies are not part of the
// forge manifest and would balloon (or corrupt) the persisted file set.
const FORGE_WORKSPACE_COLLECT_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.tanstack',
  'dist',
  'node_modules',
])
const FORGE_WORKSPACE_EVENT_IGNORED_DIRECTORIES = new Set([
  ...FORGE_WORKSPACE_COLLECT_IGNORED_DIRECTORIES,
])
const FORGE_WORKSPACE_COLLECT_IGNORED_FILES = new Set([
  '.cta.json',
  '.forge-manifest',
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])
// Debounce window for mirroring a single file's edits to R2 — bursts of
// rapid writes to the same path within this window collapse into one
// persisted blob instead of one R2 write per keystroke-level event.
const FORGE_FILE_MIRROR_DEBOUNCE_MS = 500

type ForgeCloudManifest = NonNullable<
  Awaited<ReturnType<typeof readForgeCloudManifest>>
>

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
 * NOTE ON `manifestVersionId`: R2 manifests are addressed by
 * `manifestVersionId` (see `getForgeCloudManifestKey` in
 * `forge-cloud-store.server.ts`), and this repo does not yet have an
 * R2-resident "current manifest version for a project" pointer — that
 * mapping lives in the `forgeChatSessions` DB table
 * (`currentManifestVersionId`), which is out of scope for this
 * Node-executable, DB-free module. `manifestVersionId` is therefore used
 * verbatim as the R2 manifest/blob lookup key. The real
 * `defineSandbox({ hooks })` call site (which has DB access) must pass the
 * project's *resolved current manifestVersionId*, not the raw project id.
 *
 * NOTE ON `runId`: activity-feed events are keyed by the live run's
 * `runId` (matching how the rest of the run's events are recorded), NOT by
 * `manifestVersionId`. Keep these two distinct — `manifestVersionId` is a
 * durable R2 storage key, `runId` is the ephemeral run identity the feed
 * groups events under.
 *
 * `onReady` is a marker-guarded materialize: it reads the sandbox's
 * `.forge-manifest` marker file and only re-writes the workspace when the
 * marker is missing or does not match the manifest's version id. A warm
 * sandbox with a matching marker performs zero filesystem writes (but stale
 * files absent from the manifest are still pruned).
 *
 * `onFile` mirrors sandbox file edits back to R2 (debounced per path,
 * using the `SandboxHandle` captured by the preceding `onReady` call to
 * read the changed file's live content) and appends a runtime
 * activity-feed event so the live feed reflects sandbox writes the same
 * way it reflects local-materializer writes. Because the debounce is
 * asynchronous, callers MUST `await flush()` after the stream loop so the
 * final edits' mirror writes + activity events are not dropped when the
 * Worker isolate tears down.
 */
export function forgePersistenceHooks({
  env,
  manifestVersionId,
  materializeMode = 'if-stale',
  runId,
  startedAt,
}: {
  /** Durable R2 manifest/blob lookup key. */
  manifestVersionId: string
  materializeMode?: 'if-missing' | 'if-stale'
  /** Live run identity activity-feed events are grouped under. */
  runId: string
  startedAt?: number
  env: ForgeSandboxPersistenceEnv
}): Pick<SandboxHooks, 'onFile' | 'onReady'> & {
  collectWorkspaceChanges: () => {
    deletedPaths: Array<string>
    files: Record<string, string>
  }
  collectWorkspaceFiles: () => Promise<Record<string, string>>
  flush: () => Promise<void>
} {
  const storage = env.FORGE_RUNTIME
  const pendingMirrors = new Map<string, ReturnType<typeof setTimeout>>()
  // The latest debounced event per path, so `flush()` can fire the pending
  // mirror with the correct event when it cancels the timer early.
  const pendingMirrorEvents = new Map<string, SandboxFileEvent>()
  // Every in-flight mirror settles into this set so `flush()` can await all
  // of them; a completed mirror removes itself.
  const inFlightMirrors = new Set<Promise<void>>()
  const changedFiles = new Map<string, string>()
  const deletedPaths = new Set<string>()
  let readyHandle: SandboxHandle | undefined
  let recordedFirstFileEvent = false

  return {
    collectWorkspaceChanges() {
      return {
        deletedPaths: Array.from(deletedPaths).sort((left, right) =>
          left.localeCompare(right),
        ),
        files: Object.fromEntries(
          Array.from(changedFiles).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      }
    },
    async collectWorkspaceFiles() {
      if (!readyHandle) {
        // `onReady` never fired (e.g. the run failed before the sandbox
        // became ready), so there is no live handle to read the final tree
        // from. Return nothing rather than fabricating a workspace.
        return {}
      }

      return collectForgeWorkspaceFiles(readyHandle)
    },
    async flush() {
      // Fire every still-pending debounced mirror immediately, then await all
      // in-flight mirror promises so no final edit's R2 write / activity event
      // is dropped when the isolate tears down.
      for (const [path, timer] of pendingMirrors) {
        clearTimeout(timer)
        pendingMirrors.delete(path)
        const event = pendingMirrorEvents.get(path)
        pendingMirrorEvents.delete(path)

        if (!event) {
          continue
        }

        runForgeFileMirror({
          changedFiles,
          deletedPaths,
          event,
          getHandle: () => readyHandle,
          inFlightMirrors,
          manifestVersionId,
          runId,
          storage,
        })
      }

      // Await a settled snapshot; mirrors do not schedule further mirrors, so
      // the set cannot grow while we drain it.
      await Promise.allSettled(Array.from(inFlightMirrors))
    },
    async onReady(handle) {
      readyHandle = handle
      const materializeStartedAt = Date.now()
      const result = await materializeForgeWorkspace({
        handle,
        manifestVersionId,
        mode: materializeMode,
        storage,
      })

      await appendLocalForgeRuntimeEvent({
        detail: `${result.status}; ${result.filesWritten} files written`,
        message: 'Sandbox materialize phase finished',
        name: 'workflow.phase.materialize.finished',
        producerId: 'forge-sandbox-r2-persistence',
        runId,
        startedAt: materializeStartedAt,
        status: 'finished',
      })
    },
    onFile(event) {
      if (
        !recordedFirstFileEvent &&
        !isIgnoredForgeWorkspaceFileEvent(event.path)
      ) {
        recordedFirstFileEvent = true
        void appendLocalForgeRuntimeEvent({
          detail: event.path,
          message: 'First sandbox file activity observed',
          name: 'workflow.phase.first-file-write.finished',
          path: event.path,
          producerId: 'forge-sandbox-r2-persistence',
          runId,
          startedAt,
          status: 'finished',
        }).catch((error: unknown) => {
          console.error(
            '[forge-sandbox-r2-persistence] first file timing failed',
            error,
          )
        })
      }

      scheduleForgeFileMirror({
        changedFiles,
        deletedPaths,
        event,
        getHandle: () => readyHandle,
        inFlightMirrors,
        manifestVersionId,
        pendingMirrorEvents,
        pendingMirrors,
        runId,
        storage,
      })
    },
  }
}

/**
 * Walk the sandbox's `/workspace/app` tree via `handle.fs.list`/`handle.fs.read`
 * and return `{ [relativePath]: content }` for every file, ignoring build
 * output (`dist`), VCS metadata (`.git`), installed dependencies
 * (`node_modules`), and the `.forge-manifest` marker. Relative paths are keyed
 * off `/workspace/app` so they match the manifest's workspace-relative paths.
 */
async function collectForgeWorkspaceFiles(
  handle: SandboxHandle,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  try {
    await walkForgeWorkspaceDir({
      absoluteDir: FORGE_WORKSPACE_APP_DIR,
      depth: 0,
      files,
      handle,
      relativeDir: '',
      visited: new Set<string>(),
    })
  } catch (error) {
    // On abort/timeout/error, `withSandbox` may have already destroyed the
    // sandbox, so `handle.fs.list`/`handle.fs.read` can reject. Mirror the
    // `!readyHandle` guard and yield nothing rather than surfacing an
    // unhandled rejection out of the run.
    console.debug(
      '[forge-sandbox-r2-persistence] collectWorkspaceFiles failed; returning {} (sandbox likely destroyed)',
      error,
    )
    return {}
  }

  return files
}

// Hard cap on recursion depth so a symlink loop reported as a `dir` cannot
// recurse/hang forever even if per-path visited tracking is somehow defeated.
const FORGE_WORKSPACE_WALK_MAX_DEPTH = 32

async function walkForgeWorkspaceDir({
  absoluteDir,
  depth,
  files,
  handle,
  relativeDir,
  visited,
}: {
  absoluteDir: string
  depth: number
  files: Record<string, string>
  handle: SandboxHandle
  relativeDir: string
  visited: Set<string>
}) {
  if (depth > FORGE_WORKSPACE_WALK_MAX_DEPTH || visited.has(absoluteDir)) {
    // Depth cap or a symlink cycle (a `dir` entry pointing back at an
    // already-visited absolute path) — stop descending.
    return
  }

  visited.add(absoluteDir)

  const entries = await handle.fs.list(absoluteDir)

  for (const entry of entries) {
    const relativePath = relativeDir
      ? `${relativeDir}/${entry.name}`
      : entry.name

    if (entry.type === 'dir') {
      if (FORGE_WORKSPACE_COLLECT_IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }

      await walkForgeWorkspaceDir({
        absoluteDir: `${absoluteDir}/${entry.name}`,
        depth: depth + 1,
        files,
        handle,
        relativeDir: relativePath,
        visited,
      })

      continue
    }

    if (FORGE_WORKSPACE_COLLECT_IGNORED_FILES.has(entry.name)) {
      // Sandbox/package-manager bookkeeping, not app source.
      continue
    }

    files[relativePath] = await handle.fs.read(`${absoluteDir}/${entry.name}`)
  }
}

async function materializeForgeWorkspace({
  handle,
  manifestVersionId,
  mode,
  storage,
}: {
  handle: SandboxHandle
  manifestVersionId: string
  mode: 'if-missing' | 'if-stale'
  storage: BlobStorage | undefined
}): Promise<{
  filesWritten: number
  status:
    | 'missing-cloud-manifest'
    | 'skipped-existing-workspace'
    | 'skipped-matching-marker'
    | 'updated-stale-marker'
    | 'wrote-manifest'
}> {
  if (
    mode === 'if-missing' &&
    (await forgeWorkspaceAppearsInitialized(handle))
  ) {
    return {
      filesWritten: 0,
      status: 'skipped-existing-workspace',
    }
  }

  const manifest = await readForgeCloudManifest({
    manifestVersionId,
    storage,
  })

  if (!manifest) {
    // No R2 manifest recorded for this project yet — nothing to
    // materialize. The sandbox starts from its provider-default workspace.
    return {
      filesWritten: 0,
      status: 'missing-cloud-manifest',
    }
  }

  const currentMarker = await readForgeManifestMarker(handle)

  if (currentMarker === manifest.manifestVersionId) {
    // Warm sandbox already matches the current R2 manifest — zero writes.
    return {
      filesWritten: 0,
      status: 'skipped-matching-marker',
    }
  }

  // Stale/mismatched (or cold) sandbox: reconcile `/workspace/app` to exactly
  // the manifest's file set. On a WARM sandbox, files that existed in a prior
  // manifest but are absent from this one must be removed first — otherwise
  // `collectWorkspaceFiles` would scan them back and resurrect deleted files.
  const manifestFileContents = await readForgeManifestFileContents({
    manifest,
    storage,
  })
  const currentFiles = await collectForgeWorkspaceFiles(handle)

  if (
    forgeWorkspaceFilesMatchManifest({
      currentFiles,
      manifestFiles: manifestFileContents,
    })
  ) {
    await handle.fs.write(
      FORGE_MANIFEST_MARKER_PATH,
      manifest.manifestVersionId,
    )

    return {
      filesWritten: 0,
      status: 'updated-stale-marker',
    }
  }

  const manifestPaths = new Set(Object.keys(manifestFileContents))

  await pruneStaleForgeWorkspaceFiles({ handle, manifestPaths })

  let filesWritten = 0

  for (const [filePath, content] of Object.entries(manifestFileContents)) {
    await handle.fs.write(`${FORGE_WORKSPACE_APP_DIR}/${filePath}`, content)
    filesWritten += 1
  }

  await handle.fs.write(FORGE_MANIFEST_MARKER_PATH, manifest.manifestVersionId)

  return {
    filesWritten,
    status: 'wrote-manifest',
  }
}

async function readForgeManifestFileContents({
  manifest,
  storage,
}: {
  manifest: ForgeCloudManifest
  storage: BlobStorage | undefined
}) {
  const files: Record<string, string> = {}

  for (const file of Object.values(manifest.files)) {
    const blob = await readForgeCloudBlob({ blobRef: file.blobRef, storage })

    if (!blob) {
      throw new Error(
        `Forge R2 manifest ${manifest.manifestVersionId} is missing blob ${file.blobRef} for ${file.path}.`,
      )
    }

    files[file.path] = blob.content
  }

  return files
}

function forgeWorkspaceFilesMatchManifest({
  currentFiles,
  manifestFiles,
}: {
  currentFiles: Record<string, string>
  manifestFiles: Record<string, string>
}) {
  const currentPaths = Object.keys(currentFiles).sort((left, right) =>
    left.localeCompare(right),
  )
  const manifestPaths = Object.keys(manifestFiles).sort((left, right) =>
    left.localeCompare(right),
  )

  if (currentPaths.length !== manifestPaths.length) {
    return false
  }

  for (let index = 0; index < manifestPaths.length; index++) {
    const path = manifestPaths[index]
    const currentPath = currentPaths[index]

    if (path !== currentPath || currentFiles[path] !== manifestFiles[path]) {
      return false
    }
  }

  return true
}

async function forgeWorkspaceAppearsInitialized(handle: SandboxHandle) {
  return handle.fs
    .exists(`${FORGE_WORKSPACE_APP_DIR}/package.json`)
    .catch(() => false)
}

/**
 * Delete every tracked source file currently on disk under
 * `/workspace/app` that is NOT in `manifestPaths`, ignoring the same
 * directories `collectWorkspaceFiles` ignores (`node_modules`/`.git`/`dist`)
 * and the `.forge-manifest` marker. Keeps a warm sandbox from resurrecting
 * files the current manifest deleted. A cold (empty) workspace lists nothing,
 * so this is a safe no-op there.
 */
async function pruneStaleForgeWorkspaceFiles({
  handle,
  manifestPaths,
}: {
  handle: SandboxHandle
  manifestPaths: Set<string>
}) {
  const onDisk: Record<string, string> = {}

  try {
    await walkForgeWorkspaceDir({
      absoluteDir: FORGE_WORKSPACE_APP_DIR,
      depth: 0,
      files: onDisk,
      handle,
      relativeDir: '',
      visited: new Set<string>(),
    })
  } catch (error) {
    // A fresh/cold sandbox may not have `/workspace/app` yet, so listing can
    // reject — there is nothing stale to prune in that case.
    console.debug(
      '[forge-sandbox-r2-persistence] prune scan skipped (workspace not listable yet)',
      error,
    )
    return
  }

  for (const relativePath of Object.keys(onDisk)) {
    if (manifestPaths.has(relativePath)) {
      continue
    }

    await handle.fs.remove(`${FORGE_WORKSPACE_APP_DIR}/${relativePath}`)
  }
}

async function readForgeManifestMarker(handle: SandboxHandle) {
  if (!(await handle.fs.exists(FORGE_MANIFEST_MARKER_PATH))) {
    return undefined
  }

  return (await handle.fs.read(FORGE_MANIFEST_MARKER_PATH)).trim()
}

function scheduleForgeFileMirror({
  changedFiles,
  deletedPaths,
  event,
  getHandle,
  inFlightMirrors,
  manifestVersionId,
  pendingMirrorEvents,
  pendingMirrors,
  runId,
  storage,
}: {
  changedFiles: Map<string, string>
  deletedPaths: Set<string>
  event: SandboxFileEvent
  getHandle: () => SandboxHandle | undefined
  inFlightMirrors: Set<Promise<void>>
  manifestVersionId: string
  pendingMirrorEvents: Map<string, SandboxFileEvent>
  pendingMirrors: Map<string, ReturnType<typeof setTimeout>>
  runId: string
  storage: BlobStorage | undefined
}) {
  if (isIgnoredForgeWorkspaceFileEvent(event.path)) {
    return
  }

  const existingTimer = pendingMirrors.get(event.path)

  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  pendingMirrorEvents.set(event.path, event)

  const timer = setTimeout(() => {
    pendingMirrors.delete(event.path)
    pendingMirrorEvents.delete(event.path)
    runForgeFileMirror({
      changedFiles,
      deletedPaths,
      event,
      getHandle,
      inFlightMirrors,
      manifestVersionId,
      runId,
      storage,
    })
  }, FORGE_FILE_MIRROR_DEBOUNCE_MS)

  // Deliberately NOT unref'd: the run's `flush()` awaits every mirror, so we
  // want the timer/promise to keep the mirror alive until it settles.
  pendingMirrors.set(event.path, timer)
}

/**
 * Kick off one mirror and register its settling promise in `inFlightMirrors`
 * so `flush()` can await it. The promise never rejects (errors are logged),
 * and it removes itself from the set once settled.
 */
function runForgeFileMirror({
  changedFiles,
  deletedPaths,
  event,
  getHandle,
  inFlightMirrors,
  manifestVersionId,
  runId,
  storage,
}: {
  changedFiles: Map<string, string>
  deletedPaths: Set<string>
  event: SandboxFileEvent
  getHandle: () => SandboxHandle | undefined
  inFlightMirrors: Set<Promise<void>>
  manifestVersionId: string
  runId: string
  storage: BlobStorage | undefined
}) {
  const promise = mirrorForgeFileEvent({
    changedFiles,
    deletedPaths,
    event,
    handle: getHandle(),
    manifestVersionId,
    runId,
    storage,
  })
    .catch((error: unknown) => {
      console.error('[forge-sandbox-r2-persistence] mirror failed', error)
    })
    .finally(() => {
      inFlightMirrors.delete(promise)
    })

  inFlightMirrors.add(promise)
}

async function mirrorForgeFileEvent({
  changedFiles,
  deletedPaths,
  event,
  handle,
  manifestVersionId,
  runId,
  storage,
}: {
  changedFiles: Map<string, string>
  deletedPaths: Set<string>
  event: SandboxFileEvent
  handle: SandboxHandle | undefined
  manifestVersionId: string
  runId: string
  storage: BlobStorage | undefined
}) {
  if (isIgnoredForgeWorkspaceFileEvent(event.path)) {
    return
  }

  await appendLocalForgeRuntimeEvent({
    detail: event.path,
    message: `Sandbox file ${event.type}`,
    name: `workflow.sandbox.file.${event.type}`,
    path: event.path,
    producerId: 'forge-sandbox-r2-persistence',
    runId,
    status: 'finished',
  })

  if (!storage || !handle || event.type === 'delete') {
    const relativePath = toForgeWorkspaceRelativePath(event.path)

    if (relativePath && event.type === 'delete') {
      changedFiles.delete(relativePath)
      deletedPaths.add(relativePath)
    }

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
  changedFiles.set(relativePath, content)
  deletedPaths.delete(relativePath)

  await persistForgeCloudBlob({
    // The blob key is content-addressed (`buildForgeMirrorBlob`); this scope
    // only stamps metadata onto the stored blob. Key it by the durable
    // manifest identity, matching the R2 manifest/blob lookup surface — NOT by
    // the ephemeral run id.
    blob: buildForgeMirrorBlob({ content, path: relativePath }),
    scope: {
      projectId: manifestVersionId,
      sessionId: manifestVersionId,
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

export function isIgnoredForgeWorkspaceFileEvent(absolutePath: string) {
  const relativePath = toForgeWorkspaceRelativePath(absolutePath)

  if (!relativePath) {
    return true
  }

  if (relativePath === FORGE_MANIFEST_MARKER_NAME) {
    return true
  }

  const pathParts = relativePath.split('/')
  const topLevelDirectory = pathParts[0]
  const fileName = pathParts[pathParts.length - 1]

  if (
    FORGE_WORKSPACE_COLLECT_IGNORED_FILES.has(relativePath) ||
    (fileName && FORGE_WORKSPACE_COLLECT_IGNORED_FILES.has(fileName))
  ) {
    return true
  }

  return (
    topLevelDirectory !== undefined &&
    FORGE_WORKSPACE_EVENT_IGNORED_DIRECTORIES.has(topLevelDirectory)
  )
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
