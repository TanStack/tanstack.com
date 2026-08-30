import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyExampleEnvironmentSnapshot,
  type ExampleWorkbenchRunResult,
} from '../src/utils/example-run-observation'
import {
  createBuilderAiEnvironmentSnapshot,
  formatBuilderAiEnvironmentEvidence,
  shouldRestoreBuilderAiCheckpoint,
  validateBuilderAiCompletion,
} from '../src/utils/builder-ai-environment'
import {
  createExampleWorkspace,
  type ExampleRuntime,
} from '../src/utils/example-workspace'
import type { BuilderAiExecution } from '../src/utils/builder-ai'

const workspace = createExampleWorkspace({
  entry: '/index.tsx',
  environment: 'client',
  files: { '/index.tsx': 'export default 1' },
})

function execution(runtime: ExampleRuntime | null = null): BuilderAiExecution {
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
    title: 'Builder',
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
  const snapshot = createBuilderAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.deepEqual(validateBuilderAiCompletion(snapshot), {
    status: 'complete',
  })
})

test('requires repair for structured compile and runtime failures', () => {
  for (const phase of ['compile', 'runtime'] as const) {
    const snapshot = createBuilderAiEnvironmentSnapshot({
      actualExecution: execution(),
      expectedExecution: execution(),
      run: runResult({ ok: false, phase, message: `${phase} failed` }),
    })

    assert.deepEqual(validateBuilderAiCompletion(snapshot), {
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
    const snapshot = createBuilderAiEnvironmentSnapshot({
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
    assert.equal(validateBuilderAiCompletion(snapshot).status, 'stop')
  }

  const mismatchedRuntime = createBuilderAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })
  mismatchedRuntime.expectedRuntime = 'webcontainer'
  assert.equal(validateBuilderAiCompletion(mismatchedRuntime).status, 'stop')
})

test('fails closed without a browser observation or with console errors', () => {
  const missingPreview = createBuilderAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }, { observed: false }),
  })
  assert.equal(validateBuilderAiCompletion(missingPreview).status, 'stop')

  const consoleFailure = createBuilderAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult(
      { ok: true },
      { console: [{ level: 'error', text: 'render failed' }] },
    ),
  })
  assert.deepEqual(validateBuilderAiCompletion(consoleFailure), {
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
  } satisfies BuilderAiExecution
  const snapshot = createBuilderAiEnvironmentSnapshot({
    actualExecution: changedExecution,
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.deepEqual(validateBuilderAiCompletion(snapshot), {
    status: 'stop',
    preserveCurrentExecution: true,
    diagnostic:
      'The project changed while the staged execution was being validated.',
  })
})

test('uses exact execution equality instead of repair fingerprints', () => {
  const snapshot = createBuilderAiEnvironmentSnapshot({
    actualExecution: execution(),
    expectedExecution: execution(),
    run: runResult({ ok: true }),
  })

  assert.equal(
    validateBuilderAiCompletion({
      ...snapshot,
      executionMatches: false,
    }).status,
    'stop',
  )
})

test('restores a checkpoint only while the exact staged execution is current', () => {
  const staged = execution()
  assert.equal(
    shouldRestoreBuilderAiCheckpoint({
      currentExecution: execution(),
      lastStagedExecution: staged,
    }),
    true,
  )
  assert.equal(
    shouldRestoreBuilderAiCheckpoint({
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
  const snapshot = createBuilderAiEnvironmentSnapshot({
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
  const evidence = formatBuilderAiEnvironmentEvidence(snapshot)

  assert.match(evidence, /Builder at \/chart/)
  assert.match(evidence, /\[error\] render failed/)
  assert.match(evidence, /server output/)
  assert.doesNotMatch(evidence, /export default 1/)
})
