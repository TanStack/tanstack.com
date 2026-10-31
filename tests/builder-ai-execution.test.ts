import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getBuilderAiHiddenFiles,
  requiresBuilderWorkbenchReset,
} from '../src/utils/builder-ai-execution'
import {
  createExampleWorkspace,
  type ExampleRuntime,
} from '../src/utils/example-workspace'

test('builder AI execution detects runtime and WebContainer file changes', () => {
  const runtime = {
    type: 'webcontainer',
    install: { command: 'pnpm', args: ['install'] },
    start: { command: 'pnpm', args: ['run', 'dev'] },
  } satisfies ExampleRuntime
  const client = createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: { '/index.tsx': 'export default 1' },
  })
  const editedClient = createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: { '/index.tsx': 'export default 2' },
  })
  assert.equal(
    requiresBuilderWorkbenchReset(null, client, {
      runtime: null,
      workspace: editedClient,
    }),
    false,
  )

  const webContainer = createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: {
      '/index.tsx': 'export default 2',
      '/package.json': '{}',
    },
  })
  assert.equal(
    requiresBuilderWorkbenchReset(null, client, {
      runtime,
      workspace: webContainer,
    }),
    true,
  )
  assert.equal(
    requiresBuilderWorkbenchReset(runtime, webContainer, {
      runtime,
      workspace: createExampleWorkspace({
        entry: '/index.tsx',
        environment: 'client',
        files: {
          '/index.tsx': 'export default 2',
          '/package.json': '{"dependencies":{}}',
        },
      }),
    }),
    true,
  )
})

test('builder AI hidden files follow the validated workspace', () => {
  const workspace = createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: {
      '/.tanstack/current.json': '{}',
      '/index.tsx': 'export default 1',
    },
  })

  assert.deepEqual(
    getBuilderAiHiddenFiles(
      ['/private.txt', '/.tanstack/removed.json'],
      workspace,
    ),
    ['/private.txt', '/.tanstack/current.json'],
  )
})
