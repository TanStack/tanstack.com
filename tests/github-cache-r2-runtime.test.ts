import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'

// Exercise native R2 bodies, conditional writes, and the Cache API inside workerd.
test('R2 runtime rejects a refresh that races with push invalidation', async () => {
  const bundle = await build({
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    external: ['node:*'],
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import { runWithHostRuntimeEnv } from './src/server/runtime/host.server';
        import { getCachedGitHubTextFile, markGitHubContentStale } from './src/utils/github-content-cache.server';
        const opts = { repo: 'tanstack/router', gitRef: 'main', path: 'docs/runtime.md' };
        export default {
          fetch(request, env) {
            return runWithHostRuntimeEnv(env, async () => {
              const path = new URL(request.url).pathname;
              if (path === '/invalidate') return new Response(String(await markGitHubContentStale(opts)));
              const value = await getCachedGitHubTextFile({ ...opts, origin: () => {
                if (path === '/refresh') {
                  return fetch(env.ORIGIN_URL).then(response => response.text());
                }
                return Promise.resolve(path === '/seed' ? 'old' : 'new');
              }});
              return new Response(value);
            });
          }
        };
      `,
    },
    plugins: [
      {
        name: 'unused-request-diagnostics',
        setup(builder) {
          builder.onResolve({ filter: /^~\/db\/client$/ }, () => ({
            path: 'database',
            namespace: 'fixture',
          }))
          builder.onResolve({ filter: /^\.\/request-timing\.server$/ }, () => ({
            path: 'timings',
            namespace: 'fixture',
          }))
          builder.onLoad(
            { filter: /.*/, namespace: 'fixture' },
            ({ path }) => ({
              contents:
                path === 'database'
                  ? 'export function retainDatabaseContext(task) { return task }'
                  : 'export function timeRequestWork(name, work) { return work() }',
            }),
          )
        },
      },
    ],
  })
  let finishOrigin: (value: string) => void = () => {
    throw new Error('origin not started')
  }
  let noteStarted: () => void = () => {
    throw new Error('start not initialized')
  }
  const started = new Promise<void>((resolve) => {
    noteStarted = resolve
  })
  const originServer = createServer((_request, response) => {
    finishOrigin = (value) => {
      response.end(value)
    }
    noteStarted()
  })
  await new Promise<void>((resolve) =>
    originServer.listen(0, '127.0.0.1', resolve),
  )
  const address = originServer.address()
  assert.ok(address && typeof address !== 'string')
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: 'r2-cache-test',
          compatibilityDate: '2026-06-19',
          compatibilityFlags: ['nodejs_compat'],
          manifest: {
            mainModule: 'index.js',
            modules: {
              'index.js': { type: 'esm', contents: bundle.outputFiles[0].text },
            },
          },
          env: {
            GITHUB_CONTENT_CACHE: { type: 'r2' },
            ORIGIN_URL: {
              type: 'text',
              value: `http://127.0.0.1:${address.port}`,
            },
          },
        },
      },
    ],
  })
  try {
    const bucket = await runtime.getR2Bucket('GITHUB_CONTENT_CACHE')
    const key = 'github:file/tanstack/router/main/docs/runtime.md'
    assert.equal(
      await (await runtime.dispatchFetch('https://test/seed')).text(),
      'old',
    )
    assert.equal(
      await (await runtime.dispatchFetch('https://test/invalidate')).text(),
      '1',
    )
    const before = await bucket.get(key)
    assert.ok(before)
    const refresh = runtime.dispatchFetch('https://test/refresh')
    await started
    await runtime.dispatchFetch('https://test/invalidate')
    const invalidated = await bucket.get(key)
    assert.ok(invalidated)
    assert.notEqual(
      invalidated.etag,
      before.etag,
      'metadata-only invalidation needs a new content ETag',
    )
    finishOrigin('result from before second push')
    await refresh
    const after = await bucket.get(key)
    assert.ok(after)
    assert.equal(after.etag, invalidated.etag)
    assert.equal(after.customMetadata?.staleAt, new Date(0).toISOString())
    assert.equal(
      await (await runtime.dispatchFetch('https://test/read')).text(),
      'new',
    )
    const final = await bucket.get(key)
    assert.ok(final)
    assert.equal(JSON.parse(await final.text()).value, 'new')
  } finally {
    originServer.closeAllConnections()
    await new Promise<void>((resolve) => originServer.close(() => resolve()))
    await runtime.dispose()
  }
})
