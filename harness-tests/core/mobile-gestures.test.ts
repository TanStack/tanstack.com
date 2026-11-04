import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
  back: undefined as undefined | (() => void),
}))
vi.mock('react', () => ({
  useEffect: (fn: () => () => void) => {
    state.cleanup = fn()
  },
}))
vi.mock('../../src/chat/components/mobile-back', () => ({
  mobileBackHandler: () => state.back,
}))
vi.mock('motion', () => ({
  animate: (_from: number, to: number, options: any) => {
    options.onUpdate(to)
    options.onComplete()
    return { stop() {} }
  },
}))
import { useMobileDrawer } from '../../src/chat/components/useMobileDrawer'
afterEach(() => {
  state.cleanup?.()
  state.back = undefined
  vi.unstubAllGlobals()
})
function GestureFixture(open = false) {
  const listeners = new Map<string, (event: any) => void>()
  const style = { removeProperty: vi.fn() }
  const panel = {
    style,
    getBoundingClientRect: () => ({ width: 300 }),
    parentElement: { contains: () => true, querySelector: () => panel },
  }
  vi.stubGlobal('document', {
    querySelector: () => null,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  })
  vi.stubGlobal('window', {
    innerWidth: 390,
    getSelection: () => null,
    matchMedia: () => ({ matches: true }),
  })
  vi.stubGlobal('getComputedStyle', () => ({ overflowX: 'visible' }))
  const target = {
    closest: (selector: string) =>
      selector.includes('.main-header') ? target : null,
    parentElement: panel.parentElement,
    scrollWidth: 0,
    clientWidth: 0,
  }
  const setOpen = vi.fn()
  useMobileDrawer({ current: panel } as any, true, open, setOpen)
  const send = (name: string, x: number, y = 50, timeStamp = 100) => {
    const event = {
      touches: [{ clientX: x, clientY: y }],
      target,
      cancelable: true,
      preventDefault: vi.fn(),
      timeStamp,
    }
    listeners.get(name)?.(event)
    return event
  }
  return { send, setOpen, listeners }
}
it('claims both browser edges before native navigation starts', () => {
  const h = GestureFixture()
  expect(h.send('touchstart', 2).preventDefault).toHaveBeenCalled()
  expect(h.send('touchstart', 388).preventDefault).toHaveBeenCalled()
  expect(h.send('touchstart', 100).preventDefault).not.toHaveBeenCalled()
})
it('opens the drawer after a deliberate right swipe', () => {
  const h = GestureFixture()
  h.send('touchstart', 25)
  h.send('touchmove', 180)
  h.send('touchend', 180, 50, 400)
  expect(h.setOpen).toHaveBeenCalledWith(true)
})
it('leaves vertical scrolling alone', () => {
  const h = GestureFixture()
  h.send('touchstart', 80)
  expect(h.send('touchmove', 82, 150).preventDefault).not.toHaveBeenCalled()
  h.send('touchend', 82, 150)
  expect(h.setOpen).not.toHaveBeenCalled()
})
it('cancellation never navigates', () => {
  const h = GestureFixture()
  h.send('touchstart', 25)
  h.send('touchmove', 180)
  h.send('touchcancel', 180)
  h.send('touchend', 180)
  expect(h.setOpen).not.toHaveBeenCalled()
})

it('returns to the parent instead of opening the drawer in a thread', () => {
  state.back = vi.fn()
  const h = GestureFixture()
  h.send('touchstart', 25)
  h.send('touchmove', 180)
  h.send('touchend', 180, 50, 400)
  expect(state.back).toHaveBeenCalledOnce()
  expect(h.setOpen).not.toHaveBeenCalled()
})
it('closes the drawer with a left swipe', () => {
  const h = GestureFixture(true)
  h.send('touchstart', 250)
  h.send('touchmove', 80)
  h.send('touchend', 80, 50, 400)
  expect(h.setOpen).toHaveBeenCalledWith(false)
})
