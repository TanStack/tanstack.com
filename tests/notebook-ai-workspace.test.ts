import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import { collectNotebookAiMessage } from '../src/utils/notebook-ai'
import {
  getChangedNotebookAiFiles,
  installNotebookAiPackage,
  listNotebookAiFiles,
  readNotebookAiFile,
  replaceNotebookAiFile,
  upgradeNotebookAiWorkspaceToWebContainer,
} from '../src/utils/notebook-ai-workspace'

const workspace = createExampleWorkspace({
  entry: '/index.tsx',
  files: {
    '/index.tsx': 'export default 1',
    '/secret.ts': 'export const token = "hidden"',
    '/styles.css': 'body { color: red }',
  },
})

test('notebook AI lists and reads only visible text files', () => {
  assert.deepEqual(listNotebookAiFiles(workspace, ['/secret.ts']), [
    { path: '/index.tsx', characters: 16 },
    { path: '/styles.css', characters: 19 },
  ])
  assert.equal(
    readNotebookAiFile(workspace, [], '/index.tsx'),
    'export default 1',
  )
  assert.throws(
    () => readNotebookAiFile(workspace, ['/secret.ts'], '/secret.ts'),
    /hidden from AI/,
  )
})

test('notebook AI replaces an existing file without mutating the input', () => {
  const next = replaceNotebookAiFile(
    workspace,
    [],
    '/styles.css',
    'body { color: blue }',
  )

  assert.equal(workspace.files['/styles.css'], 'body { color: red }')
  assert.equal(next.files['/styles.css'], 'body { color: blue }')
  assert.deepEqual(getChangedNotebookAiFiles(workspace, next), ['/styles.css'])
  assert.throws(
    () => replaceNotebookAiFile(workspace, [], '/new.ts', 'new file'),
    /not found/,
  )
})

test('notebook AI only reserves root manifests after creating its scaffold', () => {
  const authored = createExampleWorkspace({
    entry: '/app.ts',
    files: {
      '/app.ts': 'export default 1',
      '/index.html': '<main>Authored</main>',
      '/package.json': '{"dependencies":{}}',
    },
  })

  assert.deepEqual(
    listNotebookAiFiles(authored, []).map(({ path }) => path),
    ['/app.ts', '/index.html', '/package.json'],
  )
  assert.equal(
    readNotebookAiFile(authored, [], '/index.html'),
    '<main>Authored</main>',
  )

  const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
    workspace: authored,
  })
  assert.throws(
    () => readNotebookAiFile(upgraded.workspace, [], '/index.html'),
    /managed by the runtime/,
  )
})

test('notebook AI reports added and removed files as changes', () => {
  const next = createExampleWorkspace({
    entry: '/index.tsx',
    files: {
      '/index.tsx': 'export default 1',
      '/new.ts': 'export const added = true',
    },
  })

  assert.deepEqual(getChangedNotebookAiFiles(workspace, next), [
    '/new.ts',
    '/secret.ts',
    '/styles.css',
  ])
})

test('notebook AI upgrades a client workspace without changing authored files', () => {
  const clientWorkspace = createExampleWorkspace({
    binaryFiles: { '/asset.bin': 'AA==' },
    entry: '/src/index.tsx',
    environment: 'client',
    files: {
      '/src/index.tsx': 'export default function render() {}',
      '/src/styles.css': 'body { color: tomato }',
    },
    imports: { example: 'https://example.com/module.js' },
  })

  const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
    workspace: clientWorkspace,
  })

  assert.deepEqual(upgraded.runtime, {
    type: 'webcontainer',
    install: { command: 'pnpm', args: ['install'] },
    start: { command: 'pnpm', args: ['run', 'dev'] },
  })
  assert.equal(
    upgraded.workspace.files['/src/index.tsx'],
    clientWorkspace.files['/src/index.tsx'],
  )
  assert.equal(
    upgraded.workspace.files['/src/styles.css'],
    clientWorkspace.files['/src/styles.css'],
  )
  assert.deepEqual(upgraded.workspace.binaryFiles, clientWorkspace.binaryFiles)
  assert.deepEqual(upgraded.workspace.imports, clientWorkspace.imports)
  assert.equal(upgraded.workspace.entry, clientWorkspace.entry)
  assert.equal(upgraded.workspace.environment, clientWorkspace.environment)
  assert.match(
    upgraded.workspace.files['/.tanstack/main.ts'],
    /import value from "\.\.\/src\/index\.tsx"/,
  )
  assert.match(
    upgraded.workspace.files['/index.html'],
    /src="\/\.tanstack\/main\.ts"/,
  )
  assert.match(
    upgraded.workspace.files['/.tanstack/vite.config.ts'],
    /@vitejs\/plugin-react/,
  )
  assert.match(
    upgraded.workspace.files['/.tanstack/vite.config.ts'],
    /tanstack-notebook-import-map/,
  )
  assert.match(
    upgraded.workspace.files['/.tanstack/vite.config.ts'],
    /"example"/,
  )
  assert.equal(
    upgraded.workspace.files['/.tanstack/notebook-ai.json'],
    '{"version":1}\n',
  )
  assert.match(
    upgraded.workspace.files['/index.html'],
    /"example":"https:\/\/example\.com\/module\.js"/,
  )
  assert.match(upgraded.workspace.files['/index.html'], /--notebook-background/)
  assert.deepEqual(JSON.parse(upgraded.workspace.files['/package.json']), {
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite --config .tanstack/vite.config.ts --host 0.0.0.0',
    },
    dependencies: {
      react: '19.2.3',
      'react-dom': '19.2.3',
    },
    devDependencies: {
      '@vitejs/plugin-react': '6.0.1',
      vite: '8.0.16',
    },
  })
  assert.deepEqual(Object.keys(clientWorkspace.files).sort(), [
    '/src/index.tsx',
    '/src/styles.css',
  ])
})

test('notebook AI installs and updates package dependencies immutably', () => {
  const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': 'export default 1' },
    }),
  })
  const installed = installNotebookAiPackage(
    upgraded,
    '@tanstack/charts',
    '0.13.0',
  )
  const updated = installNotebookAiPackage(
    installed,
    '@tanstack/charts',
    '0.14.0',
  )

  assert.equal(
    JSON.parse(upgraded.workspace.files['/package.json']).dependencies[
      '@tanstack/charts'
    ],
    undefined,
  )
  assert.equal(
    JSON.parse(installed.workspace.files['/package.json']).dependencies[
      '@tanstack/charts'
    ],
    '0.13.0',
  )
  assert.equal(
    JSON.parse(updated.workspace.files['/package.json']).dependencies[
      '@tanstack/charts'
    ],
    '0.14.0',
  )
  assert.equal(updated.runtime, upgraded.runtime)
  assert.deepEqual(
    getChangedNotebookAiFiles(upgraded.workspace, installed.workspace),
    ['/package.json'],
  )

  const duplicateManifest = createExampleWorkspace({
    entry: '/index.tsx',
    files: {
      ...upgraded.workspace.files,
      '/package.json': JSON.stringify({
        dependencies: { existing: '1.0.0' },
        devDependencies: {
          existing: '0.9.0',
          '@tanstack/charts': '0.12.0',
        },
      }),
    },
  })
  const deduplicated = installNotebookAiPackage(
    { runtime: upgraded.runtime, workspace: duplicateManifest },
    '@tanstack/charts',
    '0.13.0',
  )
  assert.deepEqual(JSON.parse(deduplicated.workspace.files['/package.json']), {
    dependencies: {
      existing: '1.0.0',
      '@tanstack/charts': '0.13.0',
    },
    devDependencies: {},
  })
})

test('notebook AI merges authored documents and package manifests', () => {
  const authored = createExampleWorkspace({
    entry: '/src/app.tsx',
    environment: 'react',
    files: {
      '/src/app.tsx': 'export default function App() { return null }',
      '/index.html':
        '<!doctype html><html><head><title>Custom</title></head><body><main id="shell"></main><script type="module" src="/src/app.tsx"></script></body></html>',
      '/package.json': JSON.stringify({
        name: 'authored-notebook',
        scripts: { check: 'echo checked' },
        dependencies: { example: '1.2.3', vite: '7.0.0' },
        devDependencies: { example: '1.0.0', react: '18.3.1' },
      }),
    },
  })

  const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
    workspace: authored,
  })
  const document = upgraded.workspace.files['/index.html']
  const manifest = JSON.parse(upgraded.workspace.files['/package.json'])

  assert.match(document, /<title>Custom<\/title>/)
  assert.match(document, /<main id="shell"><\/main>/)
  assert.doesNotMatch(document, /src="\/src\/app\.tsx"/)
  assert.match(document, /src="\/\.tanstack\/main\.ts"/)
  assert.match(
    upgraded.workspace.files['/.tanstack/main.ts'],
    /createElement\(App\)/,
  )
  assert.deepEqual(manifest, {
    name: 'authored-notebook',
    private: true,
    type: 'module',
    scripts: {
      check: 'echo checked',
      dev: 'vite --config .tanstack/vite.config.ts --host 0.0.0.0',
    },
    dependencies: {
      example: '1.2.3',
      react: '19.2.3',
      'react-dom': '19.2.3',
    },
    devDependencies: {
      '@vitejs/plugin-react': '6.0.1',
      vite: '8.0.16',
    },
  })
})

test('notebook AI supports every browser environment profile', () => {
  const environments = [
    undefined,
    'client',
    'react',
    'charts',
    'charts-react',
    'charts-octane',
  ] as const

  for (const environment of environments) {
    const entry = environment === 'charts-octane' ? '/app.tsrx' : '/app.tsx'
    const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
      workspace: createExampleWorkspace({
        entry,
        ...(environment ? { environment } : {}),
        files: { [entry]: 'export default function App() {}' },
      }),
    })

    assert.match(upgraded.workspace.files['/.tanstack/main.ts'], /\.\.\/app/)
    if (environment === 'charts-octane') {
      assert.match(
        upgraded.workspace.files['/.tanstack/vite.config.ts'],
        /octane\/compiler\/vite/,
      )
      assert.equal(
        JSON.parse(upgraded.workspace.files['/package.json']).dependencies
          .octane,
        '0.1.13',
      )
    }
  }
})

test('notebook AI rejects WebContainer scaffold and root descendants', () => {
  for (const path of [
    '/.tanstack',
    '/.tanstack/main.ts',
    '/index.html/child',
    '/package.json/child',
  ]) {
    assert.throws(
      () =>
        upgradeNotebookAiWorkspaceToWebContainer({
          workspace: createExampleWorkspace({
            entry: '/app.ts',
            environment: 'client',
            files: { '/app.ts': 'export default 1', [path]: 'authored' },
          }),
        }),
      /reserved for WebContainer/,
    )
  }

  assert.throws(
    () =>
      upgradeNotebookAiWorkspaceToWebContainer({
        workspace: createExampleWorkspace({
          binaryFiles: { '/.tanstack/image.png': 'AA==' },
          entry: '/app.ts',
          environment: 'client',
          files: { '/app.ts': 'export default 1' },
        }),
      }),
    /reserved for WebContainer/,
  )

  for (const path of ['/index.html', '/package.json']) {
    assert.throws(
      () =>
        upgradeNotebookAiWorkspaceToWebContainer({
          workspace: createExampleWorkspace({
            binaryFiles: { [path]: 'AA==' },
            entry: '/app.ts',
            files: { '/app.ts': 'export default 1' },
          }),
        }),
      /must be text for WebContainer/,
    )
  }
})

test('notebook AI validates runtime upgrades and package manifests', () => {
  assert.doesNotThrow(() =>
    upgradeNotebookAiWorkspaceToWebContainer({ workspace }),
  )
  assert.throws(
    () => installNotebookAiPackage({ workspace }, 'example', '1.0.0'),
    /requires \/package\.json/,
  )

  const invalidManifest = createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: {
      '/index.tsx': 'export default 1',
      '/package.json': '{"dependencies":[]}',
    },
  })
  assert.throws(
    () =>
      installNotebookAiPackage(
        { workspace: invalidManifest },
        'example',
        '1.0.0',
      ),
    /Invalid \/package\.json dependencies/,
  )

  const upgraded = upgradeNotebookAiWorkspaceToWebContainer({
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': 'export default 1' },
    }),
  })
  assert.throws(
    () => installNotebookAiPackage(upgraded, '../escape', '1.0.0'),
    /Invalid package name/,
  )
  assert.throws(
    () => installNotebookAiPackage(upgraded, 'example', 'file:./local'),
    /Invalid package version/,
  )
  assert.throws(
    () => installNotebookAiPackage(upgraded, 'example', 'latest'),
    /Invalid package version/,
  )
  assert.throws(
    () => installNotebookAiPackage(upgraded, 'example', '^1.2.3'),
    /Invalid package version/,
  )
  assert.doesNotThrow(() =>
    installNotebookAiPackage(upgraded, 'example', '1.2.3-beta.1'),
  )
  assert.throws(
    () => readNotebookAiFile(upgraded.workspace, [], '/package.json'),
    /managed by the runtime/,
  )
  assert.equal(
    listNotebookAiFiles(upgraded.workspace, []).some(({ path }) =>
      path.startsWith('/.tanstack'),
    ),
    false,
  )
})

test('notebook AI collects text and rejects streamed provider errors', async () => {
  async function* successfulStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'message-1',
      delta: 'Hello ',
    }
    yield {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'message-1',
      delta: 'notebook',
    }
  }

  async function* errorStream(): AsyncGenerator<StreamChunk> {
    yield { type: EventType.RUN_ERROR, message: 'Invalid API key' }
  }

  assert.equal(
    await collectNotebookAiMessage(successfulStream()),
    'Hello notebook',
  )
  await assert.rejects(
    collectNotebookAiMessage(errorStream()),
    /Invalid API key/,
  )
})
