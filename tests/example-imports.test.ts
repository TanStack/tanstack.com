import assert from 'node:assert/strict'
import test from 'node:test'
import { getExampleWorkspaceImports } from '../src/utils/example-imports'
import { createExampleWorkspace } from '../src/utils/example-workspace'

test('resolves imported development dependencies without exposing unused ones', () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        devDependencies: {
          '@example/devtools': '1.2.3',
          vite: '8.0.0',
        },
      }),
    },
  })

  const imports = getExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/devtools', '@example/devtools/panel']),
  )

  assert.equal(
    imports['@example/devtools'],
    'https://esm.sh/@example/devtools@1.2.3',
  )
  assert.equal(
    imports['@example/devtools/panel'],
    'https://esm.sh/@example/devtools@1.2.3/panel',
  )
  assert.equal(imports.vite, undefined)
})

test('prefers dependency versions when a package is listed in both sections', () => {
  const workspace = createExampleWorkspace({
    entry: '/index.ts',
    files: {
      '/index.ts': 'export {}',
      '/package.json': JSON.stringify({
        dependencies: { '@example/shared': '2.0.0' },
        devDependencies: { '@example/shared': '1.0.0' },
      }),
    },
  })

  const imports = getExampleWorkspaceImports(
    workspace,
    workspace.files,
    new Set(['@example/shared']),
  )

  assert.equal(
    imports['@example/shared'],
    'https://esm.sh/@example/shared@2.0.0',
  )
})
