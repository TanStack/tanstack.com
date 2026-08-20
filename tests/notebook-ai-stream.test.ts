import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EventType,
  INTERRUPT_BINDING_METADATA_KEY,
  INTERRUPT_BINDING_VERSION,
  canonicalInterruptJson,
  convertSchemaToJsonSchema,
  digestInterruptJson,
  hashSchemaInput,
  type MessagesSnapshotEvent,
  type StreamChunk,
} from '@tanstack/ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { NotebookAiResponse } from '../src/utils/notebook-ai'
import {
  runNotebookAiStream,
  type NotebookAiStreamValidationOutcome,
} from '../src/utils/notebook-ai-stream.client'
import { validateNotebookAiTool } from '../src/utils/notebook-ai-validation'

const response: NotebookAiResponse = {
  message: 'Updated notebook.',
  execution: {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': 'export default function App() { return <div /> }',
      },
    }),
  },
  changedFiles: ['/index.tsx'],
  runtimeChanged: false,
  trace: { evidenceFingerprints: [], mutationFingerprints: [] },
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

test('notebook stream validates and repairs more than twice inside one client-tool flow', async () => {
  const candidates = [1, 2, 3, 4].map((version) => ({
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': `export default function App() { return <p>${version}</p> }`,
      },
    }),
  }))
  const streams = candidates.map(
    (execution, index) => (requestBody: Record<string, unknown>) =>
      nativeValidationStream({
        execution,
        index,
        runId: readRequestRunId(requestBody),
      }),
  )
  const finalResponse = {
    ...response,
    execution: candidates[3],
    changedFiles: [],
  }
  streams.push((requestBody) => {
    const runId = readRequestRunId(requestBody)
    return [
      {
        type: EventType.RUN_STARTED,
        threadId: 'thread-1',
        runId,
      },
      validationResultEvent(3),
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: 'message-5',
        role: 'assistant',
      },
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: 'message-5',
        delta: 'Updated notebook.',
      },
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: 'message-5',
      },
      {
        type: EventType.CUSTOM,
        name: 'notebook.execution',
        value: finalResponse,
      },
      {
        type: EventType.RUN_FINISHED,
        threadId: 'thread-1',
        runId,
        outcome: { type: 'success' },
        finishReason: 'stop',
      },
    ]
  })

  const requestBodies: Array<Record<string, unknown>> = []
  let validationCount = 0
  await withStreams(streams, requestBodies, async () => {
    const result = await runNotebookAiStream({
      endpoint: 'http://notebook.test/assist',
      forwardedProps: { execution: response.execution },
      messages: [{ role: 'user', content: 'Update the notebook.' }],
      signal: new AbortController().signal,
      threadId: 'thread-1',
      activityId: 'activity-1',
      onValidate: async () => {
        validationCount += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return validationOutcome(validationCount - 1)
      },
    })

    assert.equal(validationCount, 4)
    assert.deepEqual(result.execution, candidates[3])
    assert.deepEqual(result.changedFiles, ['/index.tsx'])
    assert.equal(requestBodies.length, 5)

    for (let index = 1; index < requestBodies.length; index += 1) {
      const requestBody = requestBodies[index]
      assert.equal(typeof requestBody?.parentRunId, 'string')
      assert.deepEqual(requestBody?.resume, [
        {
          interruptId: `client_tool_validation-${index}`,
          payload: validationOutcome(index - 1).result,
          status: 'resolved',
        },
      ])
      assert.deepEqual(
        readForwardedProps(requestBody).execution,
        candidates[index - 1],
      )
      if (index < requestBodies.length - 1) {
        assert.deepEqual(
          readForwardedProps(requestBody).repair,
          validationOutcome(index - 1).repair,
        )
      } else {
        assert.equal('repair' in readForwardedProps(requestBody), false)
      }
    }
  })
})

test('notebook stream rejects a changed execution that was not validated', async () => {
  const baselineExecution = {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default function App() { return null }' },
    }),
  }
  await withStream([runStarted, executionEvent, finalEvent], async () => {
    await assert.rejects(
      runNotebookAiStream({
        endpoint: 'http://notebook.test/assist',
        forwardedProps: { execution: baselineExecution },
        messages: [{ role: 'user', content: 'Update the notebook.' }],
        signal: new AbortController().signal,
        threadId: 'thread-1',
        activityId: 'activity-1',
        onValidate: async () => ({ result: { status: 'complete' } }),
      }),
      /without validating/,
    )
  })
})

test('notebook stream stops after a terminal validation result', async () => {
  const diagnostic = 'The notebook validation budget was reached.'
  const stopOutcome: NotebookAiStreamValidationOutcome = {
    result: {
      status: 'stop',
      preserveCurrentExecution: false,
      diagnostic,
    },
  }
  const requestBodies: Array<Record<string, unknown>> = []
  let validationCount = 0
  await withStreams(
    [
      (requestBody) =>
        nativeValidationStream({
          execution: response.execution,
          index: 0,
          runId: readRequestRunId(requestBody),
        }),
      (requestBody) => [
        {
          type: EventType.RUN_STARTED,
          threadId: 'thread-1',
          runId: readRequestRunId(requestBody),
        },
        { type: EventType.RUN_ERROR, message: diagnostic },
      ],
    ],
    requestBodies,
    async () => {
      await assert.rejects(
        runNotebookAiStream({
          endpoint: 'http://notebook.test/assist',
          forwardedProps: { execution: response.execution },
          messages: [{ role: 'user', content: 'Update the notebook.' }],
          signal: new AbortController().signal,
          threadId: 'thread-1',
          activityId: 'activity-1',
          onValidate: async () => {
            validationCount += 1
            await new Promise((resolve) => setTimeout(resolve, 10))
            return stopOutcome
          },
        }),
        /validation budget was reached/,
      )
    },
  )

  assert.equal(validationCount, 1)
  assert.equal(requestBodies.length, 2)
  assert.equal(typeof requestBodies[1]?.parentRunId, 'string')
  assert.deepEqual(requestBodies[1]?.resume, [
    {
      interruptId: 'client_tool_validation-1',
      payload: stopOutcome.result,
      status: 'resolved',
    },
  ])
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

async function withStreams(
  streams: ReadonlyArray<
    (requestBody: Record<string, unknown>) => ReadonlyArray<StreamChunk>
  >,
  requestBodies: Array<Record<string, unknown>>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch
  let requestIndex = 0
  globalThis.fetch = async (_input, init) => {
    if (typeof init?.body !== 'string') {
      throw new Error('Notebook AI request body was missing')
    }
    const requestBody = readRecord(JSON.parse(init.body))
    requestBodies.push(requestBody)
    const createChunks = streams[requestIndex]
    requestIndex += 1
    if (!createChunks) throw new Error('Unexpected notebook AI request')
    const chunks = createChunks(requestBody)
    return new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  }
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function nativeValidationStream({
  execution,
  index,
  runId,
}: {
  execution: NotebookAiResponse['execution']
  index: number
  runId: string
}): Array<StreamChunk> {
  const toolCallId = `validation-${index + 1}`
  const interruptId = `client_tool_${toolCallId}`
  const responseSchema = convertSchemaToJsonSchema(
    validateNotebookAiTool.outputSchema,
  )
  if (!responseSchema) {
    throw new Error('Notebook validation output schema was missing')
  }
  const priorMessages: MessagesSnapshotEvent['messages'] = []
  for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
    priorMessages.push({
      id: `assistant-${priorIndex + 1}`,
      role: 'assistant',
      toolCalls: [
        {
          id: `validation-${priorIndex + 1}`,
          type: 'function',
          function: { name: 'validate_notebook', arguments: '{}' },
        },
      ],
    })
    priorMessages.push({
      id: `tool-${priorIndex + 1}`,
      role: 'tool',
      toolCallId: `validation-${priorIndex + 1}`,
      content: JSON.stringify(validationOutcome(priorIndex).result),
    })
  }

  const events: Array<StreamChunk> = [
    {
      type: EventType.RUN_STARTED,
      threadId: 'thread-1',
      runId,
    },
  ]
  if (index > 0) events.push(validationResultEvent(index - 1))
  events.push(
    {
      type: EventType.TOOL_CALL_START,
      toolCallId,
      toolCallName: 'validate_notebook',
      toolName: 'validate_notebook',
    },
    {
      type: EventType.TOOL_CALL_ARGS,
      toolCallId,
      args: '{}',
      delta: '',
    },
    {
      type: EventType.TOOL_CALL_END,
      toolCallId,
      toolCallName: 'validate_notebook',
      toolName: 'validate_notebook',
      input: {},
    },
    {
      type: EventType.CUSTOM,
      name: 'tool-input-available',
      value: { toolCallId, toolName: 'validate_notebook', input: {} },
    },
    {
      type: EventType.MESSAGES_SNAPSHOT,
      messages: [
        { id: 'user-1', role: 'user', content: 'Update the notebook.' },
        ...priorMessages,
        {
          id: `assistant-${index + 1}`,
          role: 'assistant',
          toolCalls: [
            {
              id: toolCallId,
              type: 'function',
              function: { name: 'validate_notebook', arguments: '{}' },
            },
          ],
        },
      ],
    },
    {
      type: EventType.STATE_SNAPSHOT,
      snapshot: {
        execution,
        changedFiles: ['/index.tsx'],
        runtimeChanged: false,
        trace: { evidenceFingerprints: [], mutationFingerprints: [] },
      },
    },
    {
      type: EventType.RUN_FINISHED,
      threadId: 'thread-1',
      runId,
      finishReason: 'tool_calls',
      outcome: {
        type: 'interrupt',
        interrupts: [
          {
            id: interruptId,
            reason: 'tanstack:client_tool_execution',
            message: 'Client tool validate_notebook is ready to run',
            toolCallId,
            responseSchema,
            metadata: {
              kind: 'client_tool',
              toolName: 'validate_notebook',
              input: {},
              [INTERRUPT_BINDING_METADATA_KEY]: {
                v: INTERRUPT_BINDING_VERSION,
                kind: 'client-tool-execution',
                interruptId,
                interruptedRunId: runId,
                generation: 0,
                toolName: 'validate_notebook',
                toolCallId,
                outputSchemaHash: hashSchemaInput(
                  validateNotebookAiTool.outputSchema,
                ),
                responseSchemaHash: digestInterruptJson(
                  canonicalInterruptJson(responseSchema),
                ),
              },
            },
          },
        ],
      },
    },
  )
  return events
}

function validationResultEvent(index: number): StreamChunk {
  return {
    type: EventType.TOOL_CALL_RESULT,
    messageId: `tool-result-${index + 1}`,
    toolCallId: `validation-${index + 1}`,
    content: JSON.stringify(validationOutcome(index).result),
    role: 'tool',
    state: 'output-available',
  }
}

function validationOutcome(index: number): NotebookAiStreamValidationOutcome {
  if (index === 3) return { result: { status: 'complete' } }
  return {
    result: {
      status: 'repair',
      phase: 'compile',
      diagnostic: `Compile failure ${index + 1}`,
      evidence: `Compiler output ${index + 1}`,
    },
    repair: {
      priorEvidenceFingerprints: [index.toString(16).padStart(16, '0')],
      blockedMutationFingerprints: [],
    },
  }
}

function readRequestRunId(requestBody: Record<string, unknown>) {
  if (typeof requestBody.runId !== 'string') {
    throw new Error('Notebook AI request run id was missing')
  }
  return requestBody.runId
}

function readForwardedProps(requestBody: Record<string, unknown> | undefined) {
  return readRecord(requestBody?.forwardedProps)
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected an object')
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
