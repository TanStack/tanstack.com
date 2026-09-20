import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createBuilderAiTurnIdleTimeout,
  readBuilderAiTurnActivityThreadId,
} from '../scripts/builder-ai-turn-timeout'

test('expires after a full idle period', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let expirations = 0
  createBuilderAiTurnIdleTimeout(100, () => {
    expirations++
  })

  context.mock.timers.tick(99)
  assert.equal(expirations, 0)
  context.mock.timers.tick(1)
  assert.equal(expirations, 1)
})

test('activity renews the idle period', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let expirations = 0
  const timeout = createBuilderAiTurnIdleTimeout(100, () => {
    expirations++
  })

  context.mock.timers.tick(99)
  timeout.touch()
  context.mock.timers.tick(99)
  assert.equal(expirations, 0)
  context.mock.timers.tick(1)
  assert.equal(expirations, 1)
})

test('completed turns clear the idle timeout', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let expirations = 0
  const timeout = createBuilderAiTurnIdleTimeout(100, () => {
    expirations++
  })

  timeout.clear()
  context.mock.timers.tick(100)
  assert.equal(expirations, 0)
})

test('reads activity from notifications and server tool requests', () => {
  assert.equal(
    readBuilderAiTurnActivityThreadId({
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1' },
    }),
    'thread-1',
  )
  assert.equal(
    readBuilderAiTurnActivityThreadId({
      id: 42,
      method: 'item/tool/call',
      params: { threadId: 'thread-2' },
    }),
    'thread-2',
  )
  assert.equal(
    readBuilderAiTurnActivityThreadId({
      id: 42,
      result: { threadId: 'thread-3' },
    }),
    undefined,
  )
})
