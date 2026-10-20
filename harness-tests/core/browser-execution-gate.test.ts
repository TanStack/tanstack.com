import { afterEach, expect, it, vi } from 'vitest'
import {
  type BrowserExecutionEnvironment,
  browserExecutionEnabled,
  browserExecutionRequestAllowed,
} from '../../src/chat/server/browser-execution'

const env = (vars: BrowserExecutionEnvironment = {}) => ({
  APP_MODE: 'live',
  GUM_DEV_EXECUTION: 'enabled',
  ...vars,
})

afterEach(() => vi.unstubAllGlobals())

it('requires both the dev build and explicit opt-in, even on localhost', () => {
  const request = new Request('http://127.0.0.1:3002/api/example')
  expect(browserExecutionRequestAllowed(request, env())).toBe(false)
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', false)
  expect(browserExecutionEnabled(env())).toBe(false)
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  expect(browserExecutionEnabled(env({ GUM_DEV_EXECUTION: 'disabled' }))).toBe(
    false,
  )
  expect(browserExecutionRequestAllowed(request, env())).toBe(true)
})

it('rejects fixture authentication and non-loopback origins', () => {
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  expect(browserExecutionEnabled(env({ APP_MODE: 'fixture' }))).toBe(false)
  for (const origin of [
    'https://gum.example.com',
    'http://localhost.evil.invalid',
    'http://192.168.1.1',
  ])
    expect(browserExecutionRequestAllowed(new Request(origin), env())).toBe(
      false,
    )
  for (const origin of [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://[::1]:3002',
  ])
    expect(browserExecutionRequestAllowed(new Request(origin), env())).toBe(
      true,
    )
})
