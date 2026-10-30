import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
const effects = vi.hoisted(() => ({
  layout: undefined as undefined | (() => () => void),
}))
vi.mock('react', () => ({
  useLayoutEffect: (effect: () => () => void) => {
    effects.layout = effect
  },
  useEffect: () => {},
  useSyncExternalStore: () => {},
}))
import { AppearanceSync } from '../../src/chat/components/Appearance'
afterEach(() => {
  effects.layout = undefined
  vi.unstubAllGlobals()
})
import {
  appearanceScript,
  type ChatDocumentAppearance,
} from '../../src/chat/core/appearance-bootstrap'

it('captures the shared document before the chat startup palette changes it', () => {
  const values = new Map([
    ['--background', '#ffffff'],
    ['color-scheme', 'light'],
  ])
  const attributes = new Map([['data-appearance', 'light']])
  const meta = { content: '#ffffff', getAttribute: () => 'screen' }
  const root = {
    dataset: { appearance: 'light' },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    style: {
      colorScheme: 'light',
      getPropertyValue: (name: string) => values.get(name) ?? '',
      getPropertyPriority: () => '',
      setProperty: (name: string, value: string) => values.set(name, value),
    },
  }
  const window: { __TANCHAT_PRE_CHAT_APPEARANCE__?: ChatDocumentAppearance } =
    {}
  runInNewContext(appearanceScript, {
    window,
    document: { documentElement: root, querySelectorAll: () => [meta] },
    localStorage: {
      getItem: (key: string) =>
        key === 'gum.appearance.settings'
          ? JSON.stringify({
              mode: 'dark',
              darkCustom: { background: '#111111' },
            })
          : null,
    },
    matchMedia: () => ({ matches: false }),
  })
  expect(root.dataset.appearance).toBe('dark')
  expect(values.get('--background')).toBe('#111111')
  expect(window.__TANCHAT_PRE_CHAT_APPEARANCE__?.appearance).toBe('light')
  expect(
    window.__TANCHAT_PRE_CHAT_APPEARANCE__?.previous.find(
      (value) => value.name === '--background',
    )?.value,
  ).toBe('#ffffff')
  expect(window.__TANCHAT_PRE_CHAT_APPEARANCE__?.metas[0]?.content).toBe(
    '#ffffff',
  )
})

it('restores the pre-bootstrap site state on chat unmount and consumes the snapshot', () => {
  const values = new Map([
    ['--background', '#111111'],
    ['--accent-hover', '#333333'],
  ])
  const attributes = new Map([
    ['data-appearance', 'dark'],
    ['data-appearance-choice', 'dark'],
  ])
  const metaAttributes = new Map<string, string>()
  const meta = {
    content: '#111111',
    getAttribute: (name: string) => metaAttributes.get(name) ?? null,
    setAttribute: (name: string, value: string) =>
      metaAttributes.set(name, value),
    removeAttribute: (name: string) => metaAttributes.delete(name),
  }
  const root = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    style: {
      getPropertyValue: (name: string) => values.get(name) ?? '',
      getPropertyPriority: () => '',
      setProperty: (name: string, value: string) => values.set(name, value),
      removeProperty: (name: string) => values.delete(name),
    },
  }
  const window = {
    __TANCHAT_PRE_CHAT_APPEARANCE__: {
      previous: [
        { name: '--background', value: '#ffffff', priority: '' },
        { name: '--accent-hover', value: '', priority: '' },
      ],
      appearance: 'light',
      choice: null,
      metas: [{ meta, content: '#ffffff', media: 'screen' }],
    },
  }
  vi.stubGlobal('window', window)
  vi.stubGlobal('document', {
    documentElement: root,
    querySelectorAll: () => [meta],
  })
  AppearanceSync()
  const cleanup = effects.layout?.()
  expect(window).not.toHaveProperty('__TANCHAT_PRE_CHAT_APPEARANCE__')
  expect(values.get('--background')).toBe('#111111')
  cleanup?.()
  expect(values.get('--background')).toBe('#ffffff')
  expect(values.has('--accent-hover')).toBe(false)
  expect(attributes.get('data-appearance')).toBe('light')
  expect(attributes.has('data-appearance-choice')).toBe(false)
  expect(meta.content).toBe('#ffffff')
  expect(metaAttributes.get('media')).toBe('screen')
})
