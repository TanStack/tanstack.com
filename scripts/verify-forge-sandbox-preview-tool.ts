import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createForgeSandboxPreviewTunnelName,
  createForgeSandboxPreviewUrl,
  FORGE_SANDBOX_OPTIONS,
  FORGE_SANDBOX_PREVIEW_HMR_PATH,
  getForgeSandboxPreviewTunnelOptions,
  resolveForgeSandboxPreviewHmrOptions,
  resolveForgeSandboxWorkerPreviewHostname,
} from '../src/builder/runtime/sandbox-preview.server'

assert.equal(FORGE_SANDBOX_OPTIONS.transport, 'rpc')

const tunnelName = createForgeSandboxPreviewTunnelName({
  prefix: 'Forge Preview!',
  sandboxId: 'provider:sandbox:thread',
})
assert.match(tunnelName, /^forge-preview-[a-f0-9]+$/)
assert.ok(tunnelName.length <= 63)

assert.equal(
  getForgeSandboxPreviewTunnelOptions({
    env: {},
    sandboxId: 'sandbox-a',
  }),
  undefined,
  'auto mode without Cloudflare API credentials should use quick tunnels',
)

assert.deepEqual(
  getForgeSandboxPreviewTunnelOptions({
    env: { CLOUDFLARE_API_TOKEN: 'cf-test-token' },
    sandboxId: 'sandbox-a',
  }),
  {
    name: createForgeSandboxPreviewTunnelName({
      sandboxId: 'sandbox-a',
    }),
  },
  'auto mode with Cloudflare API credentials should use named tunnels',
)

assert.equal(
  getForgeSandboxPreviewTunnelOptions({
    env: {
      CLOUDFLARE_API_TOKEN: 'cf-test-token',
      FORGE_PREVIEW_TUNNEL_MODE: 'quick',
    },
    sandboxId: 'sandbox-a',
  }),
  undefined,
  'quick mode should force quick tunnels even when named-tunnel credentials exist',
)

assert.deepEqual(
  getForgeSandboxPreviewTunnelOptions({
    env: { FORGE_PREVIEW_TUNNEL_MODE: 'named' },
    sandboxId: 'sandbox-a',
  }),
  {
    name: createForgeSandboxPreviewTunnelName({
      sandboxId: 'sandbox-a',
    }),
  },
  'named mode should request a named tunnel and let the SDK report missing credentials',
)

assert.equal(
  resolveForgeSandboxWorkerPreviewHostname({
    env: { PREVIEW_HOSTNAME: 'forge.tanstack.com' },
    publicHost: 'localhost:3000',
  }),
  'localhost:3000',
  'local request hosts should use deterministic worker-preview hostnames instead of ephemeral quick-tunnel DNS',
)

assert.equal(
  resolveForgeSandboxWorkerPreviewHostname({
    env: { PREVIEW_HOSTNAME: 'forge.tanstack.com' },
    publicHost: 'tanstack.com',
  }),
  'forge.tanstack.com',
)

assert.equal(
  resolveForgeSandboxWorkerPreviewHostname({
    env: { FORGE_PREVIEW_TUNNEL_MODE: 'named' },
    publicHost: 'localhost:3000',
  }),
  undefined,
)

assert.deepEqual(
  resolveForgeSandboxPreviewHmrOptions({
    publicHost: 'localhost:3000',
  }),
  { path: FORGE_SANDBOX_PREVIEW_HMR_PATH },
)

assert.deepEqual(
  resolveForgeSandboxPreviewHmrOptions({
    publicHost: 'tanstack.com',
  }),
  { path: FORGE_SANDBOX_PREVIEW_HMR_PATH },
)

assert.deepEqual(
  resolveForgeSandboxPreviewHmrOptions({
    previewUrl: 'http://5173-sandbox-preview.localhost:3000/',
  }),
  { path: FORGE_SANDBOX_PREVIEW_HMR_PATH },
)

assert.deepEqual(
  resolveForgeSandboxPreviewHmrOptions({
    previewUrl: 'https://assist-geneva-dist-aqua.trycloudflare.com/',
  }),
  { path: FORGE_SANDBOX_PREVIEW_HMR_PATH },
)

const tunnelCalls = Array<{
  options?: { name?: string }
  port: number
}>()
const exposeCalls = Array<{
  hostname: string
  port: number
}>()

const fakeSandbox = {
  exposePort: async (port: number, options: { hostname: string }) => {
    exposeCalls.push({ hostname: options.hostname, port })

    return {
      port,
      url: `http://${port}-sandbox-a-preview_token.${options.hostname}/`,
    }
  },
  tunnels: {
    destroy: async () => undefined,
    get: async (port: number, options?: { name?: string }) => {
      tunnelCalls.push({ options, port })

      return {
        url: options?.name
          ? `https://${options.name}.example.com`
          : 'https://quick-preview.trycloudflare.com',
      }
    },
  },
}

const localAutoResult = await createForgeSandboxPreviewUrl({
  env: { PREVIEW_HOSTNAME: 'forge.tanstack.com' },
  publicHost: 'localhost:3000',
  sandbox: fakeSandbox,
  sandboxId: 'sandbox-a',
})
assert.deepEqual(localAutoResult, {
  ok: true,
  url: 'http://5173-sandbox-a-preview_token.localhost:3000/',
})
assert.deepEqual(exposeCalls[0], { hostname: 'localhost:3000', port: 5173 })
assert.equal(tunnelCalls.length, 0)

const workerResult = await createForgeSandboxPreviewUrl({
  env: { PREVIEW_HOSTNAME: 'forge.tanstack.com' },
  publicHost: 'tanstack.com',
  sandbox: fakeSandbox,
  sandboxId: 'sandbox-a',
})
assert.deepEqual(workerResult, {
  ok: true,
  url: 'http://5173-sandbox-a-preview_token.forge.tanstack.com/',
})
assert.deepEqual(exposeCalls[1], { hostname: 'forge.tanstack.com', port: 5173 })

const quickResult = await createForgeSandboxPreviewUrl({
  env: {},
  sandbox: fakeSandbox,
  sandboxId: 'sandbox-a',
})
assert.deepEqual(quickResult, {
  ok: true,
  url: 'https://quick-preview.trycloudflare.com',
})
assert.deepEqual(tunnelCalls[0], { options: undefined, port: 5173 })

const namedResult = await createForgeSandboxPreviewUrl({
  env: {
    CLOUDFLARE_API_TOKEN: 'cf-test-token',
    FORGE_PREVIEW_TUNNEL_MODE: 'named',
    FORGE_PREVIEW_TUNNEL_PREFIX: 'forge',
  },
  publicHost: 'localhost:3000',
  sandbox: fakeSandbox,
  sandboxId: 'sandbox-b',
})
const expectedName = createForgeSandboxPreviewTunnelName({
  prefix: 'forge',
  sandboxId: 'sandbox-b',
})
assert.deepEqual(namedResult, {
  ok: true,
  url: `https://${expectedName}.example.com`,
})
assert.deepEqual(tunnelCalls[1], {
  options: { name: expectedName },
  port: 5173,
})

const ambiguousTunnelCalls = Array<{
  options?: { name?: string }
  port: number
}>()
const ambiguousTunnelDestroyCalls = Array<number>()
const ambiguousTokenSandbox = {
  tunnels: {
    destroy: async (port: number) => {
      ambiguousTunnelDestroyCalls.push(port)
    },
    get: async (port: number, options?: { name?: string }) => {
      ambiguousTunnelCalls.push({ options, port })

      if (options) {
        throw new Error(
          'Cloudflare token is not scoped to a single account (ambiguous). Set CLOUDFLARE_TUNNEL_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID explicitly.',
        )
      }

      return { url: 'https://quick-preview.trycloudflare.com' }
    },
  },
}
const ambiguousTokenResult = await createForgeSandboxPreviewUrl({
  env: { CLOUDFLARE_API_TOKEN: 'cf-test-token' },
  sandbox: ambiguousTokenSandbox,
  sandboxId: 'sandbox-c',
})
assert.deepEqual(ambiguousTokenResult, {
  ok: true,
  url: 'https://quick-preview.trycloudflare.com',
})
assert.deepEqual(ambiguousTunnelCalls, [
  {
    options: {
      name: createForgeSandboxPreviewTunnelName({ sandboxId: 'sandbox-c' }),
    },
    port: 5173,
  },
  { options: undefined, port: 5173 },
])
assert.deepEqual(ambiguousTunnelDestroyCalls, [5173])

let conflictRaised = false
const conflictTunnelDestroyCalls = Array<number>()
const conflictingTunnelSandbox = {
  tunnels: {
    destroy: async (port: number) => {
      conflictTunnelDestroyCalls.push(port)
    },
    get: async (port: number, options?: { name?: string }) => {
      if (!conflictRaised) {
        conflictRaised = true
        throw new Error(
          'Tunnel on port 5173 was created with different options. Call destroy(5173) before changing tunnel options.',
        )
      }

      return {
        url: options?.name
          ? `https://${options.name}.example.com`
          : 'https://quick-preview.trycloudflare.com',
      }
    },
  },
}
const conflictTunnelResult = await createForgeSandboxPreviewUrl({
  env: { CLOUDFLARE_API_TOKEN: 'cf-test-token' },
  sandbox: conflictingTunnelSandbox,
  sandboxId: 'sandbox-d',
})
assert.equal(conflictTunnelResult.ok, true)
assert.deepEqual(conflictTunnelDestroyCalls, [5173])

assert.throws(
  () =>
    getForgeSandboxPreviewTunnelOptions({
      env: { FORGE_PREVIEW_TUNNEL_MODE: 'invalid' },
      sandboxId: 'sandbox-a',
    }),
  /FORGE_PREVIEW_URL_MODE\/FORGE_PREVIEW_TUNNEL_MODE/,
)

const implementationSource = readFileSync(
  new URL('../src/builder/runtime/sandbox-preview.server.ts', import.meta.url),
  'utf8',
)

assert.ok(implementationSource.includes('sandbox.tunnels.get('))
assert.ok(implementationSource.includes('sandbox.exposePort('))
assert.ok(implementationSource.includes('tunnels.destroy('))
assert.ok(implementationSource.includes('FORGE_PREVIEW_HMR_PATH'))
assert.ok(implementationSource.includes('FORGE_PREVIEW_WS_PATH'))
assert.ok(implementationSource.includes('forge-vite.config.mjs'))
assert.ok(implementationSource.includes('mergeConfig('))
assert.ok(implementationSource.includes('ws: {'))
assert.ok(implementationSource.includes('FORGE_ROUTE_TREE'))
assert.ok(implementationSource.includes('/@vite/client'))

console.log('Forge sandbox preview verifier passed')
