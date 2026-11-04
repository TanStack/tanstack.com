import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  composerFocusHandoff,
  captureComposerFocus,
} from '../../src/chat/components/composer-focus'

afterEach(() => vi.unstubAllGlobals())
function documentFixture() {
  const source = {} as HTMLElement
  const document = Object.assign(new EventTarget(), {
    body: {} as HTMLElement,
    activeElement: source,
    visibilityState: 'visible',
    hasFocus: (): boolean => true,
  })
  const target = {
    isConnected: true,
    getClientRects: () => [{}],
    readOnly: false,
    disabled: false,
    focus: vi.fn(),
  }
  vi.stubGlobal('document', document)
  return { document, source, target: target as unknown as HTMLTextAreaElement }
}

describe('explicit first-send composer focus handoff', () => {
  it('moves focus once after the original composer unmounts', () => {
    const { document, source, target } = documentFixture()
    const handoff = composerFocusHandoff(source)
    document.activeElement = document.body
    handoff.focus(target)
    handoff.focus(target)
    expect(target.focus).toHaveBeenCalledTimes(1)
  })
  it('does not steal focus after another control was used, even if that control later unmounts', () => {
    for (const type of ['focusin', 'pointerdown']) {
      const { document, source, target } = documentFixture()
      const handoff = composerFocusHandoff(source)
      document.dispatchEvent(new Event(type))
      document.activeElement = document.body
      handoff.focus(target)
      expect(target.focus).not.toHaveBeenCalled()
    }
  })
  it('does not override current focus or enter hidden/locked composers', () => {
    for (const condition of [
      'other-focus',
      'hidden',
      'readOnly',
      'disabled',
      'disconnected',
      'hidden-pane',
      'inactive-window',
    ]) {
      const { document, source, target } = documentFixture()
      const handoff = composerFocusHandoff(source)
      if (condition === 'other-focus')
        document.activeElement = {} as HTMLElement
      if (condition === 'hidden') document.visibilityState = 'hidden'
      if (condition === 'readOnly') target.readOnly = true
      if (condition === 'disabled') target.disabled = true
      if (condition === 'disconnected')
        Object.assign(target, { isConnected: false })
      if (condition === 'hidden-pane')
        target.getClientRects = () => [] as unknown as DOMRectList
      if (condition === 'inactive-window') document.hasFocus = () => false
      handoff.focus(target)
      expect(target.focus).not.toHaveBeenCalled()
    }
  })
  it('captures a local send or Continue only from its own focused composer', () => {
    const { document, source, target } = documentFixture()
    vi.stubGlobal('HTMLElement', Object)
    const container = {
      contains: (element: unknown) => element === source,
    } as unknown as HTMLElement
    expect(captureComposerFocus(container, false)).toBeUndefined()
    expect(captureComposerFocus(null)).toBeUndefined()
    const handoff = captureComposerFocus(container)
    expect(handoff).toBeDefined()
    document.activeElement = document.body
    handoff?.focus(target)
    expect(target.focus).toHaveBeenCalledTimes(1)
    expect(captureComposerFocus(container)).toBeUndefined()
    document.activeElement = {} as HTMLElement
    expect(captureComposerFocus(container)).toBeUndefined()
  })
  it('does not steal focus when a local retry send finishes after another user action', () => {
    const { document, source, target } = documentFixture()
    vi.stubGlobal('HTMLElement', Object)
    const container = {
      contains: (element: unknown) => element === source,
    } as unknown as HTMLElement
    const handoff = captureComposerFocus(container)
    document.dispatchEvent(new Event('pointerdown'))
    document.activeElement = document.body
    handoff?.focus(target)
    expect(target.focus).not.toHaveBeenCalled()
  })
  it('cancels an abandoned navigation without a later focus side effect', () => {
    const { source, target } = documentFixture()
    const handoff = composerFocusHandoff(source)
    handoff.cancel()
    handoff.focus(target)
    expect(target.focus).not.toHaveBeenCalled()
  })
})
