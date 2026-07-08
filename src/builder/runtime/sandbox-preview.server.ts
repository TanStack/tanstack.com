import { createHash } from 'node:crypto'
import type { SandboxOptions, TunnelOptions } from '@cloudflare/sandbox'

export const FORGE_SANDBOX_PREVIEW_PORT = 5173
export const FORGE_SANDBOX_PREVIEW_HMR_PATH = '/__forge_hmr'
const FORGE_SANDBOX_PREVIEW_VITE_CONFIG = '/tmp/forge-vite.config.mjs'
export const FORGE_SANDBOX_OPTIONS: SandboxOptions = {
  normalizeId: true,
  transport: 'rpc',
}

export const FORGE_SANDBOX_PREVIEW_START_COMMAND = [
  [
    `cat > ${FORGE_SANDBOX_PREVIEW_VITE_CONFIG} <<'FORGE_VITE_CONFIG'`,
    "import { createRequire } from 'node:module'",
    "import appConfig from '/workspace/app/vite.config.ts'",
    '',
    "const require = createRequire('/workspace/app/package.json')",
    "const { defineConfig, mergeConfig } = await import(require.resolve('vite'))",
    '',
    'const forgePreviewServerConfig = {',
    '  server: {',
    '    allowedHosts: true,',
    '    host: true,',
    '    watch: { usePolling: true, interval: 300 },',
    '    ws: {',
    '      path:',
    '        process.env.FORGE_PREVIEW_WS_PATH ||',
    '        process.env.FORGE_PREVIEW_HMR_PATH ||',
    '        undefined,',
    '    },',
    '  },',
    '}',
    '',
    'async function resolveAppConfig(env) {',
    "  return typeof appConfig === 'function' ? await appConfig(env) : appConfig",
    '}',
    '',
    'export default defineConfig(async (env) =>',
    '  mergeConfig(await resolveAppConfig(env), forgePreviewServerConfig),',
    ')',
    'FORGE_VITE_CONFIG',
  ].join('\n'),
  'cd /workspace/app',
  'export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=lvh.me',
  'export npm_config_fetch_timeout=600000',
  'export npm_config_fetch_retries=8',
  'export npm_config_fetch_retry_mintimeout=10000',
  'export npm_config_fetch_retry_maxtimeout=120000',
  'export CHOKIDAR_USEPOLLING=true',
  'export CHOKIDAR_INTERVAL=300',
  'export WATCHPACK_POLLING=true',
  'if command -v pnpm >/dev/null 2>&1; then',
  '  if [ ! -x node_modules/.bin/vite ]; then',
  '    pnpm install --offline --frozen-lockfile=false || { echo "node_modules/.bin/vite is missing and offline install failed; preview startup will not run a network install."; exit 42; }',
  '  fi',
  createForgeSandboxRouteTreeGenerationCommand('  '),
  `  exec pnpm exec vite dev --config ${FORGE_SANDBOX_PREVIEW_VITE_CONFIG} --host 0.0.0.0 --port ${FORGE_SANDBOX_PREVIEW_PORT} --strictPort`,
  'else',
  '  if [ ! -x node_modules/.bin/vite ]; then',
  '    echo "node_modules/.bin/vite is missing and pnpm is unavailable; preview startup cannot repair dependencies."; exit 42',
  '  fi',
  createForgeSandboxRouteTreeGenerationCommand('  '),
  `  exec npx vite dev --config ${FORGE_SANDBOX_PREVIEW_VITE_CONFIG} --host 0.0.0.0 --port ${FORGE_SANDBOX_PREVIEW_PORT} --strictPort`,
  'fi',
].join('\n')

function createForgeSandboxRouteTreeGenerationCommand(indent: string) {
  return [
    `${indent}if [ -f src/router.tsx ] && [ -d src/routes ]; then`,
    `${indent}  node --input-type=module <<'FORGE_ROUTE_TREE' >/tmp/forge-route-tree.log 2>&1 || true`,
    "import { Generator, getConfig } from '@tanstack/router-generator'",
    'const root = process.cwd()',
    "const config = getConfig({ target: 'react', routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts', disableLogging: true }, root)",
    'await new Generator({ config, root }).run()',
    'FORGE_ROUTE_TREE',
    `${indent}fi`,
  ].join('\n')
}

const DEFAULT_TUNNEL_NAME_PREFIX = 'forge'
const MAX_TUNNEL_NAME_LENGTH = 63
const MAX_TUNNEL_PREFIX_LENGTH = 20

type ForgeSandboxPreviewUrlMode = 'auto' | 'named' | 'quick' | 'worker'

export interface ForgeSandboxPreviewTunnelEnv {
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_TUNNEL_ACCOUNT_ID?: string
  CLOUDFLARE_TUNNEL_ZONE_ID?: string
  CLOUDFLARE_ZONE_ID?: string
  FORGE_PREVIEW_URL_MODE?: string
  FORGE_PREVIEW_TUNNEL_MODE?: string
  FORGE_PREVIEW_TUNNEL_PREFIX?: string
  PREVIEW_HOSTNAME?: string
}

export interface ForgeSandboxPreviewTunnelHandle {
  exposePort?: (
    port: number,
    options: { hostname: string; name?: string; token?: string },
  ) => Promise<{ name?: string; port: number; url: string }>
  tunnels: {
    destroy(port: number): Promise<void>
    get(port: number, options?: TunnelOptions): Promise<{ url: string }>
  }
}

export interface ForgeSandboxExecHandle {
  exec(
    command: string,
    options?: { cwd?: string; timeout?: number },
  ): Promise<{
    exitCode: number
    stderr?: string
    stdout?: string
  }>
}

export type ForgeSandboxPreviewUrlResult =
  | {
      ok: true
      url: string
    }
  | {
      message: string
      ok: false
    }

export type ForgeSandboxPreviewRestartResult =
  | {
      ok: true
    }
  | {
      logTail?: string
      ok: false
    }

export interface ForgeSandboxPreviewHmrOptions {
  path: string
}

export interface ForgeSandboxPreviewRestartOptions {
  hmr?: ForgeSandboxPreviewHmrOptions
  waitTimeoutMs?: number
}

export async function createForgeSandboxPreviewUrl({
  env,
  port = FORGE_SANDBOX_PREVIEW_PORT,
  publicHost,
  sandbox,
  sandboxId,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  port?: number
  publicHost?: string
  sandbox: ForgeSandboxPreviewTunnelHandle
  sandboxId: string
}): Promise<ForgeSandboxPreviewUrlResult> {
  const mode = normalizePreviewUrlMode({
    tunnelMode: env.FORGE_PREVIEW_TUNNEL_MODE,
    urlMode: env.FORGE_PREVIEW_URL_MODE,
  })
  const workerHostname = resolveForgeSandboxWorkerPreviewHostname({
    env,
    mode,
    publicHost,
  })

  if (workerHostname && (mode === 'auto' || mode === 'worker')) {
    const workerPreview = await createForgeSandboxWorkerPreviewUrl({
      hostname: workerHostname,
      port,
      sandbox,
    })

    if (workerPreview.ok || mode === 'worker') {
      return workerPreview
    }
  }

  try {
    const options = getForgeSandboxPreviewTunnelOptions({
      env,
      mode,
      sandboxId,
    })
    const tunnel = await getForgeSandboxPreviewTunnel({
      options,
      port,
      sandbox,
    })

    return { ok: true, url: tunnel.url }
  } catch (error) {
    if (mode === 'auto' && shouldFallbackToQuickTunnel(error)) {
      try {
        await sandbox.tunnels.destroy(port).catch(() => undefined)
        const tunnel = await sandbox.tunnels.get(port)

        return { ok: true, url: tunnel.url }
      } catch (fallbackError) {
        return {
          message: readErrorMessage(fallbackError),
          ok: false,
        }
      }
    }

    return {
      message: readErrorMessage(error),
      ok: false,
    }
  }
}

export async function waitForForgeSandboxPreviewUrl({
  pollMs = 1_000,
  probeTimeoutMs = 2_000,
  timeoutMs,
  url,
}: {
  pollMs?: number
  probeTimeoutMs?: number
  timeoutMs: number
  url: string
}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (
      await forgeSandboxPreviewUrlIsReachable({
        timeoutMs: probeTimeoutMs,
        url,
      })
    ) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  return false
}

export function isForgeSandboxQuickTunnelUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith('.trycloudflare.com')
  } catch {
    return false
  }
}

async function forgeSandboxPreviewUrlIsReachable({
  timeoutMs,
  url,
}: {
  timeoutMs: number
  url: string
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })
    const reachable = response.status >= 200 && response.status < 500

    await response.body?.cancel().catch(() => undefined)

    return reachable
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function createForgeSandboxWorkerPreviewUrl({
  hostname,
  port,
  sandbox,
}: {
  hostname: string
  port: number
  sandbox: ForgeSandboxPreviewTunnelHandle
}): Promise<ForgeSandboxPreviewUrlResult> {
  if (!sandbox.exposePort) {
    return {
      message:
        'Forge sandbox worker preview is unavailable because sandbox.exposePort is not available.',
      ok: false,
    }
  }

  try {
    const preview = await sandbox.exposePort(port, { hostname })

    return { ok: true, url: preview.url }
  } catch (error) {
    return {
      message: readErrorMessage(error),
      ok: false,
    }
  }
}

async function getForgeSandboxPreviewTunnel({
  options,
  port,
  sandbox,
}: {
  options: TunnelOptions | undefined
  port: number
  sandbox: ForgeSandboxPreviewTunnelHandle
}) {
  try {
    return options
      ? await sandbox.tunnels.get(port, options)
      : await sandbox.tunnels.get(port)
  } catch (error) {
    if (!isTunnelOptionsConflict(error)) {
      throw error
    }

    await sandbox.tunnels.destroy(port).catch(() => undefined)

    return options
      ? await sandbox.tunnels.get(port, options)
      : await sandbox.tunnels.get(port)
  }
}

export function getForgeSandboxPreviewTunnelOptions({
  env,
  mode = normalizePreviewUrlMode({
    tunnelMode: env.FORGE_PREVIEW_TUNNEL_MODE,
    urlMode: env.FORGE_PREVIEW_URL_MODE,
  }),
  sandboxId,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  mode?: ForgeSandboxPreviewUrlMode
  sandboxId: string
}): TunnelOptions | undefined {
  if (mode === 'quick' || mode === 'worker') {
    return undefined
  }

  const hasNamedTunnelCredentials = Boolean(
    readNonEmptyString(env.CLOUDFLARE_API_TOKEN),
  )

  if (mode === 'auto' && !hasNamedTunnelCredentials) {
    return undefined
  }

  return {
    name: createForgeSandboxPreviewTunnelName({
      prefix: env.FORGE_PREVIEW_TUNNEL_PREFIX,
      sandboxId,
    }),
  }
}

export function resolveForgeSandboxWorkerPreviewHostname({
  env,
  mode = normalizePreviewUrlMode({
    tunnelMode: env.FORGE_PREVIEW_TUNNEL_MODE,
    urlMode: env.FORGE_PREVIEW_URL_MODE,
  }),
  publicHost,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  mode?: ForgeSandboxPreviewUrlMode
  publicHost?: string
}) {
  if (mode === 'named' || mode === 'quick') {
    return undefined
  }

  const normalizedPublicHost = normalizePreviewHostname(publicHost)

  if (normalizedPublicHost && isLocalPreviewHostname(normalizedPublicHost)) {
    return normalizeLocalPreviewHostname(normalizedPublicHost)
  }

  const normalizedPreviewHostname = normalizePreviewHostname(
    env.PREVIEW_HOSTNAME,
  )

  if (env.PREVIEW_HOSTNAME !== undefined && !normalizedPreviewHostname) {
    throw new Error(
      'PREVIEW_HOSTNAME is set but empty. Unset it or provide a real preview hostname.',
    )
  }

  const hostname = normalizedPreviewHostname ?? normalizedPublicHost

  if (!hostname) {
    return undefined
  }

  if (mode === 'auto' && hostname.endsWith('.workers.dev')) {
    return undefined
  }

  return hostname
}

export function resolveForgeSandboxPreviewHmrOptions({
  previewUrl: _previewUrl,
  publicHost: _publicHost,
}: {
  previewUrl?: string
  publicHost?: string
}): ForgeSandboxPreviewHmrOptions | undefined {
  return {
    path: FORGE_SANDBOX_PREVIEW_HMR_PATH,
  }
}

function shouldFallbackToQuickTunnel(error: unknown) {
  const message = readErrorMessage(error).toLowerCase()

  return (
    message.includes('cloudflare token is not scoped to a single account') ||
    message.includes('cloudflare token is not scoped to a single zone') ||
    message.includes('set cloudflare_tunnel_account_id') ||
    message.includes('set cloudflare_account_id') ||
    message.includes('set cloudflare_zone_id')
  )
}

function isTunnelOptionsConflict(error: unknown) {
  const message = readErrorMessage(error).toLowerCase()

  return (
    message.includes('created with different options') &&
    message.includes('call destroy')
  )
}

function readErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unknown preview tunnel startup error.'
}

export function createForgeSandboxPreviewTunnelName({
  prefix,
  sandboxId,
}: {
  prefix?: string
  sandboxId: string
}) {
  const normalizedPrefix = normalizeTunnelNamePrefix(prefix)
  const hash = createHash('sha256').update(sandboxId).digest('hex')
  const hashLength = MAX_TUNNEL_NAME_LENGTH - normalizedPrefix.length - 1

  return `${normalizedPrefix}-${hash.slice(0, hashLength)}`
}

export async function forgeSandboxPortIsListening({
  port = FORGE_SANDBOX_PREVIEW_PORT,
  sandbox,
  timeoutMs = 750,
}: {
  port?: number
  sandbox: ForgeSandboxExecHandle
  timeoutMs?: number
}) {
  const result = await sandbox
    .exec(
      [
        'node',
        '-e',
        JSON.stringify(
          [
            "const net = require('node:net')",
            `const socket = net.connect(${port}, '127.0.0.1')`,
            'const done = (code) => { socket.destroy(); process.exit(code) }',
            "socket.once('connect', () => done(0))",
            "socket.once('error', () => done(1))",
            `setTimeout(() => done(1), ${timeoutMs})`,
          ].join(';'),
        ),
      ].join(' '),
      { timeout: Math.max(1_000, timeoutMs + 500) },
    )
    .catch(() => undefined)

  return result?.exitCode === 0
}

export async function forgeSandboxPreviewDevServerHasHmrPath({
  path = FORGE_SANDBOX_PREVIEW_HMR_PATH,
  port = FORGE_SANDBOX_PREVIEW_PORT,
  sandbox,
  timeoutMs = 2_500,
}: {
  path?: string
  port?: number
  sandbox: ForgeSandboxExecHandle
  timeoutMs?: number
}) {
  const result = await sandbox
    .exec(
      [
        'node',
        '-e',
        JSON.stringify(
          [
            "const http = require('node:http')",
            'let body = ""',
            `const req = http.get({ host: '127.0.0.1', port: ${port}, path: '/@vite/client', timeout: ${timeoutMs} }, (response) => {`,
            "  response.setEncoding('utf8')",
            "  response.on('data', (chunk) => { body += chunk })",
            "  response.on('end', () => process.exit(response.statusCode >= 200 && response.statusCode < 300 && body.includes(" +
              JSON.stringify(path) +
              ') ? 0 : 1))',
            '})',
            "req.on('timeout', () => { req.destroy(); process.exit(1) })",
            "req.on('error', () => process.exit(1))",
          ].join(';'),
        ),
      ].join(' '),
      { timeout: Math.max(3_000, timeoutMs + 1_000) },
    )
    .catch(() => undefined)

  return result?.exitCode === 0
}

export async function restartForgeSandboxPreviewDevServer(
  sandbox: ForgeSandboxExecHandle,
  options: ForgeSandboxPreviewRestartOptions = {},
): Promise<ForgeSandboxPreviewRestartResult> {
  const waitTimeoutMs = options.waitTimeoutMs ?? 180_000
  const hmrEnvironmentLines = createForgeSandboxPreviewHmrEnvironmentLines(
    options.hmr,
  )

  await sandbox
    .exec(
      [
        "cat > /tmp/forge-preview-start.sh <<'FORGE_PREVIEW_EOF'",
        ...hmrEnvironmentLines,
        FORGE_SANDBOX_PREVIEW_START_COMMAND,
        'FORGE_PREVIEW_EOF',
        'chmod +x /tmp/forge-preview-start.sh',
        "pkill -f '[v]ite|[v]inxi|[t]anstack-start|[p]npm install|[n]pm install|[n]px vite' 2>/dev/null || true",
        'nohup /bin/sh /tmp/forge-preview-start.sh > /tmp/forge-preview.log 2>&1 &',
        'echo $! > /tmp/forge-preview.pid',
      ].join('\n'),
      { timeout: 5_000 },
    )
    .catch(() => undefined)

  const startedAt = Date.now()

  while (Date.now() - startedAt < waitTimeoutMs) {
    if (await forgeSandboxPortIsListening({ sandbox })) {
      return { ok: true }
    }

    if (!(await forgeSandboxPreviewStartProcessIsAlive(sandbox))) {
      return {
        logTail: await readForgeSandboxPreviewLogTail(sandbox),
        ok: false,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return {
    logTail: await readForgeSandboxPreviewLogTail(sandbox),
    ok: false,
  }
}

async function forgeSandboxPreviewStartProcessIsAlive(
  sandbox: ForgeSandboxExecHandle,
) {
  const result = await sandbox
    .exec(
      'test -s /tmp/forge-preview.pid && kill -0 "$(cat /tmp/forge-preview.pid)" 2>/dev/null',
      { timeout: 2_000 },
    )
    .catch(() => undefined)

  return result?.exitCode === 0
}

export async function readForgeSandboxPreviewLogTail(
  sandbox: ForgeSandboxExecHandle,
) {
  const result = await sandbox
    .exec('tail -n 120 /tmp/forge-preview.log 2>&1 || true', { timeout: 5_000 })
    .catch(() => undefined)

  return result?.stdout?.trim() || result?.stderr?.trim() || undefined
}

function createForgeSandboxPreviewHmrEnvironmentLines(
  hmr: ForgeSandboxPreviewHmrOptions | undefined,
) {
  if (!hmr) {
    return []
  }

  return [
    `export FORGE_PREVIEW_HMR_PATH=${hmr.path}`,
    `export FORGE_PREVIEW_WS_PATH=${hmr.path}`,
  ]
}

function normalizePreviewUrlMode({
  tunnelMode,
  urlMode,
}: {
  tunnelMode?: string
  urlMode?: string
}): ForgeSandboxPreviewUrlMode {
  const normalized = (urlMode ?? tunnelMode)?.trim().toLowerCase()

  switch (normalized) {
    case undefined:
    case '':
    case 'auto':
      return 'auto'
    case 'named':
      return 'named'
    case 'quick':
      return 'quick'
    case 'worker':
      return 'worker'
    default:
      throw new Error(
        'FORGE_PREVIEW_URL_MODE/FORGE_PREVIEW_TUNNEL_MODE must be "auto", "worker", "named", or "quick".',
      )
  }
}

function normalizePreviewHostname(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).host || undefined
    } catch {
      return undefined
    }
  }

  const [host] = trimmed.replace(/^\/+/, '').split('/')

  return host || undefined
}

function isLocalPreviewHostname(value: string) {
  const hostname = readHostname(value)

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

function normalizeLocalPreviewHostname(value: string) {
  try {
    const url = new URL(`http://${value}`)
    url.hostname = 'localhost'

    return url.host
  } catch {
    return 'localhost'
  }
}

function readHostname(value: string) {
  try {
    return new URL(`http://${value}`).hostname
  } catch {
    return value.split(':')[0] ?? value
  }
}

function normalizeTunnelNamePrefix(prefix: string | undefined) {
  const normalized =
    prefix
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_TUNNEL_PREFIX_LENGTH)
      .replace(/-+$/g, '') || DEFAULT_TUNNEL_NAME_PREFIX

  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return normalized
  }

  return DEFAULT_TUNNEL_NAME_PREFIX
}

function readNonEmptyString(value: string | undefined) {
  return value && value.trim().length > 0 ? value : undefined
}
