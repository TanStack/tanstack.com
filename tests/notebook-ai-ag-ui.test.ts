import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import { parseNotebookAiRequest } from '../src/routes/api/notebook/assist'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import {
  streamNotebookAiResponse,
  type NotebookAiExecution,
} from '../src/utils/notebook-ai'
import { getNotebookAiValidationClientToolDeclaration } from '../src/utils/notebook-ai-validation'

const execution: NotebookAiExecution = {
  runtime: null,
  workspace: createExampleWorkspace({
    entry: '/index.tsx',
    files: { '/index.tsx': 'export default function App() { return null }' },
  }),
}

const forwardedProps = {
  provider: 'openai',
  model: 'gpt-5.4-mini',
  apiKey: 'test-api-key',
  execution,
  hiddenFiles: [],
}

function requestBody(messages: Array<unknown>) {
  return {
    threadId: 'thread-1',
    runId: 'run-1',
    state: {},
    messages,
    tools: [getNotebookAiValidationClientToolDeclaration()],
    context: [],
    forwardedProps,
  }
}

test('notebook BYOK parses canonical AG-UI input and preserves tool history', async () => {
  const input = await parseNotebookAiRequest(
    requestBody([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            id: 'tool-1',
            name: 'read_file',
            arguments: '{"path":"/index.tsx"}',
            state: 'complete',
          },
          {
            type: 'tool-result',
            toolCallId: 'tool-1',
            content: '{"path":"/index.tsx"}',
            state: 'complete',
          },
        ],
        toolCalls: [
          {
            id: 'tool-1',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: '{"path":"/index.tsx"}',
            },
          },
        ],
      },
      {
        id: 'tool-tool-1',
        role: 'tool',
        toolCallId: 'tool-1',
        content: '{"path":"/index.tsx"}',
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', content: 'Make the title blue.' }],
        content: 'Make the title blue.',
      },
    ]),
  )

  assert.equal(input.threadId, 'thread-1')
  assert.equal(input.runId, 'run-1')
  assert.equal(input.provider, 'openai')
  assert.equal(input.messages.length, 3)
  assert.deepEqual(input.execution, execution)
})

test('notebook BYOK rejects extra forwarded properties and untrusted client tools', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Change the notebook.' }],
      content: 'Change the notebook.',
    },
  ])

  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      forwardedProps: { ...forwardedProps, extra: true },
    }),
    /Invalid notebook AI request/,
  )
  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      tools: [
        {
          name: 'untrusted_tool',
          description: 'Untrusted',
          parameters: { type: 'object' },
        },
      ],
    }),
    /Invalid notebook AI request/,
  )
  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      tools: [
        {
          ...getNotebookAiValidationClientToolDeclaration(),
          description: 'Run arbitrary client code',
        },
      ],
    }),
    /Invalid notebook AI request/,
  )
})

test('notebook BYOK strictly accepts a validation-tool resume', async () => {
  const result = {
    status: 'repair',
    phase: 'compile',
    diagnostic: 'Unexpected token',
    evidence: 'Compiler: Unexpected token',
  }
  const input = await parseNotebookAiRequest({
    ...requestBody([
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', content: 'Change the notebook.' }],
        content: 'Change the notebook.',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            id: 'tool-1',
            name: 'validate_notebook',
            arguments: '{}',
            state: 'complete',
          },
          {
            type: 'tool-result',
            toolCallId: 'tool-1',
            content: JSON.stringify(result),
            state: 'complete',
          },
        ],
        toolCalls: [
          {
            id: 'tool-1',
            type: 'function',
            function: { name: 'validate_notebook', arguments: '{}' },
          },
        ],
      },
    ]),
    runId: 'run-2',
    parentRunId: 'run-1',
    resume: [
      {
        interruptId: 'client_tool_tool-1',
        status: 'resolved',
        payload: result,
      },
    ],
  })

  assert.equal(input.parentRunId, 'run-1')
  assert.deepEqual(input.resume, [
    {
      interruptId: 'client_tool_tool-1',
      status: 'resolved',
      payload: result,
    },
  ])
  assert.equal(input.messages.at(-1)?.role, 'assistant')
})

test('notebook BYOK rejects uncorrelated and malformed validation resumes', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Change the notebook.' }],
      content: 'Change the notebook.',
    },
  ])

  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      resume: [
        {
          interruptId: 'client_tool_tool-1',
          status: 'resolved',
          payload: { status: 'complete' },
        },
      ],
    }),
    /Invalid notebook AI request/,
  )
  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      parentRunId: 'run-1',
      resume: [
        {
          interruptId: 'client_tool_tool-1',
          status: 'resolved',
          payload: {
            status: 'repair',
            phase: 'compile',
            diagnostic: 'Unexpected token',
          },
        },
      ],
    }),
    /Invalid notebook AI request/,
  )
  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      parentRunId: 'run-1',
      resume: [
        {
          interruptId: 'client_tool_tool-1',
          status: 'approved',
          payload: { status: 'complete' },
        },
      ],
    }),
    /status must be "resolved" or "cancelled"/,
  )
  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      state: { execution },
    }),
    /Invalid notebook AI request/,
  )
})

test('notebook BYOK strictly preserves typed repair progress', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Repair the notebook.' }],
      content: 'Repair the notebook.',
    },
  ])
  const repair = {
    priorEvidenceFingerprints: ['1111111111111111'],
    blockedMutationFingerprints: ['2222222222222222'],
  }

  const input = await parseNotebookAiRequest({
    ...body,
    forwardedProps: { ...forwardedProps, repair },
  })
  assert.deepEqual(input.repair, repair)

  await assert.rejects(
    parseNotebookAiRequest({
      ...body,
      forwardedProps: {
        ...forwardedProps,
        repair: { ...repair, extra: true },
      },
    }),
    /Invalid notebook AI repair context/,
  )
})

test('notebook BYOK preserves AG-UI events and emits execution only before the final finish', async () => {
  const sourceChunks: Array<StreamChunk> = [
    {
      type: EventType.TOOL_CALL_START,
      toolCallId: 'tool-1',
      toolCallName: 'read_file',
      toolName: 'read_file',
    },
    {
      type: EventType.TOOL_CALL_ARGS,
      toolCallId: 'tool-1',
      delta: '{"path":"/index.tsx"}',
    },
    {
      type: EventType.TOOL_CALL_END,
      toolCallId: 'tool-1',
      toolCallName: 'read_file',
      toolName: 'read_file',
    },
    {
      type: EventType.RUN_FINISHED,
      threadId: 'thread-1',
      runId: 'run-1',
      finishReason: 'tool_calls',
    },
    {
      type: EventType.TOOL_CALL_RESULT,
      messageId: 'tool-result-1',
      toolCallId: 'tool-1',
      content: '{"path":"/index.tsx"}',
    },
    {
      type: EventType.TEXT_MESSAGE_START,
      messageId: 'message-1',
      role: 'assistant',
    },
    {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'message-1',
      delta: ' Updated notebook. ',
    },
    {
      type: EventType.RUN_FINISHED,
      threadId: 'thread-1',
      runId: 'run-1',
      finishReason: 'stop',
    },
  ]

  async function* source(): AsyncGenerator<StreamChunk> {
    yield* sourceChunks
  }

  const chunks: Array<StreamChunk> = []
  for await (const chunk of streamNotebookAiResponse(
    source(),
    forwardedProps.apiKey,
    (message) => ({
      message,
      execution,
      changedFiles: ['/index.tsx'],
      runtimeChanged: false,
      trace: { evidenceFingerprints: [], mutationFingerprints: [] },
    }),
  )) {
    chunks.push(chunk)
  }

  assert.deepEqual(
    chunks.filter((chunk) => chunk.type !== EventType.CUSTOM),
    sourceChunks,
  )
  assert.equal(
    chunks.filter((chunk) => chunk.type === EventType.CUSTOM).length,
    1,
  )
  assert.equal(chunks.at(-1)?.type, EventType.RUN_FINISHED)
  const executionEvent = chunks.at(-2)
  assert.equal(executionEvent?.type, EventType.CUSTOM)
  if (executionEvent?.type !== EventType.CUSTOM) {
    throw new Error('Missing notebook execution event')
  }
  assert.equal(executionEvent.name, 'notebook.execution')
  assert.deepEqual(executionEvent.value, {
    message: 'Updated notebook.',
    execution,
    changedFiles: ['/index.tsx'],
    runtimeChanged: false,
    trace: { evidenceFingerprints: [], mutationFingerprints: [] },
  })
})

test('notebook BYOK redacts keys from streamed and thrown errors', async () => {
  const apiKey = 'secret-key'

  async function* errorEventStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.RUN_ERROR,
      message: `Provider rejected ${apiKey}`,
      error: { message: `Provider rejected ${apiKey}` },
      rawEvent: { apiKey },
    }
  }

  const chunks: Array<StreamChunk> = []
  for await (const chunk of streamNotebookAiResponse(
    errorEventStream(),
    apiKey,
    () => ({
      message: '',
      execution,
      changedFiles: [],
      runtimeChanged: false,
      trace: { evidenceFingerprints: [], mutationFingerprints: [] },
    }),
  )) {
    chunks.push(chunk)
  }

  assert.equal(JSON.stringify(chunks).includes(apiKey), false)
  assert.match(JSON.stringify(chunks), /\[redacted\]/)

  async function* thrownErrorStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.RUN_STARTED,
      threadId: 'thread-1',
      runId: 'run-1',
    }
    throw new Error(`Request failed with ${apiKey}`)
  }

  await assert.rejects(async () => {
    for await (const _chunk of streamNotebookAiResponse(
      thrownErrorStream(),
      apiKey,
      () => ({
        message: '',
        execution,
        changedFiles: [],
        runtimeChanged: false,
        trace: { evidenceFingerprints: [], mutationFingerprints: [] },
      }),
    )) {
      // Consume the stream.
    }
  }, /Request failed with \[redacted\]/)
})

test('notebook BYOK turns an incomplete provider stream into a terminal error', async () => {
  async function* incompleteStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.RUN_STARTED,
      threadId: 'thread-1',
      runId: 'run-1',
    }
  }

  const chunks: Array<StreamChunk> = []
  for await (const chunk of streamNotebookAiResponse(
    incompleteStream(),
    forwardedProps.apiKey,
    () => ({
      message: '',
      execution,
      changedFiles: [],
      runtimeChanged: false,
      trace: { evidenceFingerprints: [], mutationFingerprints: [] },
    }),
  )) {
    chunks.push(chunk)
  }

  assert.deepEqual(chunks.at(-1), {
    type: EventType.RUN_ERROR,
    message: 'Notebook AI provider stream ended before the run finished',
  })
})
