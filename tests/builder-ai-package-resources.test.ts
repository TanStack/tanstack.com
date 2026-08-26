import assert from 'node:assert/strict'
import test from 'node:test'
import { createExampleWorkspace } from '../src/utils/example-workspace'
import type { BuilderAiExecution } from '../src/utils/builder-ai'
import {
  createBuilderAiPackageFetchState,
  inspectBuilderAiModule,
  readBuilderAiPackageResource,
  resolveBuilderAiModule,
  searchBuilderAiPackageResources,
} from '../src/utils/builder-ai-package-resources'

const clientExecution: BuilderAiExecution = {
  runtime: null,
  workspace: createExampleWorkspace({
    entry: '/index.tsx',
    files: { '/index.tsx': 'export default 1' },
  }),
}

test('resolves exact built-in and installed package versions', () => {
  assert.deepEqual(
    resolveBuilderAiModule(clientExecution, '@tanstack/charts/scales/band'),
    {
      specifier: '@tanstack/charts/scales/band',
      packageName: '@tanstack/charts',
      packageVersion: '0.13.0',
      exportKey: './scales/band',
    },
  )

  const installed: BuilderAiExecution = {
    runtime: {
      type: 'webcontainer',
      install: { command: 'pnpm', args: ['install'] },
      start: { command: 'pnpm', args: ['run', 'dev'] },
    },
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': 'export default 1',
        '/package.json': JSON.stringify({
          dependencies: { '@tanstack/charts': '0.14.0' },
        }),
      },
    }),
  }
  assert.equal(
    resolveBuilderAiModule(installed, '@tanstack/charts/react').packageVersion,
    '0.14.0',
  )

  const ranged: BuilderAiExecution = {
    ...installed,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: {
        '/index.tsx': 'export default 1',
        '/package.json': JSON.stringify({
          dependencies: { '@tanstack/charts': '^0.14.0' },
        }),
      },
    }),
  }
  assert.throws(
    () => resolveBuilderAiModule(ranged, '@tanstack/charts'),
    /must use an exact version/,
  )
})

test('inspects exact module exports and declarations', async () => {
  const baseFetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/package.json': JSON.stringify({
      exports: {
        './scales/band': {
          types: './dist/scales/band.d.ts',
          import: './dist/scales/band.js',
        },
      },
    }),
    'https://unpkg.com/@tanstack/charts@0.13.0/dist/scales/band.d.ts':
      'export declare function scaleBand(): BandScale;\nexport type { BandScale };',
    'https://unpkg.com/@tanstack/charts@0.13.0/dist/scales/band.js':
      'function scaleBand() {}\nexport { scaleBand };',
  })
  let fetchCount = 0
  const fetcher: typeof fetch = (input, init) => {
    fetchCount += 1
    return baseFetcher(input, init)
  }
  const fetchState = createBuilderAiPackageFetchState()

  const result = await inspectBuilderAiModule(
    clientExecution,
    '@tanstack/charts/scales/band',
    { fetchState, fetcher },
  )

  assert.deepEqual(result.detectedRuntimeExports, ['scaleBand'])
  assert.deepEqual(result.detectedDeclarationExports, [
    'BandScale',
    'scaleBand',
  ])
  assert.equal(result.typesPath, '/dist/scales/band.d.ts')
  assert.equal(result.sourcePath, '/dist/scales/band.js')
  assert.match(result.declarations ?? '', /scaleBand/)
  assert.doesNotMatch(result.declarations ?? '', /function band/)

  const declarations = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/dist/scales/band.d.ts',
    0,
    { fetchState, fetcher },
  )
  assert.match(declarations.content, /BandScale/)
  assert.equal(fetchCount, 3)
})

test('matches the exports shipped by the pinned Charts package', async () => {
  const bandModule = await import('@tanstack/charts/scales/band')

  assert.deepEqual(Object.keys(bandModule), ['scaleBand'])
})

test('searches bounded docs, declarations, and trusted TanStack skills', async () => {
  const metadata = JSON.stringify({
    files: [
      {
        path: '/skills/debug-charts/SKILL.md',
        size: 120,
        type: 'text/markdown',
      },
      {
        path: '/docs/scales/band.md',
        size: 80,
        type: 'text/markdown',
      },
      {
        path: '/dist/scales/band.d.ts',
        size: 40,
        type: 'text/typescript',
      },
      { path: '/LICENSE', size: 20, type: 'text/plain' },
    ],
  })
  const baseFetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/?meta': metadata,
  })
  let fetchCount = 0
  const fetcher: typeof fetch = (input, init) => {
    fetchCount += 1
    return baseFetcher(input, init)
  }
  const fetchState = createBuilderAiPackageFetchState()

  const result = await searchBuilderAiPackageResources(
    clientExecution,
    '@tanstack/charts',
    'band',
    { fetchState, fetcher },
  )
  assert.deepEqual(
    result.resources.map(({ path }) => path),
    ['/docs/scales/band.md', '/dist/scales/band.d.ts'],
  )

  const all = await searchBuilderAiPackageResources(
    clientExecution,
    '@tanstack/charts',
    '',
    { fetchState, fetcher },
  )
  assert.equal(all.resources[0]?.path, '/skills/debug-charts/SKILL.md')
  assert.equal(
    all.resources.some(({ path }) => path === '/LICENSE'),
    false,
  )
  assert.equal(fetchCount, 1)
})

test('reads package resources in chunks and trusts only TanStack skills', async () => {
  const skill = 'Use scaleBand from the exact scale subpath.'
  const fetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/skills/design/SKILL.md': skill,
  })
  const result = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/skills/design/SKILL.md',
    4,
    { fetchState: createBuilderAiPackageFetchState(), fetcher },
  )
  assert.equal(result.content, skill.slice(4))
  assert.equal(result.offset, 4)
  assert.equal(result.nextOffset, null)

  const reactExecution: BuilderAiExecution = {
    runtime: null,
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      files: { '/index.tsx': 'export default 1' },
    }),
  }
  await assert.rejects(
    readBuilderAiPackageResource(
      reactExecution,
      'react',
      '/skills/untrusted/SKILL.md',
      0,
      { fetchState: createBuilderAiPackageFetchState(), fetcher },
    ),
    /not readable/,
  )
  await assert.rejects(
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/docs/../package.json',
      0,
      { fetchState: createBuilderAiPackageFetchState(), fetcher },
    ),
    /Invalid package resource path/,
  )
  await assert.rejects(
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/skills/%2e%2e/%2e%2e/@evil/package/skills/SKILL.md',
      0,
      { fetchState: createBuilderAiPackageFetchState(), fetcher },
    ),
    /Invalid package resource path/,
  )
})

test('reuses one package download across chunked reads', async () => {
  const source = `${'a'.repeat(50_000)}tail`
  const baseFetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/large.md': source,
  })
  let fetchCount = 0
  const fetcher: typeof fetch = (input, init) => {
    fetchCount += 1
    return baseFetcher(input, init)
  }
  const fetchState = createBuilderAiPackageFetchState()

  const first = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/docs/large.md',
    0,
    { fetchState, fetcher },
  )
  const second = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    'docs/large.md',
    first.nextOffset ?? 0,
    { fetchState, fetcher },
  )

  assert.equal(first.nextOffset, 50_000)
  assert.equal(second.content, 'tail')
  assert.equal(fetchCount, 1)
})

test('coalesces concurrent reads of one package resource', async () => {
  const baseFetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/shared.md': 'shared',
  })
  let fetchCount = 0
  const fetcher: typeof fetch = async (input, init) => {
    fetchCount += 1
    await Promise.resolve()
    return baseFetcher(input, init)
  }
  const fetchState = createBuilderAiPackageFetchState()

  const [first, second] = await Promise.all([
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/docs/shared.md',
      0,
      { fetchState, fetcher },
    ),
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      'docs/shared.md',
      1,
      { fetchState, fetcher },
    ),
  ])

  assert.equal(first.content, 'shared')
  assert.equal(second.content, 'hared')
  assert.equal(fetchCount, 1)
})

test('caches UTF-8 package resources across later reads', async () => {
  const fetcher = createFetcher({
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/exact.md': 'é',
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/extra.md': 'x',
  })
  const fetchState = createBuilderAiPackageFetchState()

  const exact = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/docs/exact.md',
    0,
    { fetchState, fetcher },
  )
  assert.equal(exact.content, 'é')

  const extra = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/docs/extra.md',
    0,
    { fetchState, fetcher },
  )
  assert.equal(extra.content, 'x')

  const cached = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/docs/exact.md',
    0,
    { fetchState, fetcher },
  )
  assert.equal(cached.content, 'é')
})

test('retries transient package fetches without bypassing the resource budget', async () => {
  const responses: Record<string, string> = {
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/retry.md': 'ready',
    'https://unpkg.com/@tanstack/charts@0.13.0/docs/other.md': 'other',
  }
  for (let index = 0; index < 31; index++) {
    responses[
      `https://unpkg.com/@tanstack/charts@0.13.0/docs/filled-${index}.md`
    ] = 'ok'
  }
  const baseFetcher = createFetcher(responses)
  let fetchCount = 0
  const fetcher: typeof fetch = async (input, init) => {
    fetchCount += 1
    if (fetchCount === 1) throw new TypeError('Temporary network failure')
    return baseFetcher(input, init)
  }
  const fetchState = createBuilderAiPackageFetchState()

  await assert.rejects(
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/docs/retry.md',
      0,
      { fetchState, fetcher },
    ),
    /Temporary network failure/,
  )
  const retried = await readBuilderAiPackageResource(
    clientExecution,
    '@tanstack/charts',
    '/docs/retry.md',
    0,
    { fetchState, fetcher },
  )
  assert.equal(retried.content, 'ready')
  assert.equal(fetchCount, 2)

  for (let index = 0; index < 31; index++) {
    const filled = await readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      `/docs/filled-${index}.md`,
      0,
      { fetchState, fetcher },
    )
    assert.equal(filled.content, 'ok')
  }

  await assert.rejects(
    readBuilderAiPackageResource(
      clientExecution,
      '@tanstack/charts',
      '/docs/other.md',
      0,
      { fetchState, fetcher },
    ),
    /package resource budget reached/,
  )
})

test('rejects oversized package responses before reading them', async () => {
  const fetcher: typeof fetch = async () =>
    new Response('small', {
      headers: { 'content-length': String(3 * 1024 * 1024) },
    })

  await assert.rejects(
    searchBuilderAiPackageResources(clientExecution, '@tanstack/charts', '', {
      fetchState: createBuilderAiPackageFetchState(),
      fetcher,
    }),
    /exceeds/,
  )
})

test('checks package redirects without using the unsupported edge redirect mode', async () => {
  let redirect: RequestRedirect | undefined
  const fetcher: typeof fetch = async (_input, init) => {
    redirect = init?.redirect
    return new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/package.json' },
    })
  }

  await assert.rejects(
    inspectBuilderAiModule(clientExecution, '@tanstack/charts', {
      fetchState: createBuilderAiPackageFetchState(),
      fetcher,
    }),
    /Package resource request failed \(302\)/,
  )
  assert.equal(redirect, 'manual')
})

function createFetcher(responses: Record<string, string>): typeof fetch {
  return async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const body = responses[url]
    if (body === undefined) return new Response('Not found', { status: 404 })
    return new Response(body, {
      headers: {
        'content-type':
          url.endsWith('package.json') || url.endsWith('?meta')
            ? 'application/json'
            : 'text/plain',
      },
    })
  }
}
