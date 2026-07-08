import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import {
  createLocalBuilderManifestBundleFromManifestFiles,
  decodeLocalBase64File,
} from '~/builder/manifest'
import type { BuilderFileSource, BuilderManifest } from '~/builder/schema'
import {
  appendLocalForgeManifestTimeline,
  appendLocalForgeRuntimeEvent,
  assertNoActiveLocalForgeRun,
  getLocalForgeCurrentWorkspaceDir,
  LOCAL_FORGE_WORKFLOW_LOCK_NAME,
  persistLocalForgeManifestBundle,
  readLocalForgeBlob,
  readLocalForgeManifest,
  readLocalForgeSnapshot,
  withLocalForgeLock,
} from './local-store.server'

const MAX_COMMAND_OUTPUT_CHARS = 80_000
const COMMAND_TIMEOUT_MS = 300_000
const MATERIALIZE_LOCK_STALE_MS = COMMAND_TIMEOUT_MS * 5
const MATERIALIZE_LOCK_WAIT_MS = 100
const VITE_DEV_CHILD_PROCESS_LISTENER_HEADROOM = 20
const ROUTE_TREE_GENERATOR_SCRIPT = [
  "import { Generator, getConfig } from '@tanstack/router-generator'",
  'const root = process.cwd()',
  "const config = getConfig({ target: 'react', routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts', disableLogging: true }, root)",
  'await new Generator({ config, root }).run()',
].join('; ')
const SYSTEM_GENERATED_MANIFEST_PATHS = [
  'pnpm-workspace.yaml',
  'src/routeTree.gen.ts',
] as const

interface LocalForgeCommandResult {
  commandLine: string
  durationMs: number
  exitCode: number | null
  stderr: string
  stdout: string
}

export interface LocalForgeMaterializeResult {
  commands: Array<LocalForgeCommandResult>
  manifest: BuilderManifest
  manifestVersionId: string
  runId: string
  success: boolean
  workspacePath: string
}

export async function materializeLatestLocalForgeManifest() {
  try {
    return await withLocalForgeLock({
      name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
      staleMs: MATERIALIZE_LOCK_STALE_MS,
      task: materializeLatestLocalForgeManifestReserved,
      waitMs: MATERIALIZE_LOCK_WAIT_MS,
    })
  } catch (error) {
    if (isWorkflowLockError(error)) {
      throw await createValidationWorkflowBusyError()
    }

    throw error
  }
}

async function materializeLatestLocalForgeManifestReserved() {
  await assertNoActiveLocalForgeRun('validate the local Forge workspace')
  const snapshot = await readLocalForgeSnapshot()
  const manifestVersionId = snapshot.manifestVersionId

  if (!manifestVersionId) {
    throw new Error('Forge has no manifest to materialize.')
  }

  const manifest = await readLocalForgeManifest(manifestVersionId)
  const runId = `local-validation-${crypto.randomUUID()}`

  try {
    return await materializeLocalForgeManifest({
      manifest,
      runId,
    })
  } catch (error) {
    if (isMaterializeBusyError(error)) {
      throw new Error('A local Forge workspace validation is already active.')
    }

    throw error
  }
}

export async function materializeLocalForgeManifest({
  commitSystemSnapshotTimeline = true,
  manifest,
  runId,
}: {
  commitSystemSnapshotTimeline?: boolean
  manifest: BuilderManifest
  runId: string
}): Promise<LocalForgeMaterializeResult> {
  try {
    return await withLocalForgeLock({
      name: 'materialize',
      staleMs: MATERIALIZE_LOCK_STALE_MS,
      task: () =>
        materializeLocalForgeManifestLocked({
          commitSystemSnapshotTimeline,
          manifest,
          runId,
        }),
      waitMs: MATERIALIZE_LOCK_WAIT_MS,
    })
  } catch (error) {
    if (isMaterializeLockError(error)) {
      throw new Error(
        'The local Forge workspace is already being materialized.',
      )
    }

    throw error
  }
}

async function materializeLocalForgeManifestLocked({
  commitSystemSnapshotTimeline,
  manifest,
  runId,
}: {
  commitSystemSnapshotTimeline: boolean
  manifest: BuilderManifest
  runId: string
}): Promise<LocalForgeMaterializeResult> {
  const startedAt = Date.now()
  const workspacePath = getLocalForgeCurrentWorkspaceDir()
  let activeManifest = manifest

  await appendLocalForgeRuntimeEvent({
    message: 'Materializing manifest workspace',
    name: 'workflow.materialize.started',
    path: workspacePath,
    producerId: 'local-materializer',
    runId,
    startedAt,
    status: 'running',
  })

  const commands: Array<LocalForgeCommandResult> = []

  try {
    await writeManifestWorkspace({
      manifest: activeManifest,
      workspacePath,
    })

    await appendLocalForgeRuntimeEvent({
      detail: `${Object.keys(activeManifest.files).length} files`,
      message: 'Manifest workspace materialized',
      name: 'workflow.materialize.finished',
      path: workspacePath,
      producerId: 'local-materializer',
      runId,
      startedAt,
      status: 'finished',
    })

    commands.push(
      await runWorkflowCommand({
        args: ['install'],
        command: activeManifest.app.packageManager,
        name: 'install',
        runId,
        startedAt,
        workspacePath,
      }),
    )
    if (
      workflowCommandsPassed(commands) &&
      shouldGenerateTanStackRouteTree(activeManifest)
    ) {
      commands.push(
        await runWorkflowCommand({
          args: [
            'exec',
            'node',
            '--input-type=module',
            '-e',
            ROUTE_TREE_GENERATOR_SCRIPT,
          ],
          command: activeManifest.app.packageManager,
          name: 'route-tree',
          runId,
          startedAt,
          workspacePath,
        }),
      )
    }

    if (workflowCommandsPassed(commands)) {
      activeManifest = await snapshotLocalForgeSystemGeneratedFiles({
        appendTimeline: false,
        manifest: activeManifest,
        runId,
        startedAt,
        workspacePath,
      })
    }

    if (workflowCommandsPassed(commands)) {
      commands.push(
        await runWorkflowCommand({
          args: ['exec', 'tsc', '--noEmit'],
          command: activeManifest.app.packageManager,
          name: 'typecheck',
          runId,
          startedAt,
          workspacePath,
        }),
      )
    }

    if (workflowCommandsPassed(commands)) {
      commands.push(
        await runWorkflowCommand({
          args: ['run', 'build'],
          command: activeManifest.app.packageManager,
          name: 'build',
          runId,
          startedAt,
          workspacePath,
        }),
      )
    }

    if (
      commitSystemSnapshotTimeline &&
      activeManifest.manifestVersionId !== manifest.manifestVersionId
    ) {
      await appendLocalForgeManifestTimeline({
        bundle: {
          blobs: {},
          manifest: activeManifest,
        },
        createdAt: activeManifest.createdAt,
        producerId: 'local-materializer',
        producerKind: 'system',
        runId,
      })
    }

    const failedCommand = commands.find((command) => command.exitCode !== 0)

    if (failedCommand) {
      await appendLocalForgeRuntimeEvent({
        detail: `${failedCommand.commandLine} failed: ${summarizeCommandResult(
          failedCommand,
        )}`,
        message: 'Generated workspace validation failed',
        name: 'workflow.validation.failed',
        path: workspacePath,
        producerId: 'local-materializer',
        runId,
        startedAt,
        status: 'failed',
      })

      return {
        commands,
        manifest: activeManifest,
        manifestVersionId: activeManifest.manifestVersionId,
        runId,
        success: false,
        workspacePath,
      }
    }

    await appendLocalForgeRuntimeEvent({
      detail: `Validated ${activeManifest.manifestVersionId}`,
      message: 'Generated workspace validation passed',
      name: 'workflow.validation.finished',
      path: workspacePath,
      producerId: 'local-materializer',
      runId,
      startedAt,
      status: 'finished',
    })

    return {
      commands,
      manifest: activeManifest,
      manifestVersionId: activeManifest.manifestVersionId,
      runId,
      success: true,
      workspacePath,
    }
  } catch (error) {
    await appendLocalForgeRuntimeEvent({
      detail: error instanceof Error ? error.message : 'Validation failed',
      message: 'Generated workspace validation failed',
      name: 'workflow.validation.failed',
      path: workspacePath,
      producerId: 'local-materializer',
      runId,
      startedAt,
      status: 'failed',
    })

    throw error
  }
}

function workflowCommandsPassed(commands: Array<LocalForgeCommandResult>) {
  return commands.every((command) => command.exitCode === 0)
}

function isMaterializeBusyError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === 'materialize.lock is already locked.' ||
      error.message ===
        'The local Forge workspace is already being materialized.')
  )
}

function isWorkflowLockError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(`${LOCAL_FORGE_WORKFLOW_LOCK_NAME}.lock`)
  )
}

async function createValidationWorkflowBusyError() {
  const snapshot = await readLocalForgeSnapshot()
  const latestRun = snapshot.latestRun

  if (
    latestRun &&
    (latestRun.status === 'finishing' ||
      latestRun.status === 'paused' ||
      latestRun.status === 'queued' ||
      latestRun.status === 'running' ||
      latestRun.status === 'starting')
  ) {
    return new Error(
      `Cannot validate the local Forge workspace while Forge run ${latestRun.id} is ${latestRun.status}.`,
    )
  }

  if (snapshot.exports.some((exportRow) => exportRow.status === 'running')) {
    return new Error(
      'Cannot validate the local Forge workspace while another Forge workflow is active.',
    )
  }

  return new Error('A local Forge workspace validation is already active.')
}

function isMaterializeLockError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === 'materialize.lock is already locked.'
  )
}

export async function snapshotLocalForgeSystemGeneratedFiles({
  appendTimeline = true,
  manifest,
  runId,
  startedAt,
  workspacePath = getLocalForgeCurrentWorkspaceDir(),
}: {
  appendTimeline?: boolean
  manifest: BuilderManifest
  runId: string
  startedAt: number
  workspacePath?: string
}) {
  const systemFiles = await readSystemGeneratedWorkspaceFiles(workspacePath)
  const systemFilePaths = Object.keys(systemFiles).sort()

  if (!systemFilePaths.length) {
    return manifest
  }

  const currentFiles = await readManifestFileContents(manifest)
  const changedSystemFilePaths = systemFilePaths.filter((filePath) => {
    return currentFiles[filePath] !== systemFiles[filePath]
  })

  if (!changedSystemFilePaths.length) {
    return manifest
  }

  await appendLocalForgeRuntimeEvent({
    detail: changedSystemFilePaths.join(', '),
    message: 'System files snapshot started',
    name: 'workflow.manifest.system-snapshot.started',
    path: workspacePath,
    producerId: 'local-materializer',
    runId,
    startedAt,
    status: 'running',
  })

  try {
    const createdAt = new Date().toISOString()
    const bundle = await createLocalBuilderManifestBundleFromManifestFiles({
      createdAt,
      createdByRunId: runId,
      fileSource: 'system',
      fileSources: createFileSourceMap(manifest, systemFilePaths),
      files: {
        ...currentFiles,
        ...systemFiles,
      },
      manifest,
      parentManifestVersionId: manifest.manifestVersionId,
    })

    await persistLocalForgeManifestBundle(bundle)
    if (appendTimeline) {
      await appendLocalForgeManifestTimeline({
        bundle,
        createdAt,
        producerId: 'local-materializer',
        producerKind: 'system',
        runId,
      })
    }
    await appendLocalForgeRuntimeEvent({
      detail: `${systemFilePaths.length} system files, ${Object.keys(bundle.manifest.files).length} total files`,
      message: 'System files snapshot finished',
      name: 'workflow.manifest.system-snapshot.finished',
      path: workspacePath,
      producerId: 'local-materializer',
      runId,
      startedAt,
      status: 'finished',
    })

    return bundle.manifest
  } catch (error) {
    await appendLocalForgeRuntimeEvent({
      detail:
        error instanceof Error ? error.message : 'System file snapshot failed',
      message: 'System files snapshot failed',
      name: 'workflow.manifest.system-snapshot.failed',
      path: workspacePath,
      producerId: 'local-materializer',
      runId,
      startedAt,
      status: 'failed',
    })

    throw error
  }
}

function createFileSourceMap(
  manifest: BuilderManifest,
  systemFilePaths: Array<string>,
) {
  const fileSources: Record<string, BuilderFileSource> = {}

  for (const file of Object.values(manifest.files)) {
    fileSources[file.path] = file.source
  }

  for (const filePath of systemFilePaths) {
    fileSources[filePath] = 'system'
  }

  return fileSources
}

async function readManifestFileContents(manifest: BuilderManifest) {
  const files: Record<string, string> = {}

  for (const file of Object.values(manifest.files)) {
    const blob = await readLocalForgeBlob(file.blobRef)
    files[file.path] = blob.content
  }

  return files
}

async function readSystemGeneratedWorkspaceFiles(workspacePath: string) {
  const files: Record<string, string> = {}

  for (const filePath of SYSTEM_GENERATED_MANIFEST_PATHS) {
    const content = await readOptionalWorkspaceTextFile({
      filePath,
      workspacePath,
    })

    if (content !== undefined) {
      files[filePath] = content
    }
  }

  return files
}

async function readOptionalWorkspaceTextFile({
  filePath,
  workspacePath,
}: {
  filePath: string
  workspacePath: string
}) {
  try {
    return await readFile(path.join(workspacePath, filePath), 'utf8')
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return undefined
    }

    throw error
  }
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined
  }

  const { code } = error

  return typeof code === 'string' ? code : undefined
}

async function writeManifestWorkspace({
  manifest,
  workspacePath,
}: {
  manifest: BuilderManifest
  workspacePath: string
}) {
  await removeWorkspaceIfPresent(workspacePath)
  await mkdir(workspacePath, { recursive: true })

  for (const file of Object.values(manifest.files)) {
    const safePath = toSafeWorkspacePath(file.path)
    const outputPath = path.join(workspacePath, safePath)
    const blob = await readLocalForgeBlob(file.blobRef)
    const binary = decodeLocalBase64File(blob.content)

    await mkdir(path.dirname(outputPath), { recursive: true })

    if (binary) {
      await writeFile(outputPath, binary)
    } else {
      await writeFile(outputPath, blob.content, 'utf8')
    }
  }

  await writePackageManagerWorkspaceFiles({
    manifest,
    workspacePath,
  })
}

async function removeWorkspaceIfPresent(workspacePath: string) {
  try {
    await rm(workspacePath, {
      force: true,
      recursive: true,
    })
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return
    }

    throw error
  }
}

async function writePackageManagerWorkspaceFiles({
  manifest,
  workspacePath,
}: {
  manifest: BuilderManifest
  workspacePath: string
}) {
  if (manifest.app.packageManager !== 'pnpm') {
    return
  }

  await writeFile(
    path.join(workspacePath, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - .',
      'onlyBuiltDependencies:',
      '  - esbuild',
      '  - lightningcss',
      '',
    ].join('\n'),
    'utf8',
  )
}

function shouldGenerateTanStackRouteTree(manifest: BuilderManifest) {
  return Boolean(
    manifest.files['src/router.tsx'] &&
    manifest.files['src/routes/__root.tsx'] &&
    manifest.app.packageManager === 'pnpm',
  )
}

async function runWorkflowCommand({
  args,
  command,
  name,
  runId,
  startedAt,
  workspacePath,
}: {
  args: Array<string>
  command: string
  name: string
  runId: string
  startedAt: number
  workspacePath: string
}) {
  const commandLine = [command, ...args].join(' ')

  await appendLocalForgeRuntimeEvent({
    detail: commandLine,
    message: `${name} started`,
    name: 'workflow.command.started',
    path: workspacePath,
    producerId: 'local-materializer',
    runId,
    startedAt,
    status: 'running',
  })

  const result = await runCommand({
    args,
    command,
    cwd: workspacePath,
  })

  await appendLocalForgeRuntimeEvent({
    detail: summarizeCommandResult(result),
    message: `${name} ${result.exitCode === 0 ? 'passed' : 'failed'}`,
    name:
      result.exitCode === 0
        ? 'workflow.command.finished'
        : 'workflow.command.failed',
    path: workspacePath,
    producerId: 'local-materializer',
    runId,
    startedAt,
    status: result.exitCode === 0 ? 'finished' : 'failed',
  })

  return result
}

function runCommand({
  args,
  command,
  cwd,
}: {
  args: Array<string>
  command: string
  cwd: string
}): Promise<LocalForgeCommandResult> {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const child = spawnCommandWithListenerHeadroom(command, args, cwd)
    const inheritedListenerCount = Math.max(
      child.listenerCount('close'),
      child.listenerCount('error'),
      child.listenerCount('exit'),
      child.listenerCount('spawn'),
    )
    const inheritedMaxListeners = child.getMaxListeners()

    if (inheritedListenerCount >= inheritedMaxListeners) {
      child.setMaxListeners(inheritedListenerCount + 2)
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error(`${[command, ...args].join(' ')} timed out`))
    }, COMMAND_TIMEOUT_MS)

    function appendOutput(current: string, chunk: Buffer) {
      const next = current + chunk.toString('utf8')
      if (next.length <= MAX_COMMAND_OUTPUT_CHARS) {
        return next
      }

      return next.slice(next.length - MAX_COMMAND_OUTPUT_CHARS)
    }

    function handleStdoutData(chunk: Buffer) {
      stdout = appendOutput(stdout, chunk)
    }

    function handleStderrData(chunk: Buffer) {
      stderr = appendOutput(stderr, chunk)
    }

    function handleChildError(error: Error) {
      finish(error)
    }

    function handleChildClose(code: number | null) {
      finish(null, code)
    }

    function cleanup() {
      clearTimeout(timeout)
      child.stdout.off('data', handleStdoutData)
      child.stderr.off('data', handleStderrData)
      child.off('error', handleChildError)
      child.off('close', handleChildClose)
    }

    function finish(error: Error | null, exitCode: number | null = null) {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (error) {
        reject(error)
        return
      }

      resolve({
        commandLine: [command, ...args].join(' '),
        durationMs: Date.now() - startedAt,
        exitCode,
        stderr,
        stdout,
      })
    }

    child.stdout.on('data', handleStdoutData)
    child.stderr.on('data', handleStderrData)
    child.once('error', handleChildError)
    child.once('close', handleChildClose)
  })
}

function spawnCommandWithListenerHeadroom(
  command: string,
  args: Array<string>,
  cwd: string,
) {
  const previousDefaultMaxListeners = EventEmitter.defaultMaxListeners

  if (previousDefaultMaxListeners < VITE_DEV_CHILD_PROCESS_LISTENER_HEADROOM) {
    EventEmitter.defaultMaxListeners = VITE_DEV_CHILD_PROCESS_LISTENER_HEADROOM
  }

  try {
    return spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } finally {
    EventEmitter.defaultMaxListeners = previousDefaultMaxListeners
  }
}

export function assertSafeManifestWorkspacePath(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${filePath} is not a safe manifest path.`)
  }
}

function toSafeWorkspacePath(filePath: string) {
  assertSafeManifestWorkspacePath(filePath)
  return filePath
}

function summarizeCommandResult(result: LocalForgeCommandResult) {
  const output = [result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .trim()
  const summary = output || `exit ${result.exitCode}`

  return summary.length > 1000 ? `${summary.slice(0, 1000)}...` : summary
}
