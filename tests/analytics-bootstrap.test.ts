import assert from 'node:assert/strict'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import {
  GOOGLE_ANALYTICS_BOOTSTRAP,
  GOOGLE_ANALYTICS_HYDRATED_EVENT,
} from '../src/utils/analytics/bootstrap'

function setup(idleSupported = true) {
  const events = new EventTarget()
  const idleCallbacks: Array<() => void> = []
  const timers: Array<{ callback: () => void; delay: number }> = []
  function createScript() {
    const attributes = new Map<string, string>()
    return {
      async: false,
      src: '',
      attributes,
      setAttribute(name: string, value: string) {
        attributes.set(name, value)
      },
    }
  }
  const scripts: Array<ReturnType<typeof createScript>> = []
  const window = {
    location: new URL('https://tanstack.com/query/latest#example'),
    addEventListener: events.addEventListener.bind(events),
    setTimeout(callback: () => void, delay: number) {
      timers.push({ callback, delay })
    },
    ...(idleSupported
      ? {
          requestIdleCallback(
            callback: () => void,
            options: { timeout: number },
          ) {
            assert.equal(options.timeout, 3000)
            idleCallbacks.push(callback)
          },
        }
      : {}),
  }
  const context = createContext({
    window,
    document: {
      title: 'TanStack Query',
      head: {
        appendChild(script: ReturnType<typeof createScript>) {
          scripts.push(script)
        },
      },
      createElement: createScript,
    },
  })
  runInContext(GOOGLE_ANALYTICS_BOOTSTRAP, context)
  return {
    scripts,
    idleCallbacks,
    timers,
    window,
    context,
    hydrate() {
      events.dispatchEvent(new Event(GOOGLE_ANALYTICS_HYDRATED_EVENT))
    },
    queue() {
      return JSON.parse(
        runInContext(
          'JSON.stringify(window.dataLayer.map(function(event){return Array.from(event)}))',
          context,
        ),
      )
    },
  }
}

test('analytics queues the initial page and SPA events before loading after hydration', () => {
  const state = setup()
  runInContext(GOOGLE_ANALYTICS_BOOTSTRAP, state.context)
  assert.equal(state.scripts.length, 0)
  assert.equal(state.idleCallbacks.length, 0)
  assert.equal(state.timers.length, 0)
  state.window.location.href = 'https://tanstack.com/builder'
  runInContext(
    "window.gtag('event', 'page_view', {page_location: window.location.href})",
    state.context,
  )
  assert.deepEqual(state.queue()[1], [
    'config',
    'G-JMT1Z50SPS',
    {
      transport_url: 'https://tanstack.com/_a',
      send_page_view: false,
    },
  ])
  assert.deepEqual(state.queue()[2], [
    'event',
    'page_view',
    {
      page_location: 'https://tanstack.com/query/latest',
      page_title: 'TanStack Query',
    },
  ])
  assert.deepEqual(state.queue()[3], [
    'event',
    'page_view',
    { page_location: 'https://tanstack.com/builder' },
  ])

  state.hydrate()
  state.hydrate()
  assert.equal(state.idleCallbacks.length, 1)
  assert.equal(state.scripts.length, 0)
  state.idleCallbacks[0]()
  state.idleCallbacks[0]()
  assert.equal(state.scripts.length, 1)
  assert.equal(state.scripts[0].src, '/_a/gtag.js')
  assert.equal(state.scripts[0].async, true)
  assert.equal(state.scripts[0].attributes.get('data-ga-loader'), 'true')
  assert.equal(state.queue().length, 4)
})

test('analytics waits for hydration before its timer fallback', () => {
  const state = setup(false)
  assert.equal(state.timers.length, 0)
  state.hydrate()
  state.hydrate()
  assert.equal(state.timers.length, 1)
  assert.equal(state.timers[0].delay, 1500)
  state.timers[0].callback()
  assert.equal(state.scripts.length, 1)
})
