import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConnectedDevice } from './connected-device.mjs'

test('sign-in registers without grants, respects revocation, and isolates account changes', async () => {
  const path = await mkdtemp(join(tmpdir(), 'banks-autoreg-'))
  let user = 'a',
    registrations = 0,
    devices = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json(null)
  const session = {
    fetch: async (_url, options = {}) => {
      if (!user) return new Response('', { status: 401 })
      if (options.method === 'POST') {
        const body = JSON.parse(options.body)
        if (body.type === 'register') {
          const id = String(++registrations)
          devices.push({ id, user })
          return Response.json({ id, userId: user, token: 'test' })
        }
      }
      return Response.json(
        devices.filter((d) => d.user === user),
        { headers: { 'X-Device-Account': user } },
      )
    },
  }
  const host = await createConnectedDevice({
    app: { getPath: () => path },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s),
      decryptString: (b) => b.toString(),
    },
    dialog: {},
    session,
    origin: 'https://banks.test',
  })
  try {
    await host.connect()
    assert.equal(registrations, 1)
    assert.deepEqual(host.status().folders, [])
    assert.equal(host.status().connected, true)
    devices = []
    await host.connect()
    assert.equal(registrations, 1)
    assert.equal(host.status().connected, false)
    user = null
    await host.connect()
    assert.equal(host.status().connected, false)
    user = 'b'
    await host.connect()
    assert.equal(registrations, 2)
    assert.deepEqual(host.status().folders, [])
  } finally {
    host.stop()
    globalThis.fetch = originalFetch
    await rm(path, { recursive: true, force: true })
  }
})
