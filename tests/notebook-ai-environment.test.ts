import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyExampleEnvironmentSnapshot,
  type ExampleWorkbenchRunResult,
} from '../src/utils/example-run-observation'
import {
  createNotebookAiEnvironmentSnapshot,
  formatNotebookAiEnvironmentEvidence,
  shouldRestoreNotebookAiCheckpoint,
  validateNotebookAiCompletion,
} from '../src/utils/notebook-ai-environment'
import {
  createExampleWorkspace,
  type ExampleRuntime,
} from '../src/utils/example-workspace'
import type { NotebookAiExecution } from '../src/utils/notebook-ai'

const workspace = createExampleWorkspace({
  entry: '/index.tsx',
  environment: 'client',
  files: { '/index.tsx': 'export default 1' },
})

function execution(runtime: ExampleRuntime | null = null): NotebookAiExecution {
  return { runtime, workspace }
}

function runResult(
  result:
    | { ok: true }
    | { ok: false; phase: 'compile' | 'runtime' | 'timeout'; message: string },
  options: {
    observed?: boolean
    console?: ReadonlyArray<{ level: 'error' | 'log' | 'warn'; text: string }>
    processTail?: string
  } = {},
): ExampleWorkbenchRunResult {
  const snapshot = createEmptyExampleEnvironmentSnapshot({
    runId: 'run-1',
    runtime: 'client',
    workspaceRevision: 3,
  })
  snapshot.preview = {
    observed: options.observed ?? true,
    title: 'Notebook',
    url: '/chart',
  }
  snapshot.console = {
    entries: options.console ?? [],
    omittedEntries: 0,
  }
  snapshot.process = options.processTail
    ? { omittedCharacters: 0, tail: options.processTail }
    : null
  return { ...result, snapshot }
}

test('validates a healthy observed preview', () => {
  const snapshot = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.deepEqual(validateNotebookAiCompletion(snapshot), {
    status: 'complete',
  })
})

test('requires repair for structured compile and runtime failures', () => {
  for (const phase of ['compile', 'runtime'] as const) {
    const snapshot = createNotebookAiEnvironmentSnapshot({
      actualExecution: execution(),
      expectedExecution: execution(),
      run: runResult({ ok: false, phase, message: `${phase} failed` }),
    })

    assert.deepEqual(validateNotebookAiCompletion(snapshot), {
      status: 'repair',
      phase,
      diagnostic: `${phase} failed`,
    })
  }
})

test('stops on non-repair failures and runtime mismatches', () => {
  for (const phase of [
    'aborted',
    'superseded',
    'timeout',
    'unsupported',
  ] as const) {
    const snapshot = createNotebookAiEnvironmentSnapshot({
      actualExecution: execution(),
      expectedExecution: execution(),
      run: {
        ok: false,
        phase,
        message: `${phase} run`,
        snapshot: runResult({
          ok: false,
          phase: 'timeout',
          message: 'timeout',
        }).snapshot,
      },
    })
    assert.equal(validateNotebookAiCompletion(snapshot).status, 'stop')
  }

  const mismatchedRuntime = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })
  mismatchedRuntime.expectedRuntime = 'webcontainer'
  assert.equal(validateNotebookAiCompletion(mismatchedRuntime).status, 'stop')
})

test('fails closed without a browser observation or with console errors', () => {
  const missingPreview = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }, { observed: false }),
  })
  assert.equal(validateNotebookAiCompletion(missingPreview).status, 'stop')

  const consoleFailure = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult(
      { ok: true },
      { console: [{ level: 'error', text: 'render failed' }] },
    ),
  })
  assert.deepEqual(validateNotebookAiCompletion(consoleFailure), {
    status: 'repair',
    phase: 'runtime',
    diagnostic: 'render failed',
  })
})

test('preserves a concurrently edited execution instead of rolling it back', () => {
  const changedExecution = {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': 'export default 2' },
    }),
  } satisfies NotebookAiExecution
  const snapshot = createNotebookAiEnvironmentSnapshot({
    actualExecution: changedExecution,
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.deepEqual(validateNotebookAiCompletion(snapshot), {
    status: 'stop',
    preserveCurrentExecution: true,
    diagnostic:
      'The notebook changed while the staged execution was being validated.',
  })
})

test('uses exact execution equality instead of repair fingerprints', () => {
  const snapshot = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.equal(
    validateNotebookAiCompletion({
      ...snapshot,
      executionMatches: false,
    }).status,
    'stop',
  )
})

test('restores a checkpoint only while the exact staged execution is current', () => {
  const staged = execution()
  assert.equal(
    shouldRestoreNotebookAiCheckpoint({
      currentExecution: execution(),
      lastStagedExecution: staged,
    }),
    true,
  )
  assert.equal(
    shouldRestoreNotebookAiCheckpoint({
      currentExecution: {
        ...execution(),
        workspace: createExampleWorkspace({
          entry: '/index.tsx',
          environment: 'client',
          files: { '/index.tsx': 'export default 2' },
        }),
      },
      lastStagedExecution: staged,
    }),
    false,
  )
})

test('formats bounded runtime evidence without workspace source', () => {
  const snapshot = createNotebookAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult(
      { ok: false, phase: 'runtime', message: 'failed' },
      {
        console: [
          { level: 'warn', text: 'deprecated option' },
          { level: 'error', text: 'render failed' },
        ],
        processTail: 'server output',
      },
    ),
  })
  const evidence = formatNotebookAiEnvironmentEvidence(snapshot)

  assert.match(evidence, /Notebook at \/chart/)
  assert.match(evidence, /\[error\] render failed/)
  assert.match(evidence, /server output/)
  assert.doesNotMatch(evidence, /export default 1/)
})
