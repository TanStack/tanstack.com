import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EventType,
  type RunFinishedEvent,
  type StreamChunk,
} from '@tanstack/ai'
import { getBuilderAiRunOutcome } from '../src/utils/builder-ai-run-outcome'
import { streamBuilderAiResponse } from '../src/utils/builder-ai'

function finish(fields: Partial<RunFinishedEvent>): RunFinishedEvent {
  return {
    type: EventType.RUN_FINISHED,
    threadId: 'thread',
    runId: 'run',
    ...fields,
  }
}

test('Builder distinguishes successful completion, tool continuation, and incomplete responses', () => {
  assert.equal(
    getBuilderAiRunOutcome(finish({ finishReason: 'stop' })).status,
    'complete',
  )
  assert.equal(
    getBuilderAiRunOutcome(finish({ outcome: { type: 'success' } })).status,
    'complete',
  )
  assert.equal(
    getBuilderAiRunOutcome(finish({ finishReason: 'tool_calls' })).status,
    'continue',
  )
  assert.equal(getBuilderAiRunOutcome(finish({})).status, 'failed')
  for (const event of [
    finish({ finishReason: 'length', outcome: { type: 'success' } }),
    finish({ finishReason: 'content_filter' }),
    finish({
      finishReason: 'stop',
      metadata: { tanstack: { finishReason: 'length' } },
    }),
  ])
    assert.equal(getBuilderAiRunOutcome(event).status, 'failed')
})

test('the server never creates a successful project result for an incomplete model response', async () => {
  for (const event of [
    finish({ finishReason: 'length' }),
    finish({ finishReason: 'content_filter' }),
    finish({}),
  ]) {
    async function* source(): AsyncGenerator<StreamChunk> {
      yield event
    }
    const chunks: StreamChunk[] = []
    for await (const chunk of streamBuilderAiResponse(
      source(),
      'secret',
      () => {
        throw new Error('An incomplete run must not produce a project result')
      },
    ))
      chunks.push(chunk)
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0]?.type, EventType.RUN_ERROR)
  }
})

test('a provider error cannot be followed by a successful Builder result', async () => {
  async function* source(): AsyncGenerator<StreamChunk> {
    yield { type: EventType.RUN_ERROR, message: 'Connection lost' }
    yield finish({ finishReason: 'stop' })
  }
  const chunks: StreamChunk[] = []
  for await (const chunk of streamBuilderAiResponse(source(), 'secret', () => {
    throw new Error('The run already failed')
  }))
    chunks.push(chunk)
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0]?.type, EventType.RUN_ERROR)
})
