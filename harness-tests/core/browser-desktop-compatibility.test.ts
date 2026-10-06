import { describe, expect, it } from 'vitest'
import {
  browserV1Methods,
  supportsDesktopBrowser,
  supportsDesktopUpdates,
} from '../../src/chat/client/desktop-compatibility'

const browser = Object.fromEntries(
  browserV1Methods.map((name) => [name, () => {}]),
)
const description = {
  appVersion: '0.1.0',
  protocols: [1],
  capabilities: ['browser.v1'],
}

describe('desktop compatibility across web releases', () => {
  it('accepts the complete unversioned development bridge', () => {
    expect(supportsDesktopBrowser({ browser })).toBe(true)
  })
  it('accepts additive future capabilities when v1 remains supported', () => {
    expect(
      supportsDesktopBrowser(
        { browser, describe() {} },
        {
          ...description,
          protocols: [1, 2],
          capabilities: ['browser.v1', 'future.v2'],
        },
      ),
    ).toBe(true)
  })
  it('does not silently treat a failed handshake as a legacy bridge', () => {
    expect(supportsDesktopBrowser({ browser, describe() {} })).toBe(false)
  })
  it('rejects unsupported protocols, missing capabilities, and partial bridges', () => {
    expect(
      supportsDesktopBrowser({ browser }, { ...description, protocols: [2] }),
    ).toBe(false)
    expect(
      supportsDesktopBrowser({ browser }, { ...description, capabilities: [] }),
    ).toBe(false)
    expect(
      supportsDesktopBrowser(
        { browser: { ...browser, setProfile: undefined } },
        description,
      ),
    ).toBe(false)
    expect(supportsDesktopBrowser(undefined)).toBe(false)
  })
})

it('keeps updating available even when browser v1 is unavailable', () => {
  const bridge = {
    updates: Object.fromEntries(
      ['state', 'check', 'download', 'install'].map((key) => [key, () => {}]),
    ),
  }
  const host = { ...description, capabilities: ['updates.v1'] }
  expect(supportsDesktopBrowser(bridge, host)).toBe(false)
  expect(supportsDesktopUpdates(bridge, host)).toBe(true)
  expect(supportsDesktopUpdates({ updates: {} }, host)).toBe(false)
})
