import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NotebookAiValidationBroker,
  NotebookAiValidationSubmissionError,
} from '../scripts/notebook-ai-validation-broker'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { NotebookAiLocalValidationRequest } from '../src/utils/notebook-ai-local-validation'

const unknownRequestId = '00000000-0000-4000-8000-000000000000'

test('validation broker resolves one correlated result and rejects a duplicate', async () => {
  const broker = new NotebookAiValidationBroker(1_000)
  const requests: Array<NotebookAiLocalValidationRequest> = []
  const pending = broker.waitForResult(
    createState(),
    new AbortController().signal,
    (request) => requests.push(request),
  )
  const request = requests[0]
  assert.ok(request)

  const submission = {
    requestId: request.requestId,
    result: { status: 'complete' },
  }
  broker.submit(submission)
  assert.deepEqual(await pending, submission)
  assert.throws(
    () => broker.submit(submission),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 409,
  )
  broker.close()
})

test('validation broker rejects unknown and invalid results', () => {
  const broker = new NotebookAiValidationBroker(1_000)
  assert.throws(
    () =>
      broker.submit({
        requestId: unknownRequestId,
        result: { status: 'complete' },
      }),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 404,
  )
  assert.throws(
    () =>
      broker.submit({
        requestId: unknownRequestId,
        result: { status: 'complete' },
        unexpected: true,
      }),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 400,
  )
  assert.throws(
    () =>
      broker.submit({
        requestId: unknownRequestId,
        result: {
          status: 'repair',
          phase: 'compile',
          diagnostic: 'Compile failed',
          evidence: 'Compiler output',
        },
      }),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 400,
  )
  broker.close()
})

test('validation broker removes an aborted request', async () => {
  const broker = new NotebookAiValidationBroker(1_000)
  const controller = new AbortController()
  const requests: Array<NotebookAiLocalValidationRequest> = []
  const pending = broker.waitForResult(
    createState(),
    controller.signal,
    (request) => requests.push(request),
  )
  const request = requests[0]
  assert.ok(request)

  controller.abort()
  await assert.rejects(pending, /canceled/)
  assert.throws(
    () =>
      broker.submit({
        requestId: request.requestId,
        result: { status: 'complete' },
      }),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 404,
  )
  broker.close()
})

test('validation broker removes a timed out request', async () => {
  const broker = new NotebookAiValidationBroker(5)
  const requests: Array<NotebookAiLocalValidationRequest> = []
  const pending = broker.waitForResult(
    createState(),
    new AbortController().signal,
    (request) => requests.push(request),
  )
  const request = requests[0]
  assert.ok(request)

  await assert.rejects(pending, /timed out/)
  assert.throws(
    () =>
      broker.submit({
        requestId: request.requestId,
        result: { status: 'complete' },
      }),
    (error) =>
      error instanceof NotebookAiValidationSubmissionError &&
      error.status === 404,
  )
  broker.close()
})

test('validation broker forwards typed repair context', async () => {
  const broker = new NotebookAiValidationBroker(1_000)
  const requests: Array<NotebookAiLocalValidationRequest> = []
  const pending = broker.waitForResult(
    createState(),
    new AbortController().signal,
    (request) => requests.push(request),
  )
  const request = requests[0]
  assert.ok(request)
  const submission = {
    requestId: request.requestId,
    result: {
      status: 'repair',
      phase: 'runtime',
      diagnostic: 'Runtime failed',
      evidence: 'Browser console output',
    },
    repair: {
      priorEvidenceFingerprints: ['0000000000000000'],
      blockedMutationFingerprints: ['1111111111111111'],
    },
  }

  broker.submit(submission)
  assert.deepEqual(await pending, submission)
  broker.close()
})

function createState() {
  return {
    execution: {
      runtime: null,
      workspace: createExampleWorkspace({
        entry: '/index.tsx',
        files: {
          '/index.tsx':
            'export default function App() { return <main>Ready</main> }',
        },
      }),
    },
    changedFiles: ['/index.tsx'],
    runtimeChanged: false,
    trace: {
      evidenceFingerprints: [],
      mutationFingerprints: [],
    },
  }
}
