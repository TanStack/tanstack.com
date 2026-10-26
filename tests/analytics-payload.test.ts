import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { buildSync } from 'esbuild'

const result = buildSync({
  entryPoints: ['src/utils/analytics.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'analytics',
  platform: 'browser',
  define: {
    'import.meta.env.MODE': '"production"',
    'import.meta.env.DEV': 'false',
  },
})
const code = result.outputFiles[0].text

test('page views and partner events use clean stats URLs without modifying other campaign URLs', () => {
  const sent: unknown[][] = []
  const context = vm.createContext({
    URL,
    document: { title: 'Stats' },
    window: {
      location: new URL('https://tanstack.com/stats/npm?chart=large#state'),
      gtag: (...args: unknown[]) => sent.push(args),
    },
  })
  vm.runInContext(code, context)
  vm.runInContext(
    "analytics.trackPageView('/stats/npm?chart=large'); analytics.trackEvent('partner_viewed', {partner_id:'vercel',placement:'docs_rail'})",
    context,
  )
  for (const event of sent) {
    assert.equal(
      Reflect.get(Object(event[2]), 'page_location'),
      'https://tanstack.com/stats/npm',
    )
    assert.equal(Reflect.get(Object(event[2]), 'page_path'), '/stats/npm')
  }
  vm.runInContext(
    "window.location = new URL('https://tanstack.com/?utm_source=email'); analytics.trackPageView('/?utm_source=email')",
    context,
  )
  assert.equal(
    Reflect.get(Object(sent[2][2]), 'page_location'),
    'https://tanstack.com/?utm_source=email',
  )
})

test('local and preview hosts cannot send events to the production provider', () => {
  for (const hostname of [
    'localhost',
    'preview.tanstack.com',
    'tanstack-com.workers.dev',
  ]) {
    const sent: unknown[][] = []
    const context = vm.createContext({
      URL,
      document: { title: 'Preview' },
      window: {
        location: new URL(`https://${hostname}/`),
        gtag: (...args: unknown[]) => sent.push(args),
      },
    })
    vm.runInContext(code, context)
    vm.runInContext("analytics.trackPageView('/')", context)
    assert.equal(sent.length, 0)
  }
})
