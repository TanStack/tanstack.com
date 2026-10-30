import { afterEach, expect, it, vi } from 'vitest'
import { observeMobileViewport } from '../../src/chat/components/mobile-viewport'

let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  vi.unstubAllGlobals()
})
function setup() {
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  })
  const narrow = Object.assign(new EventTarget(), { matches: true })
  const win = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    matchMedia: () => narrow,
  })
  const values = new Map<string, string>()
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {
    documentElement: {
      style: {
        setProperty: (key: string, value: string) => values.set(key, value),
        removeProperty: (key: string) => values.delete(key),
      },
    },
  })
  let pending: FrameRequestCallback | undefined
  const request = vi.fn((fn: FrameRequestCallback) => {
    pending = fn
    return 1
  })
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn(() => {
      pending = undefined
    }),
  )
  const flush = () => {
    const fn = pending
    pending = undefined
    fn?.(0)
  }
  stop = observeMobileViewport()
  return { viewport, narrow, values, flush, request }
}
it('tracks keyboard resize and the later Safari viewport pan', () => {
  const { viewport, values, flush } = setup()
  viewport.height = 420
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(values.get('--mobile-height')).toBe('420px')
  viewport.offsetTop = 180
  viewport.dispatchEvent(new Event('scroll'))
  flush()
  expect(values.get('--mobile-top')).toBe('180px')
  viewport.height = 844
  viewport.offsetTop = 0
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(values.get('--mobile-height')).toBe('844px')
  expect(values.get('--mobile-top')).toBe('0px')
})
it('coalesces viewport events into a single frame', () => {
  const { viewport, request, flush } = setup()
  viewport.dispatchEvent(new Event('scroll'))
  viewport.dispatchEvent(new Event('resize'))
  expect(request).toHaveBeenCalledTimes(1)
  flush()
})
it('releases sizing for pinch zoom and desktop layouts', () => {
  const { viewport, narrow, values, flush } = setup()
  viewport.scale = 2
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(values.size).toBe(0)
  viewport.scale = 1
  viewport.dispatchEvent(new Event('resize'))
  flush()
  expect(values.size).toBe(2)
  narrow.matches = false
  narrow.dispatchEvent(new Event('change'))
  flush()
  expect(values.size).toBe(0)
})
it('removes observers and cancels pending frames when unmounted', () => {
  const { viewport, values, flush } = setup()
  viewport.dispatchEvent(new Event('resize'))
  stop?.()
  flush()
  viewport.dispatchEvent(new Event('scroll'))
  flush()
  expect(values.size).toBe(0)
})
