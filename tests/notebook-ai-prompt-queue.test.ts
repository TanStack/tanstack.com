import assert from 'node:assert/strict'
import test from 'node:test'
import { NotebookAiPromptQueue } from '../src/utils/notebook-ai-prompt-queue'

test('notebook AI prompt queue claims one active runner synchronously', () => {
  const queue = new NotebookAiPromptQueue()

  assert.equal(queue.active, false)
  assert.equal(queue.claim(), true)
  assert.equal(queue.active, true)
  assert.equal(queue.claim(), false)

  queue.release()

  assert.equal(queue.active, false)
  assert.equal(queue.claim(), true)
})

test('notebook AI prompt queue prioritizes steering without reordering modes', () => {
  const queue = new NotebookAiPromptQueue()
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

test('notebook AI prompt queue creates prompt metadata', () => {
  const queue = new NotebookAiPromptQueue()
  const before = Date.now()
  const item = queue.enqueue('Keep my spacing  ', 'queue')
  const after = Date.now()

  assert.match(item.id, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i)
  assert.equal(item.content, 'Keep my spacing  ')
  assert.equal(item.mode, 'queue')
  assert.equal(item.createdAt >= before, true)
  assert.equal(item.createdAt <= after, true)
})

test('notebook AI prompt queue snapshots and cancels pending prompts', () => {
  const queue = new NotebookAiPromptQueue()
  const queued = queue.enqueue('Queued prompt', 'queue')
  const steered = queue.enqueue('Steering prompt', 'steer')
  const snapshot = queue.items

  assert.equal(queue.cancel(steered.id), true)
  assert.deepEqual(queue.items, [queued])
  assert.deepEqual(snapshot, [steered, queued])
  assert.equal(queue.cancel(steered.id), false)
  assert.equal(queue.cancel('missing'), false)
})

test('notebook AI prompt queue clears pending prompts without releasing its runner', () => {
  const queue = new NotebookAiPromptQueue()
  queue.enqueue('Queued prompt', 'queue')
  queue.enqueue('Steering prompt', 'steer')
  queue.claim()

  assert.equal(queue.clear(), 2)
  assert.deepEqual(queue.items, [])
  assert.equal(queue.active, true)
  assert.equal(queue.clear(), 0)
})
