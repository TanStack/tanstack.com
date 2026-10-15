import assert from 'node:assert/strict'
import test from 'node:test'
import { builderAiEvalCases } from '../scripts/builder-ai-eval/cases'
import {
  findCalls,
  gradeBuilderAiWorkspace,
} from '../scripts/builder-ai-eval/grade'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { BuilderAiExecution } from '../src/utils/builder-ai'

test('builder eval matrix has unique declarative cases', () => {
  assert.deepEqual(
    builderAiEvalCases.map(({ id }) => id),
    [
      'charts-basic-bar',
      'react-query-refetch',
      'react-table-people',
      'tanstack-start-routes',
    ],
  )
  assert.equal(
    new Set(builderAiEvalCases.map(({ id }) => id)).size,
    builderAiEvalCases.length,
  )
  assert.equal(
    builderAiEvalCases.find(({ id }) => id === 'charts-basic-bar')?.prompt,
    'Build me a bar chart using TanStack Charts.',
  )
})

test('workspace grader recognizes subpath imports without library branches', () => {
  const execution = clientExecution(`
    import { Chart } from '@tanstack/charts/react'
    import { scaleBand } from '@tanstack/charts/scales/band'
    export default function App() { return Chart && scaleBand }
  `)
  const checks = gradeBuilderAiWorkspace(execution, [
    {
      kind: 'runtime',
      description: 'client runtime',
      runtime: 'client',
    },
    {
      kind: 'module',
      description: 'charts import',
      specifier: '@tanstack/charts',
    },
    {
      kind: 'source',
      description: 'scale API',
      pattern: /\bscaleBand\b/,
    },
  ])

  assert.ok(
    checks.every(({ passed }) => passed),
    JSON.stringify(checks),
  )
})

test('workspace grader rejects a missing required API and forbidden fallback', () => {
  const execution = clientExecution(`
    import { band } from '@tanstack/charts/scales/band'
    export default function App() { return band }
  `)
  const checks = gradeBuilderAiWorkspace(execution, [
    {
      kind: 'source',
      description: 'requires the verified export',
      pattern: /\bscaleBand\b/,
    },
    {
      kind: 'source',
      description: 'forbids the invalid export',
      pattern: /import\s*\{\s*band\s*\}/,
      negate: true,
    },
  ])

  assert.deepEqual(
    checks.map(({ passed }) => passed),
    [false, false],
  )
})

test('workspace grader requires executable calls instead of identifier text', () => {
  const execution = clientExecution(`
    import { useQuery } from '@tanstack/react-query'
    // useQuery({ queryKey: ['unused'] })
    const example = 'useQuery()'
    export default function App() { return example }
  `)

  assert.deepEqual(findCalls(execution, 'useQuery'), [])
  assert.deepEqual(
    gradeBuilderAiWorkspace(execution, [
      {
        kind: 'call',
        description: 'executes useQuery',
        callee: 'useQuery',
      },
    ]).map(({ passed }) => passed),
    [false],
  )
})

test('workspace grader validates runtime and manifest dependencies generically', () => {
  const execution: BuilderAiExecution = {
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['dev'] },
    },
    workspace: createExampleWorkspace({
      entry: '/src/main.tsx',
      files: {
        '/src/main.tsx': 'export default function App() {}',
        '/package.json': JSON.stringify({
          dependencies: { '@tanstack/react-start': '1.168.26' },
        }),
      },
    }),
  }
  const checks = gradeBuilderAiWorkspace(execution, [
    {
      kind: 'runtime',
      description: 'webcontainer runtime',
      runtime: 'webcontainer',
    },
    {
      kind: 'dependency',
      description: 'start dependency',
      packageName: '@tanstack/react-start',
    },
    {
      kind: 'dependency',
      description: 'router dependency',
      packageName: '@tanstack/react-router',
    },
  ])

  assert.deepEqual(
    checks.map(({ passed }) => passed),
    [true, true, false],
  )
})

function clientExecution(source: string): BuilderAiExecution {
  return {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': source },
    }),
  }
}
