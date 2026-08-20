import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import {
  notebookAiLocalValidationEndpoint,
  notebookAiLocalValidationEvent,
} from '../src/utils/notebook-ai-local-validation'
import { runNotebookAiStream } from '../src/utils/notebook-ai-stream.client'

test('local Codex validates and repairs inside one open turn', async () => {
  const baseline = execution(
    'export default function App() { return <main>Ready</main> }',
  )
  const broken = execution(
    'export default function App() { return <main>Broken</main',
  )
  const repaired = execution(
    'export default function App() { return <main>Repaired</main> }',
  )
  const chunks: Array<StreamChunk> = [
    {
      type: EventType.RUN_STARTED,
      threadId: 'thread-1',
      runId: 'run-1',
    },
    validationRequest('00000000-0000-4000-8000-000000000001', broken, [
      '/index.tsx',
    ]),
    validationRequest('00000000-0000-4000-8000-000000000002', repaired, [
      '/index.tsx',
    ]),
    {
      type: EventType.CUSTOM,
      name: 'notebook.execution',
      value: {
        message: 'Repaired the notebook.',
        execution: repaired,
        changedFiles: ['/index.tsx'],
        runtimeChanged: false,
        trace: {
          evidenceFingerprints: [],
          mutationFingerprints: [],
        },
      },
    },
    {
      type: EventType.RUN_FINISHED,
      threadId: 'thread-1',
      runId: 'run-1',
      outcome: { type: 'success' },
      finishReason: 'stop',
    },
  ]
  const submissions: Array<unknown> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (url === notebookAiLocalValidationEndpoint) {
      submissions.push(
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      )
      return Response.json({ accepted: true })
    }
    return new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  let validationCount = 0
  try {
    const result = await runNotebookAiStream({
      endpoint: '/api/notebook/chatgpt/assist',
      forwardedProps: {
        model: 'gpt-5.6-luna',
        execution: baseline,
        hiddenFiles: [],
      },
      messages: [{ role: 'user', content: 'Repair the notebook.' }],
      signal: new AbortController().signal,
      threadId: 'thread-1',
      activityId: 'activity-1',
      onLocalValidate: async () => {
        validationCount += 1
        return validationCount === 1
          ? {
              result: {
                status: 'repair',
                phase: 'compile',
                diagnostic: 'Expected closing bracket',
                evidence: 'esbuild: Expected closing bracket',
              },
              repair: {
                priorEvidenceFingerprints: ['0000000000000000'],
                blockedMutationFingerprints: ['1111111111111111'],
              },
            }
          : { result: { status: 'complete' } }
      },
    })

    assert.equal(validationCount, 2)
    assert.equal(submissions.length, 2)
    assert.deepEqual(result.execution, repaired)
    assert.deepEqual(result.changedFiles, ['/index.tsx'])
    assert.deepEqual(submissions[1], {
      requestId: '00000000-0000-4000-8000-000000000002',
      result: { status: 'complete' },
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

function execution(source: string) {
  return {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': source },
    }),
  }
}

function validationRequest(
  requestId: string,
  candidate: ReturnType<typeof execution>,
  changedFiles: Array<string>,
): StreamChunk {
  return {
    type: EventType.CUSTOM,
    name: notebookAiLocalValidationEvent,
    value: {
      requestId,
      state: {
        execution: candidate,
        changedFiles,
        runtimeChanged: false,
        trace: {
          evidenceFingerprints: [],
          mutationFingerprints: [],
        },
      },
    },
  }
}
