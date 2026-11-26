import assert from 'node:assert/strict'
import test from 'node:test'
import { copyTextPromiseToClipboard } from '../src/utils/browser-effects'

type Globals = { navigator?: unknown; ClipboardItem?: unknown }
const g = globalThis as unknown as Globals

function withGlobals(
  overrides: Globals,
  fn: () => Promise<void>,
): Promise<void> {
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const itemDesc = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
  Object.defineProperty(globalThis, 'navigator', {
    value: overrides.navigator,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'ClipboardItem', {
    value: overrides.ClipboardItem,
    configurable: true,
    writable: true,
  })
  return fn().finally(() => {
    if (navDesc) Object.defineProperty(globalThis, 'navigator', navDesc)
    else delete g.navigator
    if (itemDesc) Object.defineProperty(globalThis, 'ClipboardItem', itemDesc)
    else delete g.ClipboardItem
  })
}

class FakeClipboardItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

test('starts clipboard.write synchronously before the text resolves', async () => {
  const written: Array<unknown> = []
  let resolveText!: (text: string) => void
  const textPromise = new Promise<string>((resolve) => {
    resolveText = resolve
  })

  await withGlobals(
    {
      ClipboardItem: FakeClipboardItem,
      navigator: {
        clipboard: {
          write: async (items: Array<FakeClipboardItem>) => {
            written.push(items)
            const blob = await items[0].items['text/plain']
            assert.equal(await blob.text(), '# Markdown')
          },
          writeText: async () => {
            throw new Error('writeText should not be used')
          },
        },
      },
    },
    async () => {
      const result = copyTextPromiseToClipboard(textPromise)
      // write() must be invoked synchronously, while still in the gesture.
      assert.equal(written.length, 1)
      resolveText('# Markdown')
      assert.equal(await result, '# Markdown')
    },
  )
})

test('falls back to writeText when the promise-based write rejects', async () => {
  const writeTextCalls: Array<string> = []

  await withGlobals(
    {
      ClipboardItem: FakeClipboardItem,
      navigator: {
        clipboard: {
          write: async () => {
            throw new Error('NotAllowedError')
          },
          writeText: async (text: string) => {
            writeTextCalls.push(text)
          },
        },
      },
    },
    async () => {
      const result = await copyTextPromiseToClipboard(Promise.resolve('hello'))
      assert.equal(result, 'hello')
      assert.deepEqual(writeTextCalls, ['hello'])
    },
  )
})

test('uses writeText when ClipboardItem is unavailable', async () => {
  const writeTextCalls: Array<string> = []

  await withGlobals(
    {
      ClipboardItem: undefined,
      navigator: {
        clipboard: {
          writeText: async (text: string) => {
            writeTextCalls.push(text)
          },
        },
      },
    },
    async () => {
      assert.equal(await copyTextPromiseToClipboard(Promise.resolve('x')), 'x')
      assert.deepEqual(writeTextCalls, ['x'])
    },
  )
})
