import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { preloadRecoveryScript } from '../../src/chat/core/preload-recovery'

function setup(now: () => number, storage = new Map<string, string>()) {
  let onError: ((event: { preventDefault: () => void }) => void) | undefined
  const reload = vi.fn()
  const sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  }
  runInNewContext(preloadRecoveryScript, {
    window: {
      addEventListener: (name: string, listener: typeof onError) => {
        if (name === 'vite:preloadError') onError = listener
      },
      location: { reload },
    },
    sessionStorage,
    Date: { now },
  })
  if (!onError) throw new Error('Preload recovery listener was not installed.')
  return { onError, reload }
}

describe('preload recovery', () => {
  it('reloads once for a missing chunk and stops a repeat failure from looping', () => {
    let time = 60_000
    const storage = new Map<string, string>()
    const first = setup(() => time, storage)
    const firstPrevented = vi.fn()
    first.onError({ preventDefault: firstPrevented })
    expect(firstPrevented).toHaveBeenCalledOnce()
    expect(first.reload).toHaveBeenCalledOnce()

    const afterReload = setup(() => time, storage)
    const secondPrevented = vi.fn()
    afterReload.onError({ preventDefault: secondPrevented })
    expect(secondPrevented).not.toHaveBeenCalled()
    expect(afterReload.reload).not.toHaveBeenCalled()

    time += 30_001
    afterReload.onError({ preventDefault: secondPrevented })
    expect(secondPrevented).toHaveBeenCalledOnce()
    expect(afterReload.reload).toHaveBeenCalledOnce()
  })
})
