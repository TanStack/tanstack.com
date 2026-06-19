import assert from 'node:assert/strict'
import { projectLocalBuilderTimeline } from '../src/builder/projection'
import type { LocalBuilderTimelineEvent } from '../src/builder/projection'

const createdAt = '2026-06-18T12:00:00.000Z'
const projectId = 'assistant-stream-project'
const runId = 'assistant-stream-run'
const sessionId = 'assistant-stream-session'

const timeline = [
  event(0, 'session.input.received', {
    clientRequestId: 'assistant-stream-request',
    messageId: 'user-message',
    text: 'Build a todo app',
  }),
  event(1, 'run.started', {
    inputEventId: 'assistant-stream-event-0',
    runId,
  }),
  event(2, 'assistant.message.started', {
    messageId: 'assistant-message',
    runId,
  }),
  event(3, 'assistant.message.delta', {
    delta: 'I will inspect ',
    messageId: 'assistant-message',
    runId,
  }),
  event(4, 'assistant.message.delta', {
    delta: 'the app.',
    messageId: 'assistant-message',
    runId,
  }),
  event(5, 'assistant.message.completed', {
    messageId: 'assistant-message',
    runId,
    text: 'I will inspect the app.',
  }),
  event(6, 'agent.event.recorded', {
    id: 'tool-result-row',
    message: 'File read',
    name: 'agent.tool.readFile',
    path: 'src/routes/index.tsx',
    runId,
    status: 'finished',
    toolCallId: 'tool-call-1',
  }),
] satisfies Array<LocalBuilderTimelineEvent>

const projection = projectLocalBuilderTimeline(timeline)
const assistantMessages = projection
  .filter(
    (stateEvent) =>
      stateEvent.type === 'messages' && stateEvent.key === 'assistant-message',
  )
  .map((stateEvent) => stateEvent.value)
  .filter(isRecord)

assert.deepEqual(
  assistantMessages.map((message) => message.status),
  ['streaming', 'streaming', 'streaming', 'complete'],
  'assistant stream should project start, deltas, and completion',
)
assert.deepEqual(
  assistantMessages.map((message) => message.content),
  ['', 'I will inspect ', 'I will inspect the app.', 'I will inspect the app.'],
  'assistant deltas should accumulate into message content',
)

const toolEvent = projection
  .filter((stateEvent) => stateEvent.type === 'agentEvents')
  .map((stateEvent) => stateEvent.value)
  .find(isRecord)

assert.equal(
  toolEvent?.toolCallId,
  'tool-call-1',
  'tool call id should survive projection',
)

console.log('Forge assistant stream projection verifier passed')

function event<TType extends LocalBuilderTimelineEvent['type']>(
  index: number,
  type: TType,
  payload: Extract<LocalBuilderTimelineEvent, { type: TType }>['payload'],
): Extract<LocalBuilderTimelineEvent, { type: TType }> {
  return {
    createdAt,
    eventId: `assistant-stream-event-${index}`,
    producer: {
      epoch: 'assistant-stream-fixture',
      id: 'assistant-stream-producer',
      kind: index === 0 ? 'ui' : 'agent',
      seq: index,
    },
    projectId,
    runId: index === 0 ? undefined : runId,
    schemaVersion: 1,
    sessionId,
    type,
    payload,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
