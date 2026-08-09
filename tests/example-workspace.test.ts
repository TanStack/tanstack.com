import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
} from '../src/utils/example-project'
import {
  createExampleWorkspace,
  parseExampleWorkspace,
  serializeExampleWorkspace,
} from '../src/utils/example-workspace'

describe('example workspaces', () => {
  test('serialize files and imports canonically', () => {
    const left = createExampleWorkspace({
      entry: '/src/main.tsx',
      files: {
        '/src/main.tsx': 'import "./app"',
        '/src/app.tsx': 'export default null',
      },
      imports: {
        react: 'https://esm.sh/react@19.2.3',
        '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.7.2',
      },
    })
    const right = createExampleWorkspace({
      entry: '/src/main.tsx',
      files: {
        '/src/app.tsx': 'export default null',
        '/src/main.tsx': 'import "./app"',
      },
      imports: {
        '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.7.2',
        react: 'https://esm.sh/react@19.2.3',
      },
    })

    assert.equal(
      serializeExampleWorkspace(left),
      serializeExampleWorkspace(right),
    )
  })

  test('strictly rejects ambiguous or incomplete persisted workspaces', () => {
    const valid = {
      version: 1,
      entry: '/src/main.tsx',
      files: { '/src/main.tsx': '' },
    }

    assert.throws(() => parseExampleWorkspace({ ...valid, unknown: true }))
    assert.throws(() =>
      parseExampleWorkspace({
        ...valid,
        files: { '/src/../main.tsx': '' },
      }),
    )
    assert.throws(() =>
      parseExampleWorkspace({ ...valid, entry: '/src/missing.tsx' }),
    )
    assert.throws(() => parseExampleWorkspace({ ...valid, imports: [] }))
  })

  test('round-trips the complete shared project contract', () => {
    const source = JSON.stringify({
      version: 1,
      title: 'Sorted bars',
      description: 'A browser-only Charts example.',
      initialFile: '/src/chart.tsx',
      workspace: {
        version: 1,
        entry: '/src/main.tsx',
        files: {
          '/src/chart.tsx': 'export const chart = null',
          '/src/main.tsx': 'export default null',
        },
        imports: {
          '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.7.2',
        },
      },
    })

    assert.equal(
      serializeSharedExampleProject(
        parseSharedExampleProject(JSON.parse(source)),
      ),
      source,
    )
  })

  test('rejects an initial file outside the shared workspace', () => {
    assert.throws(() =>
      parseSharedExampleProject({
        version: 1,
        title: 'Sorted bars',
        description: '',
        initialFile: '/src/missing.tsx',
        workspace: {
          version: 1,
          entry: '/src/main.tsx',
          files: { '/src/main.tsx': '' },
        },
      }),
    )
  })
})
