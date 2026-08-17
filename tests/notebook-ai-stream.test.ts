import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { NotebookAiResponse } from '../src/utils/notebook-ai'
import { runNotebookAiStream } from '../src/utils/notebook-ai-stream.client'

const response: NotebookAiResponse = {
  message: 'Updated notebook.',
  execution: {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default function App() { return null }' },
    }),
  },
  changedFiles: ['/index.tsx'],
  runtimeChanged: false,
}

const runStarted: StreamChunk = {
  type: EventType.RUN_STARTED,
  threadId: 'thread-1',
  runId: 'run-1',
}

const executionEvent: StreamChunk = {
  type: EventType.CUSTOM,
  name: 'notebook.execution',
  value: response,
}

const finalEvent: StreamChunk = {
  type: EventType.RUN_FINISHED,
  threadId: 'thread-1',
  runId: 'run-1',
  outcome: { type: 'success' },
  finishReason: 'stop',
}

test('notebook stream accepts execution immediately followed by the final run event', async () => {
  await withStream([runStarted, executionEvent, finalEvent], async () => {
    assert.deepEqual(await runStream(), response)
  })
})

test('notebook stream rejects execution without a final run event', async () => {
  await withStream([runStarted, executionEvent], async () => {
    await assert.rejects(runStream(), /ended before the run finished/)
  })
})

test('notebook stream rejects events between execution and the final run event', async () => {
  await withStream(
    [
      runStarted,
      executionEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: 'message-1',
        delta: 'late text',
      },
      finalEvent,
    ],
    async () => {
      await assert.rejects(runStream(), /invalid execution result/)
    },
  )
})

test('notebook stream ignores intermediate tool-loop finishes without execution', async () => {
  await withStream(
    [
      runStarted,
      {
        type: EventType.RUN_FINISHED,
        threadId: 'thread-1',
        runId: 'run-1',
        finishReason: 'tool_calls',
      },
      executionEvent,
      finalEvent,
    ],
    async () => {
      assert.deepEqual(await runStream(), response)
    },
  )
})

test('notebook stream rejects execution attached to an intermediate tool finish', async () => {
  await withStream(
    [
      runStarted,
      executionEvent,
      {
        type: EventType.RUN_FINISHED,
        threadId: 'thread-1',
        runId: 'run-1',
        finishReason: 'tool_calls',
      },
    ],
    async () => {
      await assert.rejects(runStream(), /partial execution result/)
    },
  )
})

async function runStream() {
  return runNotebookAiStream({
    endpoint: 'http://notebook.test/assist',
    forwardedProps: {},
    messages: [{ role: 'user', content: 'Update the notebook.' }],
    signal: new AbortController().signal,
    threadId: 'thread-1',
    activityId: 'activity-1',
  })
}

async function withStream(
  chunks: ReadonlyArray<StreamChunk>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}
