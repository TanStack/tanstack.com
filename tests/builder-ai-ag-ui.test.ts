import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import {
  getBuilderAiApiKey,
  getBuilderAiMissingKeyResponse,
  parseBuilderAiRequest,
} from '../src/routes/api/builder/assist'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import {
  streamBuilderAiResponse,
  type BuilderAiExecution,
} from '../src/utils/builder-ai'
import { getBuilderAiValidationClientToolDeclaration } from '../src/utils/builder-ai-validation'

const execution: BuilderAiExecution = {
  runtime: null,
  workspace: createExampleWorkspace({
    entry: '/index.tsx',
    files: { '/index.tsx': 'export default function App() { return null }' },
  }),
}

const forwardedProps = {
  provider: 'openai',
  model: 'gpt-5.4-mini',
  execution,
  hiddenFiles: [],
}
const apiKey = 'test-api-key'

function requestBody(messages: Array<unknown>) {
  return {
    threadId: 'thread-1',
    runId: 'run-1',
    state: {},
    messages,
    tools: [getBuilderAiValidationClientToolDeclaration()],
    context: [],
    forwardedProps,
  }
}

test('builder BYOK parses canonical AG-UI input and preserves tool history', async () => {
  const input = await parseBuilderAiRequest(
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
  assert.equal('apiKey' in input, false)
})

test('builder BYOK selects only the requested provider header', () => {
  const request = new Request('https://tanstack.com/api/builder/assist', {
    headers: {
      'x-byok-anthropic': 'anthropic-test-key',
      'x-byok-openai': 'openai-test-key',
    },
  })

  assert.equal(getBuilderAiApiKey(request, 'openai'), 'openai-test-key')
  assert.equal(getBuilderAiApiKey(request, 'anthropic'), 'anthropic-test-key')
})

test('builder BYOK ignores server keys and returns the official missing-key response', async () => {
  const existingOpenAiKey = process.env.OPENAI_API_KEY
  const existingAnthropicKey = process.env.ANTHROPIC_API_KEY
  process.env.OPENAI_API_KEY = 'server-openai-key'
  process.env.ANTHROPIC_API_KEY = 'server-anthropic-key'

  try {
    const request = new Request('https://tanstack.com/api/builder/assist')
    assert.equal(getBuilderAiApiKey(request, 'openai'), null)
    assert.equal(getBuilderAiApiKey(request, 'anthropic'), null)

    const response = getBuilderAiMissingKeyResponse('openai')
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('content-type'), 'application/json')
    assert.match(await response.text(), /"type":"byok_missing"/)
    assert.match(
      await getBuilderAiMissingKeyResponse('anthropic').text(),
      /"provider":"anthropic"/,
    )
  } finally {
    if (existingOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = existingOpenAiKey
    }
    if (existingAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = existingAnthropicKey
    }
  }
})

test('builder BYOK rejects API keys in the request body', async () => {
  await assert.rejects(
    parseBuilderAiRequest({
      ...requestBody([
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', content: 'Change the builder.' }],
          content: 'Change the builder.',
        },
      ]),
      forwardedProps: { ...forwardedProps, apiKey },
    }),
    /Invalid builder AI request/,
  )
})

test('builder BYOK rejects extra forwarded properties and untrusted client tools', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Change the builder.' }],
      content: 'Change the builder.',
    },
  ])

  await assert.rejects(
    parseBuilderAiRequest({
      ...body,
      forwardedProps: { ...forwardedProps, extra: true },
    }),
    /Invalid builder AI request/,
  )
  await assert.rejects(
    parseBuilderAiRequest({
      ...body,
      tools: [
        {
          name: 'untrusted_tool',
          description: 'Untrusted',
          parameters: { type: 'object' },
        },
      ],
    }),
    /Invalid builder AI request/,
  )
  await assert.rejects(
    parseBuilderAiRequest({
      ...body,
      tools: [
        {
          ...getBuilderAiValidationClientToolDeclaration(),
          description: 'Run arbitrary client code',
        },
      ],
    }),
    /Invalid builder AI request/,
  )
})

test('builder BYOK strictly accepts a validation-tool resume', async () => {
  const result = {
    status: 'repair',
    phase: 'compile',
    diagnostic: 'Unexpected token',
    evidence: 'Compiler: Unexpected token',
  }
  const input = await parseBuilderAiRequest({
    ...requestBody([
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', content: 'Change the builder.' }],
        content: 'Change the builder.',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            id: 'tool-1',
            name: 'validate_project',
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
            function: { name: 'validate_project', arguments: '{}' },
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

test('builder BYOK rejects uncorrelated and malformed validation resumes', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Change the builder.' }],
      content: 'Change the builder.',
    },
  ])

  await assert.rejects(
    parseBuilderAiRequest({
      ...body,
      resume: [
        {
          interruptId: 'client_tool_tool-1',
          status: 'resolved',
          payload: { status: 'complete' },
        },
      ],
    }),
    /Invalid builder AI request/,
  )
  await assert.rejects(
    parseBuilderAiRequest({
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
    /Invalid builder AI request/,
  )
  await assert.rejects(
    parseBuilderAiRequest({
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
    parseBuilderAiRequest({
      ...body,
      state: { execution },
    }),
    /Invalid builder AI request/,
  )
})

test('builder BYOK strictly preserves typed repair progress', async () => {
  const body = requestBody([
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', content: 'Repair the builder.' }],
      content: 'Repair the builder.',
    },
  ])
  const repair = {
    priorEvidenceFingerprints: ['1111111111111111'],
    blockedMutationFingerprints: ['2222222222222222'],
  }

  const input = await parseBuilderAiRequest({
    ...body,
    forwardedProps: { ...forwardedProps, repair },
  })
  assert.deepEqual(input.repair, repair)

  await assert.rejects(
    parseBuilderAiRequest({
      ...body,
      forwardedProps: {
        ...forwardedProps,
        repair: { ...repair, extra: true },
      },
    }),
    /Invalid builder AI repair context/,
  )
})

test('builder BYOK preserves AG-UI events and emits execution only before the final finish', async () => {
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
      delta: ' Updated builder. ',
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
  for await (const chunk of streamBuilderAiResponse(
    source(),
    apiKey,
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
    throw new Error('Missing builder execution event')
  }
  assert.equal(executionEvent.name, 'builder.project.execution')
  assert.deepEqual(executionEvent.value, {
    message: 'Updated builder.',
    execution,
    changedFiles: ['/index.tsx'],
    runtimeChanged: false,
    trace: { evidenceFingerprints: [], mutationFingerprints: [] },
  })
})

test('builder BYOK redacts keys from streamed and thrown errors', async () => {
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
  for await (const chunk of streamBuilderAiResponse(
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
    for await (const _chunk of streamBuilderAiResponse(
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

test('builder BYOK turns an incomplete provider stream into a terminal error', async () => {
  async function* incompleteStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.RUN_STARTED,
      threadId: 'thread-1',
      runId: 'run-1',
    }
  }

  const chunks: Array<StreamChunk> = []
  for await (const chunk of streamBuilderAiResponse(
    incompleteStream(),
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

  assert.deepEqual(chunks.at(-1), {
    type: EventType.RUN_ERROR,
    message: 'Builder AI provider stream ended before the run finished',
  })
})
