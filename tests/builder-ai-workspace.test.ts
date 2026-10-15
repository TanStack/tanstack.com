import assert from 'node:assert/strict'
import test from 'node:test'
import { EventType, type StreamChunk } from '@tanstack/ai'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import { collectBuilderAiMessage } from '../src/utils/builder-ai'
import {
  getChangedBuilderAiFiles,
  installBuilderAiPackage,
  listBuilderAiFiles,
  readBuilderAiFile,
  replaceBuilderAiFile,
  upgradeBuilderAiWorkspaceToWebContainer,
} from '../src/utils/builder-ai-workspace'

const workspace = createExampleWorkspace({
  entry: '/index.tsx',
  files: {
    '/index.tsx': 'export default 1',
    '/secret.ts': 'export const token = "hidden"',
    '/styles.css': 'body { color: red }',
  },
})

test('builder AI lists and reads only visible text files', () => {
  assert.deepEqual(listBuilderAiFiles(workspace, ['/secret.ts']), [
    { path: '/index.tsx', characters: 16 },
    { path: '/styles.css', characters: 19 },
  ])
  assert.equal(
    readBuilderAiFile(workspace, [], '/index.tsx'),
    'export default 1',
  )
  assert.throws(
    () => readBuilderAiFile(workspace, ['/secret.ts'], '/secret.ts'),
    /hidden from AI/,
  )
})

test('builder AI replaces an existing file without mutating the input', () => {
  const next = replaceBuilderAiFile(
    workspace,
    [],
    '/styles.css',
    'body { color: blue }',
  )

  assert.equal(workspace.files['/styles.css'], 'body { color: red }')
  assert.equal(next.files['/styles.css'], 'body { color: blue }')
  assert.deepEqual(getChangedBuilderAiFiles(workspace, next), ['/styles.css'])
  assert.throws(
    () => replaceBuilderAiFile(workspace, [], '/new.ts', 'new file'),
    /not found/,
  )
})

test('builder AI only reserves root manifests after creating its scaffold', () => {
  const authored = createExampleWorkspace({
    entry: '/app.ts',
    files: {
      '/app.ts': 'export default 1',
      '/index.html': '<main>Authored</main>',
      '/package.json': '{"dependencies":{}}',
    },
  })

  assert.deepEqual(
    listBuilderAiFiles(authored, []).map(({ path }) => path),
    ['/app.ts', '/index.html', '/package.json'],
  )
  assert.equal(
    readBuilderAiFile(authored, [], '/index.html'),
    '<main>Authored</main>',
  )

  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
    workspace: authored,
  })
  assert.throws(
    () => readBuilderAiFile(upgraded.workspace, [], '/index.html'),
    /managed by the runtime/,
  )
})

test('builder AI reports added and removed files as changes', () => {
  const next = createExampleWorkspace({
    entry: '/index.tsx',
    files: {
      '/index.tsx': 'export default 1',
      '/new.ts': 'export const added = true',
    },
  })

  assert.deepEqual(getChangedBuilderAiFiles(workspace, next), [
    '/new.ts',
    '/secret.ts',
    '/styles.css',
  ])
})

test('builder AI upgrades a client workspace without changing authored files', () => {
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

  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
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
    /tanstack-builder-import-map/,
  )
  assert.match(
    upgraded.workspace.files['/.tanstack/vite.config.ts'],
    /"example"/,
  )
  assert.equal(
    upgraded.workspace.files['/.tanstack/builder-ai.json'],
    '{"version":1}\n',
  )
  assert.match(
    upgraded.workspace.files['/index.html'],
    /"example":"https:\/\/example\.com\/module\.js"/,
  )
  assert.match(upgraded.workspace.files['/index.html'], /--builder-background/)
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

test('builder AI installs and updates package dependencies immutably', () => {
  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': 'export default 1' },
    }),
  })
  const installed = installBuilderAiPackage(
    upgraded,
    '@tanstack/charts',
    '0.13.0',
  )
  const updated = installBuilderAiPackage(
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
    getChangedBuilderAiFiles(upgraded.workspace, installed.workspace),
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
  const deduplicated = installBuilderAiPackage(
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

test('builder AI merges authored documents and package manifests', () => {
  const authored = createExampleWorkspace({
    entry: '/src/app.tsx',
    environment: 'react',
    files: {
      '/src/app.tsx': 'export default function App() { return null }',
      '/index.html':
        '<!doctype html><html><head><title>Custom</title></head><body><main id="shell"></main><script type="module" src="/src/app.tsx"></script></body></html>',
      '/package.json': JSON.stringify({
        name: 'authored-builder',
        scripts: { check: 'echo checked' },
        dependencies: { example: '1.2.3', vite: '7.0.0' },
        devDependencies: { example: '1.0.0', react: '18.3.1' },
      }),
    },
  })

  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
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
    name: 'authored-builder',
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

test('builder AI supports every browser environment profile', () => {
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
    const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
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

test('builder AI rejects WebContainer scaffold and root descendants', () => {
  for (const path of [
    '/.tanstack',
    '/.tanstack/main.ts',
    '/index.html/child',
    '/package.json/child',
  ]) {
    assert.throws(
      () =>
        upgradeBuilderAiWorkspaceToWebContainer({
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
      upgradeBuilderAiWorkspaceToWebContainer({
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
        upgradeBuilderAiWorkspaceToWebContainer({
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

test('builder AI validates runtime upgrades and package manifests', () => {
  assert.doesNotThrow(() =>
    upgradeBuilderAiWorkspaceToWebContainer({ workspace }),
  )
  assert.throws(
    () => installBuilderAiPackage({ workspace }, 'example', '1.0.0'),
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
      installBuilderAiPackage(
        { workspace: invalidManifest },
        'example',
        '1.0.0',
      ),
    /Invalid \/package\.json dependencies/,
  )

  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': 'export default 1' },
    }),
  })
  assert.throws(
    () => installBuilderAiPackage(upgraded, '../escape', '1.0.0'),
    /Invalid package name/,
  )
  assert.throws(
    () => installBuilderAiPackage(upgraded, 'example', 'file:./local'),
    /Invalid package version/,
  )
  assert.throws(
    () => installBuilderAiPackage(upgraded, 'example', 'latest'),
    /Invalid package version/,
  )
  assert.throws(
    () => installBuilderAiPackage(upgraded, 'example', '^1.2.3'),
    /Invalid package version/,
  )
  assert.doesNotThrow(() =>
    installBuilderAiPackage(upgraded, 'example', '1.2.3-beta.1'),
  )
  assert.throws(
    () => readBuilderAiFile(upgraded.workspace, [], '/package.json'),
    /managed by the runtime/,
  )
  assert.equal(
    listBuilderAiFiles(upgraded.workspace, []).some(({ path }) =>
      path.startsWith('/.tanstack'),
    ),
    false,
  )
})

test('builder AI collects text and rejects streamed provider errors', async () => {
  async function* successfulStream(): AsyncGenerator<StreamChunk> {
    yield {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'message-1',
      delta: 'Hello ',
    }
    yield {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'message-1',
      delta: 'builder',
    }
  }

  async function* errorStream(): AsyncGenerator<StreamChunk> {
    yield { type: EventType.RUN_ERROR, message: 'Invalid API key' }
  }

  assert.equal(
    await collectBuilderAiMessage(successfulStream()),
    'Hello builder',
  )
  await assert.rejects(
    collectBuilderAiMessage(errorStream()),
    /Invalid API key/,
  )
})
