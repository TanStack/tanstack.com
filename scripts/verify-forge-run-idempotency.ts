import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCwd = process.cwd()
const originalHarness = process.env.FORGE_AGENT_HARNESS
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-idempotency-'))

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
process.env.FORGE_AGENT_HARNESS = 'tanstack-ai'
process.chdir(runtimeRoot)

try {
  const { startLocalForgeAgentRun } =
    await import('../src/builder/runtime/local-agent.server')
  const { readLocalForgeTimeline, resetLocalForgeRuntime } =
    await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const firstSnapshot = await startLocalForgeAgentRun({
    clientRequestId: 'fixture-client-request',
    prompt: 'Build a retry-safe dashboard',
  })
  const secondSnapshot = await startLocalForgeAgentRun({
    clientRequestId: 'fixture-client-request',
    prompt: 'Build a retry-safe dashboard',
  })

  assert.equal(firstSnapshot.latestRun?.id, secondSnapshot.latestRun?.id)

  await waitForTerminalRun(readLocalForgeTimeline)

  const timeline = await readLocalForgeTimeline()
  const inputEvents = timeline.filter(
    (event) =>
      event.type === 'session.input.received' &&
      event.payload.clientRequestId === 'fixture-client-request',
  )
  const queuedEvents = timeline.filter(
    (event) =>
      event.type === 'run.queued' &&
      event.payload.inputEventId === inputEvents[0]?.eventId,
  )
  const startedEvents = timeline.filter(
    (event) =>
      event.type === 'run.started' &&
      event.payload.inputEventId === inputEvents[0]?.eventId,
  )

  assert.equal(inputEvents.length, 1)
  assert.equal(queuedEvents.length, 1)
  assert.equal(startedEvents.length, 1)
} finally {
  process.chdir(originalCwd)

  restoreEnvVar('FORGE_AGENT_HARNESS', originalHarness)

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

console.log('Forge run idempotency verifier passed')

async function waitForTerminalRun(
  readTimeline: () => Promise<
    Array<{
      type: string
    }>
  >,
) {
  const deadline = Date.now() + 5_000

  while (Date.now() < deadline) {
    const timeline = await readTimeline()

    if (
      timeline.some(
        (event) => event.type === 'run.finished' || event.type === 'run.failed',
      )
    ) {
      return
    }

    await delay(25)
  }

  throw new Error('Timed out waiting for terminal local Forge run event.')
}

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
