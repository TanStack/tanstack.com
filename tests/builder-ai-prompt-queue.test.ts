import assert from 'node:assert/strict'
import test from 'node:test'
import { BuilderAiPromptQueue } from '../src/utils/builder-ai-prompt-queue'

test('builder AI prompt queue claims one active runner synchronously', () => {
  const queue = new BuilderAiPromptQueue()

  assert.equal(queue.active, false)
  assert.equal(queue.claim(), true)
  assert.equal(queue.active, true)
  assert.equal(queue.claim(), false)

  queue.release()

  assert.equal(queue.active, false)
  assert.equal(queue.claim(), true)
})

test('builder AI prompt queue prioritizes steering without reordering modes', () => {
  const queue = new BuilderAiPromptQueue()
  const firstQueued = queue.enqueue('First queued prompt', 'queue')
  const firstSteer = queue.enqueue('First steering prompt', 'steer')
  const secondQueued = queue.enqueue('Second queued prompt', 'queue')
  const secondSteer = queue.enqueue('Second steering prompt', 'steer')

  assert.deepEqual(queue.items, [
    firstSteer,
    secondSteer,
    firstQueued,
    secondQueued,
  ])
  assert.equal(queue.take(), firstSteer)
  assert.equal(queue.take(), secondSteer)
  assert.equal(queue.take(), firstQueued)
  assert.equal(queue.take(), secondQueued)
  assert.equal(queue.take(), undefined)
})

test('builder AI prompt queue creates prompt metadata', () => {
  const queue = new BuilderAiPromptQueue()
  const before = Date.now()
  const item = queue.enqueue('Keep my spacing  ', 'queue')
  const after = Date.now()

  assert.match(item.id, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i)
  assert.equal(item.content, 'Keep my spacing  ')
  assert.equal(item.mode, 'queue')
  assert.equal(item.createdAt >= before, true)
  assert.equal(item.createdAt <= after, true)
})

test('builder AI prompt queue snapshots and cancels pending prompts', () => {
  const queue = new BuilderAiPromptQueue()
  const queued = queue.enqueue('Queued prompt', 'queue')
  const steered = queue.enqueue('Steering prompt', 'steer')
  const snapshot = queue.items

  assert.equal(queue.cancel(steered.id), true)
  assert.deepEqual(queue.items, [queued])
  assert.deepEqual(snapshot, [steered, queued])
  assert.equal(queue.cancel(steered.id), false)
  assert.equal(queue.cancel('missing'), false)
})

test('builder AI prompt queue clears pending prompts without releasing its runner', () => {
  const queue = new BuilderAiPromptQueue()
  queue.enqueue('Queued prompt', 'queue')
  queue.enqueue('Steering prompt', 'steer')
  queue.claim()

  assert.equal(queue.clear(), 2)
  assert.deepEqual(queue.items, [])
  assert.equal(queue.active, true)
  assert.equal(queue.clear(), 0)
})

test('builder AI prompt queue reports prompts discarded before they start', () => {
  const queue = new BuilderAiPromptQueue()
  const discarded: Array<string> = []
  const canceled = queue.enqueue('Cancel me', 'queue', {
    onDiscarded: () => discarded.push('canceled'),
  })
  queue.enqueue('Clear me', 'queue', {
    onDiscarded: () => discarded.push('cleared'),
  })

  assert.equal(queue.cancel(canceled.id), true)
  assert.equal(queue.clear(), 1)
  assert.deepEqual(discarded, ['canceled', 'cleared'])

  queue.enqueue('Run me', 'queue', {
    onDiscarded: () => discarded.push('started'),
  })
  assert.equal(queue.take()?.content, 'Run me')
  assert.equal(queue.clear(), 0)
  assert.deepEqual(discarded, ['canceled', 'cleared'])
})
