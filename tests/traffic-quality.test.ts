import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {
  classifyTraffic,
  TRAFFIC_QUALITY_BOOTSTRAP,
} from '../src/utils/analytics/traffic-quality.ts'
import { receiveTrafficQuality } from '../src/utils/analytics/traffic-quality.server.ts'

const windows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36'
const input = {
  userAgent: windows,
  referrer: '',
  url: 'https://tanstack.com/',
  sessionNumber: 1,
}
test('only the complete first-session direct old Chrome fingerprint is flagged', () => {
  assert.equal(classifyTraffic(input), 'automated')
  assert.equal(
    classifyTraffic({
      ...input,
      userAgent: windows.replace(
        'Windows NT 10.0; Win64; x64',
        'Macintosh; Intel Mac OS X 10_15_7',
      ),
    }),
    'suspect',
  )
  assert.equal(
    classifyTraffic({
      ...input,
      userAgent: windows.replace(
        'Windows NT 10.0; Win64; x64',
        'X11; Linux x86_64',
      ),
    }),
    'automated',
  )
  for (const change of [
    { sessionNumber: 2 },
    { referrer: 'https://google.com/' },
    { url: 'https://tanstack.com/?utm_source=email' },
    { url: 'https://tanstack.com/?gclid=123' },
    { userAgent: windows.replace('148.0.0.0', '149.0.0.0') },
    { userAgent: windows.replace('148.0.0.0', '148.0.1.2') },
    { userAgent: `${windows} Edg/148.0.0.0` },
    {
      userAgent: windows.replace(
        'Windows NT 10.0; Win64; x64',
        'Linux; Android 10',
      ),
    },
  ])
    assert.equal(classifyTraffic({ ...input, ...change }), 'unflagged')
  assert.equal(
    classifyTraffic({ ...input, sessionNumber: undefined }),
    'unknown',
  )
  assert.equal(
    classifyTraffic(input, { currentChromeMajor: 154, versionGap: 7 }),
    'unflagged',
  )
})

test('head bootstrap labels the first event, preserves the session across pages and rechecks returning sessions', () => {
  const storage = new Map<string, string>()
  let session = 100
  let number = 1
  const emitted: Array<{ event: unknown; quality: unknown }> = []
  const run = (referrer: string) => {
    const context = vm.createContext({
      URL,
      Blob,
      setTimeout,
      clearTimeout,
      location: { href: input.url },
      document: { referrer },
      navigator: {
        userAgent: windows,
        webdriver: true,
        sendBeacon: () => true,
      },
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      window: {
        gtag: (command: string, ...args: any[]) => {
          if (command === 'get')
            args[2](
              args[1] === 'session_number'
                ? number
                : args[1] === 'session_id'
                  ? session
                  : 'client',
            )
          if (command === 'event')
            emitted.push({ event: args[0], quality: args[1].traffic_quality })
        },
      },
    })
    vm.runInContext(TRAFFIC_QUALITY_BOOTSTRAP, context)
    vm.runInContext("window.gtag('event','page_view',{})", context)
  }
  run('')
  run('https://tanstack.com/')
  session++
  number++
  run('')
  assert.deepEqual(
    emitted.map((event) => event.quality),
    ['automated', 'automated', 'unflagged'],
  )
})

test('edge diagnostics validate inputs and log network attribution without visitor identifiers', async () => {
  const logs: unknown[][] = []
  const original = console.info
  console.info = (...args) => {
    logs.push(args)
  }
  try {
    const request = new Request('https://tanstack.com/_a/traffic-quality', {
      method: 'POST',
      headers: {
        origin: 'https://tanstack.com',
        'user-agent': windows,
        'cf-connecting-ip': '192.0.2.1',
        cookie: 'secret',
      },
      body: JSON.stringify({ quality: 'automated', webdriver: true }),
    })
    Object.defineProperty(request, 'cf', {
      value: {
        asn: 64500,
        asOrganization: 'Example Network',
        botManagement: { score: 2, verifiedBot: false },
      },
    })
    assert.equal((await receiveTrafficQuality(request)).status, 204)
    assert.match(JSON.stringify(logs), /Example Network/)
    assert.doesNotMatch(JSON.stringify(logs), /192\.0\.2|secret/)
    const invalid = new Request('https://tanstack.com/_a/traffic-quality', {
      method: 'POST',
      headers: { origin: 'https://elsewhere.com' },
      body: '{}',
    })
    assert.equal((await receiveTrafficQuality(invalid)).status, 403)
    const oversize = new Request('https://tanstack.com/_a/traffic-quality', {
      method: 'POST',
      headers: { origin: 'https://tanstack.com' },
      body: 'x'.repeat(513),
    })
    assert.equal((await receiveTrafficQuality(oversize)).status, 413)
    assert.equal(logs.length, 1)
  } finally {
    console.info = original
  }
})

test('unavailable GA getters release queued events as unknown without manufacturing a first visit', () => {
  let timeout = () => {}
  const emitted: unknown[] = []
  const context = vm.createContext({
    URL,
    Blob,
    setTimeout: (callback: () => void) => {
      timeout = callback
      return 1
    },
    clearTimeout: () => {},
    location: { href: input.url },
    document: { referrer: '' },
    navigator: { userAgent: windows },
    localStorage: { getItem: () => null },
    window: {
      gtag: (command: string, ...args: any[]) => {
        if (command === 'event') emitted.push(args[1].traffic_quality)
      },
    },
  })
  vm.runInContext(TRAFFIC_QUALITY_BOOTSTRAP, context)
  vm.runInContext(
    "window.gtag('event','page_view',{});window.gtag('event','partner_viewed',{})",
    context,
  )
  assert.equal(emitted.length, 0)
  timeout()
  assert.deepEqual(emitted, ['unknown', 'unknown'])
})
