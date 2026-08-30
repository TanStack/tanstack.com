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
import { defineByok, memoryStorage } from '@tanstack/ai-client/byok'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { BuilderAiResponse } from '../src/utils/builder-ai'
import type { BuilderAiActivityEvent } from '../src/utils/builder-ai-activity'
import {
  runBuilderAiStream,
  type BuilderAiStreamValidationOutcome,
} from '../src/utils/builder-ai-stream.client'
import { validateBuilderAiTool } from '../src/utils/builder-ai-validation'

const response: BuilderAiResponse = {
  message: 'Updated builder.',
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
  name: 'builder.project.execution',
  value: response,
}

const finalEvent: StreamChunk = {
  type: EventType.RUN_FINISHED,
  threadId: 'thread-1',
  runId: 'run-1',
  outcome: { type: 'success' },
  finishReason: 'stop',
}

test('builder stream accepts execution immediately followed by the final run event', async () => {
  await withStream([runStarted, executionEvent, finalEvent], async () => {
    assert.deepEqual(await runStream(), response)
  })
})

test('builder stream sends BYOK headers outside the body without validation', async () => {
  const apiKey = 'sk-openai-direct-test'
  const byok = defineByok({ storage: memoryStorage() })
  await byok.update('openai', apiKey)
  const requestBodies: Array<Record<string, unknown>> = []
  const requestHeaders: Array<Headers> = []

  await withStreams(
    [() => [runStarted, executionEvent, finalEvent]],
    requestBodies,
    requestHeaders,
    async () => {
      assert.deepEqual(
        await runBuilderAiStream({
          endpoint: 'http://builder.test/assist',
          forwardedProps: { provider: 'openai' },
          messages: [{ role: 'user', content: 'Update the builder.' }],
          signal: new AbortController().signal,
          threadId: 'thread-1',
          activityId: 'activity-1',
          byok,
          byokProvider: 'openai',
        }),
        response,
      )
    },
  )

  assert.equal(requestHeaders[0]?.get('x-byok-openai'), apiKey)
  assert.equal(JSON.stringify(requestBodies).includes(apiKey), false)
})

test('builder stream rejects execution without a final run event', async () => {
  await withStream([runStarted, executionEvent], async () => {
    await assert.rejects(runStream(), /ended before the run finished/)
  })
})

test('builder stream rejects events between execution and the final run event', async () => {
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

test('builder stream ignores intermediate tool-loop finishes without execution', async () => {
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

test('builder stream rejects execution attached to an intermediate tool finish', async () => {
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

test('builder stream completes tool activity from result events after input ends', async () => {
  const activityEvents: Array<BuilderAiActivityEvent> = []
  await withStream(
    [
      runStarted,
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: 'read-1',
        toolCallName: 'read_file',
        timestamp: 1,
      },
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: 'read-1',
        delta: '{"path":"/index.tsx"}',
        timestamp: 2,
      },
      {
        type: EventType.TOOL_CALL_END,
        toolCallId: 'read-1',
        input: { path: '/index.tsx' },
        timestamp: 3,
      },
      {
        type: EventType.TOOL_CALL_RESULT,
        messageId: 'read-result-1',
        toolCallId: 'read-1',
        content: '{"content":"source"}',
        role: 'tool',
        timestamp: 4,
      },
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: 'run-1',
        toolCallName: 'run_project',
        timestamp: 5,
      },
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: 'run-1',
        delta: '{}',
        timestamp: 6,
      },
      {
        type: EventType.TOOL_CALL_END,
        toolCallId: 'run-1',
        input: {},
        timestamp: 7,
      },
      {
        type: EventType.TOOL_CALL_RESULT,
        messageId: 'run-result-1',
        toolCallId: 'run-1',
        content: '{"error":"Compile failed"}',
        role: 'tool',
        metadata: { tanstack: { state: 'output-error' } },
        timestamp: 8,
      },
      executionEvent,
      finalEvent,
    ],
    async () => {
      await runBuilderAiStream({
        endpoint: 'http://builder.test/assist',
        forwardedProps: {},
        messages: [{ role: 'user', content: 'Update the builder.' }],
        signal: new AbortController().signal,
        threadId: 'thread-1',
        activityId: 'activity-1',
        onActivityEvent: (event) => activityEvents.push(event),
      })
    },
  )

  const readEvents = activityEvents.filter(
    (event) => 'itemId' in event && event.itemId.endsWith(':read-1'),
  )
  assert.deepEqual(
    readEvents.map((event) => event.type),
    ['item-started', 'item-running', 'item-running', 'item-completed'],
  )
  const readResult = readEvents.at(-1)
  assert.equal(readResult?.type, 'item-completed')
  if (readResult?.type === 'item-completed') {
    assert.deepEqual(readResult.output, { content: 'source' })
  }

  const runResult = activityEvents.find(
    (event) => event.type === 'item-failed' && event.itemId.endsWith(':run-1'),
  )
  assert.equal(runResult?.type, 'item-failed')
  if (runResult?.type === 'item-failed') {
    assert.equal(runResult.error, 'Compile failed')
  }
})

test('builder stream validates and repairs more than twice inside one client-tool flow', async () => {
  const openAiKey = 'sk-openai-builder-test'
  const anthropicKey = 'sk-ant-builder-test'
  const byok = defineByok({ storage: memoryStorage() })
  await byok.update('openai', openAiKey)
  await byok.update('anthropic', anthropicKey)
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
        delta: 'Updated builder.',
      },
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: 'message-5',
      },
      {
        type: EventType.CUSTOM,
        name: 'builder.project.execution',
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
  const requestHeaders: Array<Headers> = []
  let validationCount = 0
  await withStreams(streams, requestBodies, requestHeaders, async () => {
    const result = await runBuilderAiStream({
      endpoint: 'http://builder.test/assist',
      forwardedProps: { execution: response.execution },
      messages: [{ role: 'user', content: 'Update the builder.' }],
      signal: new AbortController().signal,
      threadId: 'thread-1',
      activityId: 'activity-1',
      byok,
      byokProvider: 'openai',
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
    assert.equal(requestHeaders.length, 5)

    for (const [index, headers] of requestHeaders.entries()) {
      assert.equal(
        headers.get('x-byok-openai'),
        openAiKey,
        `request ${index + 1} should include the selected key`,
      )
      assert.equal(
        headers.has('x-byok-anthropic'),
        false,
        `request ${index + 1} should not include another provider key`,
      )
      const requestJson = JSON.stringify(requestBodies[index])
      assert.equal(requestJson.includes(openAiKey), false)
      assert.equal(requestJson.includes(anthropicKey), false)
    }

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

test('builder stream rejects a changed execution that was not validated', async () => {
  const baselineExecution = {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default function App() { return null }' },
    }),
  }
  await withStream([runStarted, executionEvent, finalEvent], async () => {
    await assert.rejects(
      runBuilderAiStream({
        endpoint: 'http://builder.test/assist',
        forwardedProps: { execution: baselineExecution },
        messages: [{ role: 'user', content: 'Update the builder.' }],
        signal: new AbortController().signal,
        threadId: 'thread-1',
        activityId: 'activity-1',
        onValidate: async () => ({ result: { status: 'complete' } }),
      }),
      /without validating/,
    )
  })
})

test('builder stream stops after a terminal validation result', async () => {
  const diagnostic = 'The builder validation budget was reached.'
  const stopOutcome: BuilderAiStreamValidationOutcome = {
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
    [],
    async () => {
      await assert.rejects(
        runBuilderAiStream({
          endpoint: 'http://builder.test/assist',
          forwardedProps: { execution: response.execution },
          messages: [{ role: 'user', content: 'Update the builder.' }],
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
  return runBuilderAiStream({
    endpoint: 'http://builder.test/assist',
    forwardedProps: {},
    messages: [{ role: 'user', content: 'Update the builder.' }],
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
  requestHeaders: Array<Headers>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch
  let requestIndex = 0
  globalThis.fetch = async (_input, init) => {
    if (typeof init?.body !== 'string') {
      throw new Error('Builder AI request body was missing')
    }
    const requestBody = readRecord(JSON.parse(init.body))
    requestBodies.push(requestBody)
    requestHeaders.push(new Headers(init.headers))
    const createChunks = streams[requestIndex]
    requestIndex += 1
    if (!createChunks) throw new Error('Unexpected builder AI request')
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
  execution: BuilderAiResponse['execution']
  index: number
  runId: string
}): Array<StreamChunk> {
  const toolCallId = `validation-${index + 1}`
  const interruptId = `client_tool_${toolCallId}`
  const responseSchema = convertSchemaToJsonSchema(
    validateBuilderAiTool.outputSchema,
  )
  if (!responseSchema) {
    throw new Error('Builder validation output schema was missing')
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
          function: { name: 'validate_project', arguments: '{}' },
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
      toolCallName: 'validate_project',
      toolName: 'validate_project',
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
      input: {},
    },
    {
      type: EventType.CUSTOM,
      name: 'tool-input-available',
      value: { toolCallId, toolName: 'validate_project', input: {} },
    },
    {
      type: EventType.MESSAGES_SNAPSHOT,
      messages: [
        { id: 'user-1', role: 'user', content: 'Update the builder.' },
        ...priorMessages,
        {
          id: `assistant-${index + 1}`,
          role: 'assistant',
          toolCalls: [
            {
              id: toolCallId,
              type: 'function',
              function: { name: 'validate_project', arguments: '{}' },
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
            message: 'Client tool validate_project is ready to run',
            toolCallId,
            responseSchema,
            metadata: {
              kind: 'client_tool',
              toolName: 'validate_project',
              input: {},
              [INTERRUPT_BINDING_METADATA_KEY]: {
                v: INTERRUPT_BINDING_VERSION,
                kind: 'client-tool-execution',
                interruptId,
                interruptedRunId: runId,
                generation: 0,
                toolName: 'validate_project',
                toolCallId,
                outputSchemaHash: hashSchemaInput(
                  validateBuilderAiTool.outputSchema,
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

function validationOutcome(index: number): BuilderAiStreamValidationOutcome {
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
    throw new Error('Builder AI request run id was missing')
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
