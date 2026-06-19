import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCwd = process.cwd()
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-background-'))

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
process.chdir(runtimeRoot)

try {
  const { startLocalForgeAgentRun } =
    await import('../src/builder/runtime/local-agent.server')
  const {
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
    withLocalForgeLock,
    LOCAL_FORGE_WORKFLOW_LOCK_NAME,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const startedAt = Date.now()
  const startedSnapshot = await startLocalForgeAgentRun({
    clientRequestId: 'fixture-background-request',
    prompt: 'Build a tiny local dashboard',
  })
  const startDurationMs = Date.now() - startedAt

  assert.ok(
    startDurationMs < 2_000,
    `background start should return quickly, took ${startDurationMs}ms`,
  )
  assert.equal(startedSnapshot.latestRun?.status, 'running')
  assert.equal(
    startedSnapshot.messages.at(-1)?.content,
    'Build a tiny local dashboard',
  )

  const failedSnapshot = await waitForFailedRun(readLocalForgeSnapshot)

  assert.equal(failedSnapshot.latestRun?.status, 'failed')
  assert.match(
    failedSnapshot.latestRun?.error ?? '',
    /OPENAI_API_KEY or ANTHROPIC_API_KEY/,
  )

  await withLocalForgeLock({
    name: LOCAL_FORGE_WORKFLOW_LOCK_NAME,
    staleMs: 60_000,
    task: () => Promise.resolve(),
    waitMs: 100,
  })
} finally {
  process.chdir(originalCwd)

  if (originalAnthropicApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY
  } else {
    process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey
  }

  if (originalOpenAiApiKey === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey
  }

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge background run verifier passed')

async function waitForFailedRun(
  readSnapshot: () => Promise<{
    latestRun?: {
      error?: string
      status: string
    }
  }>,
) {
  const deadline = Date.now() + 5_000

  while (Date.now() < deadline) {
    const snapshot = await readSnapshot()

    if (snapshot.latestRun?.status === 'failed') {
      return snapshot
    }

    await delay(25)
  }

  throw new Error('Timed out waiting for local Forge background run to fail.')
}

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
