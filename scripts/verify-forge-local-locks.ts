import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-locks-'))

process.chdir(runtimeRoot)

try {
  const { withLocalForgeLock } =
    await import('../src/builder/runtime/local-store.server')
  let releaseFirstLock = () => {}
  let firstLockStarted = false

  const firstLock = withLocalForgeLock({
    name: 'verifier-local-lock',
    staleMs: 5000,
    task: async () => {
      firstLockStarted = true

      await new Promise<void>((resolve) => {
        releaseFirstLock = resolve
      })

      return 'first'
    },
    waitMs: 1000,
  })

  while (!firstLockStarted) {
    await delay(5)
  }

  await assert.rejects(
    withLocalForgeLock({
      name: 'verifier-local-lock',
      staleMs: 5000,
      task: () => 'second',
      waitMs: 25,
    }),
    /verifier-local-lock\.lock is already locked/,
  )

  releaseFirstLock()

  assert.equal(await firstLock, 'first')
  assert.equal(
    await withLocalForgeLock({
      name: 'verifier-local-lock',
      staleMs: 5000,
      task: () => 'third',
      waitMs: 1000,
    }),
    'third',
  )

  let refreshedLockStarted = false
  const refreshedLock = withLocalForgeLock({
    name: 'verifier-refreshed-lock',
    staleMs: 80,
    task: async () => {
      refreshedLockStarted = true
      await delay(180)
      return 'refreshed'
    },
    waitMs: 1000,
  })

  while (!refreshedLockStarted) {
    await delay(5)
  }

  await delay(120)

  await assert.rejects(
    withLocalForgeLock({
      name: 'verifier-refreshed-lock',
      staleMs: 80,
      task: () => 'stolen',
      waitMs: 25,
    }),
    /verifier-refreshed-lock\.lock is already locked/,
  )

  assert.equal(await refreshedLock, 'refreshed')
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge local lock verifier passed')

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
