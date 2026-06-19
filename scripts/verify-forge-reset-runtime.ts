import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-reset-'))

process.chdir(runtimeRoot)

try {
  const {
    appendLocalForgeTimelineEvents,
    getLocalForgeCurrentWorkspaceDir,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const workspaceDir = getLocalForgeCurrentWorkspaceDir()

  await resetLocalForgeRuntime()
  await appendLocalForgeTimelineEvents([
    createInputEvent({
      eventId: 'reset-fixture-event',
      messageId: 'reset-fixture-message',
    }),
  ])
  await mkdir(path.join(workspaceDir, 'src'), {
    recursive: true,
  })
  await writeFile(
    path.join(workspaceDir, 'src/stale.ts'),
    'export const stale = true\n',
    'utf8',
  )

  assert.equal((await readLocalForgeTimeline()).length, 1)
  assert.equal(
    await readFile(path.join(workspaceDir, 'src/stale.ts'), 'utf8'),
    'export const stale = true\n',
  )

  await resetLocalForgeRuntime()

  assert.deepEqual(await readLocalForgeTimeline(), [])
  await assert.rejects(
    readFile(path.join(workspaceDir, 'src/stale.ts'), 'utf8'),
    isMissingFileError,
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge reset runtime verifier passed')

function createInputEvent({
  eventId,
  messageId,
}: {
  eventId: string
  messageId: string
}): LocalBuilderTimelineEvent {
  return {
    createdAt: '2026-06-18T00:00:00.000Z',
    eventId,
    producer: {
      epoch: 'reset-fixture-epoch',
      id: 'reset-fixture-ui',
      kind: 'ui',
      seq: 1,
    },
    projectId: 'reset-fixture-project',
    schemaVersion: 1,
    sessionId: 'reset-fixture-session',
    type: 'session.input.received',
    payload: {
      clientRequestId: `reset-${messageId}`,
      messageId,
      text: 'reset verifier',
    },
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}
