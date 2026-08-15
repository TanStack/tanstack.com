import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
} from '../src/utils/example-project'
import {
  createExampleWorkspace,
  decodeExampleBinaryFile,
  encodeExampleBinaryFile,
  parseExampleWorkspace,
  serializeExampleWorkspace,
} from '../src/utils/example-workspace'

describe('example workspaces', () => {
  test('serialize files and imports canonically', () => {
    const left = createExampleWorkspace({
      entry: '/src/main.tsx',
      environment: 'charts-react',
      files: {
        '/src/main.tsx': 'import "./app"',
        '/src/app.tsx': 'export default null',
      },
      imports: {
        react: 'https://esm.sh/react@19.2.3',
        '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.10.0',
      },
    })
    const right = createExampleWorkspace({
      entry: '/src/main.tsx',
      environment: 'charts-react',
      files: {
        '/src/app.tsx': 'export default null',
        '/src/main.tsx': 'import "./app"',
      },
      imports: {
        '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.10.0',
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
    assert.throws(() =>
      parseExampleWorkspace({ ...valid, environment: 'unknown' }),
    )
  })

  test('round-trips the complete shared project contract', () => {
    const source = JSON.stringify({
      version: 1,
      title: 'Sorted bars',
      description: 'A browser-only Charts example.',
      initialFile: '/src/chart.tsx',
      hiddenFiles: ['/src/main.tsx'],
      workspace: {
        version: 1,
        entry: '/src/main.tsx',
        environment: 'charts-react',
        files: {
          '/src/chart.tsx': 'export const chart = null',
          '/src/main.tsx': 'export default null',
        },
        imports: {
          '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.10.0',
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

  test('round-trips binary assets through shared projects', () => {
    const source = JSON.stringify({
      version: 1,
      title: 'Router SSR',
      description: 'A repository-backed example with a binary favicon.',
      initialFile: '/src/main.tsx',
      workspace: {
        version: 1,
        entry: '/src/main.tsx',
        files: {
          '/src/main.tsx': 'export default null',
        },
        binaryFiles: { '/public/favicon.ico': 'AAECA/8=' },
      },
    })

    const project = parseSharedExampleProject(JSON.parse(source))

    assert.equal(
      project.workspace.binaryFiles?.['/public/favicon.ico'],
      'AAECA/8=',
    )
    assert.equal(serializeSharedExampleProject(project), source)
    assert.deepEqual(
      parseExampleWorkspace(
        JSON.parse(serializeExampleWorkspace(project.workspace)),
      ),
      project.workspace,
    )
  })

  test('normalizes, validates, and decodes binary files exactly', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 128, 255])
    const source = encodeExampleBinaryFile(bytes)
    const workspace = createExampleWorkspace({
      entry: 'src/main.ts',
      files: { 'src/main.ts': 'export {}' },
      binaryFiles: { 'public/../favicon.ico': source },
    })

    assert.deepEqual(decodeExampleBinaryFile(source), bytes)
    assert.deepEqual(workspace.binaryFiles, { '/favicon.ico': source })
    assert.throws(() =>
      createExampleWorkspace({
        entry: '/src/main.ts',
        files: {
          '/src/main.ts': 'export {}',
          '/public/favicon.ico': 'not binary',
        },
        binaryFiles: { '/public/favicon.ico': source },
      }),
    )
    assert.throws(() =>
      parseExampleWorkspace({
        version: 1,
        entry: '/src/main.ts',
        files: { '/src/main.ts': 'export {}' },
        binaryFiles: { '/public/favicon.ico': 'not base64' },
      }),
    )
  })

  test('round-trips a WebContainer runtime without changing the workspace', () => {
    const source = JSON.stringify({
      version: 1,
      title: 'Router SSR',
      description: 'A full-stack example.',
      initialFile: '/src/routes/index.tsx',
      runtime: {
        type: 'webcontainer',
        compatibility: 'tanstack-start-async-context',
        install: { command: 'npm', args: ['install'] },
        start: {
          command: 'npm',
          args: ['run', 'dev', '--', '--host', '0.0.0.0'],
        },
      },
      workspace: {
        version: 1,
        entry: '/src/routes/index.tsx',
        files: { '/src/routes/index.tsx': 'export const Route = null' },
      },
    })

    assert.equal(
      serializeSharedExampleProject(
        parseSharedExampleProject(JSON.parse(source)),
      ),
      source,
    )
  })

  test('rejects malformed WebContainer commands', () => {
    const project = {
      version: 1,
      title: 'Router SSR',
      description: '',
      runtime: {
        type: 'webcontainer',
        install: { command: '', args: ['install'] },
        start: { command: 'npm', args: ['run', 'dev'] },
      },
      workspace: {
        version: 1,
        entry: '/src/routes/index.tsx',
        files: { '/src/routes/index.tsx': '' },
      },
    }

    assert.throws(() => parseSharedExampleProject(project))
    assert.throws(() =>
      parseSharedExampleProject({
        ...project,
        runtime: {
          ...project.runtime,
          install: { command: 'npm', args: 'install' },
        },
      }),
    )
    assert.throws(() =>
      parseSharedExampleProject({
        ...project,
        runtime: {
          ...project.runtime,
          compatibility: 'arbitrary-node-patch',
        },
      }),
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

  test('rejects invalid hidden shared-project files', () => {
    const project = {
      version: 1,
      title: 'Sorted bars',
      description: '',
      initialFile: '/src/chart.tsx',
      workspace: {
        version: 1,
        entry: '/src/main.tsx',
        files: {
          '/src/chart.tsx': '',
          '/src/main.tsx': '',
        },
      },
    }

    assert.throws(() =>
      parseSharedExampleProject({
        ...project,
        hiddenFiles: ['/src/missing.tsx'],
      }),
    )
    assert.throws(() =>
      parseSharedExampleProject({
        ...project,
        hiddenFiles: ['/src/chart.tsx'],
      }),
    )
  })
})
