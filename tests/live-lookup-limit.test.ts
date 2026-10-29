import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const bundle = build({
  entryPoints: ['src/utils/analytics/live.server.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'iife',
  globalName: 'live',
  plugins: [
    {
      name: 'lookup-dependencies',
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(~\/db\/client|~\/utils\/roles.server|~\/server\/runtime\/host.server|\.\/scarf-lookup.server)$/,
          },
          (args) => ({ path: args.path, namespace: 'live-test' }),
        )
        build.onLoad({ filter: /.*/, namespace: 'live-test' }, (args) => ({
          contents:
            args.path === '~/db/client'
              ? `
        export const db = {
          insert() { return { values() { return { onConflictDoNothing() { return { async returning() { return [{ id: 'session' }] } } }, async onConflictDoUpdate() {} } } } },
          update() { return { set(value) { updates.push(value); return { async where() {} } } } },
        }
      `
              : args.path === './scarf-lookup.server'
                ? `
        export async function getLiveConfig() { return {} }
        export async function lookupScarfCompany() { calls.push('lookup'); return null }
      `
                : args.path === '~/utils/roles.server'
                  ? 'export async function requireAdmin() {}'
                  : 'export function scheduleHostRuntimeTask() { return false }',
        }))
      },
    },
  ],
})

test('new sessions do not call Scarf when the separate lookup budget is exhausted', async () => {
  const calls: string[] = []
  const updates: unknown[] = []
  const result = await bundle
  const api = runInNewContext(`${result.outputFiles[0].text}\nlive`, {
    require,
    calls,
    updates,
    console,
    TextEncoder,
    TextDecoder,
    URL,
    setTimeout,
    clearTimeout,
  })
  await api.recordLiveEvent(
    {
      sessionId: 'session',
      tabId: 'tab',
      sequence: 1,
      page: '/query/latest',
      visible: true,
      kind: 'update',
    },
    '192.0.2.1',
    'test-key',
    {
      async limit({ key }: { key: string }) {
        assert.equal(key, '192.0.2.1')
        return { success: false }
      },
    },
  )
  assert.deepEqual(calls, [])
  assert.equal(
    JSON.stringify(updates),
    JSON.stringify([{ lookupStatus: 'rate_limited' }]),
  )
})
