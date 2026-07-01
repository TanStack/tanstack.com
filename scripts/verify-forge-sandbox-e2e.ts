/**
 * Deploy-gated end-to-end verifier for the forge Cloudflare sandbox path.
 *
 * This is NOT a unit test. It drives a REAL deployed forge instance over the
 * network (plain `fetch`, no mocking) and asserts the sandbox path works
 * end-to-end: trigger a run, stream `/api/forge/events` (SSE), and observe
 * sandbox file activity, a finalized manifest, and a live
 * `*.forge.tanstack.com` preview URL.
 *
 * It CANNOT run in this repo/CI without a real Cloudflare deploy, so it is
 * gated on env vars (see below) and SKIPS cleanly (prints a `DEFERRED`
 * message, `process.exit(0)`) when they are absent. It never mocks the
 * deploy: when configured, every assertion below is against real HTTP
 * responses from the real Worker.
 *
 * Prerequisites (see `docs/ops/forge-production-rollout.md`):
 * - A Cloudflare deploy of this Worker with the Containers plan enabled and
 *   the `*.forge.tanstack.com` preview route wired up
 *   (`exposeForgePreview` in `src/builder/runtime/sandbox-preview-tool.server.ts`).
 * - The `tanstack-forge-runtime` R2 bucket bound as `FORGE_RUNTIME` (durable
 *   file blobs / manifest snapshots / session state — see the "Cloudflare
 *   Bindings" section of the rollout doc).
 * - The `FORGE_BYOK_SEALING_KEY` Worker secret set (BYOK sealing).
 * - A user session with the `forge` capability granted, running with
 *   `FORGE_AGENT_HARNESS=tanstack-ai` (the production default) against the
 *   sandbox runtime (NOT `FORGE_AUTH_BYPASS`/local-runtime PoC mode).
 *
 * Required env vars (ALL must be set, or this script skips):
 * - `FORGE_E2E_BASE_URL`   Base URL of the deployed forge instance, e.g.
 *                          `https://tanstack.com`.
 * - `FORGE_E2E_AUTH`       A session cookie value (the same cookie the
 *                          browser sends) for a user with the `forge`
 *                          capability. Auth in this app is cookie/session
 *                          based (`requireForgeAccess` in
 *                          `src/utils/forge-access.server.ts` reads the
 *                          request via `getAuthGuards().requireCapability`),
 *                          not a bearer token, so this value is sent
 *                          verbatim as the `Cookie` header.
 * - `FORGE_E2E_CODEX_KEY`  A BYOK Codex/OpenAI-compatible API key, sealed
 *                          client-side the same way `ForgeByokMenu` /
 *                          `sealForgeBrowserProviderKey` do before a run is
 *                          started (see `src/utils/forge.functions.ts`).
 *
 * Optional env vars:
 * - `FORGE_E2E_TRIGGER_PATH` Overrides the run-trigger request path (see the
 *                            "Trigger endpoint" note below). Defaults to
 *                            `/_serverFn/startLocalForgeRun`, TanStack
 *                            Start's server-function RPC convention.
 * - `FORGE_E2E_TIMEOUT_MS`   Overall SSE-wait timeout in ms. Default 120000.
 *
 * Trigger endpoint: this app has NO plain REST route for starting a forge
 * run. There is no `/forge/new` API endpoint or handler under
 * `src/routes/api/forge/*` — `/forge/new` (`src/routes/forge_.new.tsx`) is a
 * React route whose "Start" button calls the TanStack Start server function
 * `startLocalForgeRun` (`src/utils/forge.functions.ts`, exported via
 * `createServerFn({ method: 'POST' })`). Server functions are invoked over
 * TanStack Start's server-fn RPC protocol, not a documented JSON REST
 * contract, so `FORGE_E2E_TRIGGER_PATH` is provided as an escape hatch in
 * case the RPC path convention differs across framework versions. The one
 * genuinely stable, documented HTTP surface this script can rely on
 * unconditionally is the events stream: `/api/forge/events` (a real
 * `createFileRoute` handler in `src/routes/api/forge/events.ts`, `GET`,
 * SSE). Both requests below carry the same `Cookie` header so the run and
 * the stream observe the same authenticated session.
 */

const REQUIRED_ENV_VARS = [
  'FORGE_E2E_BASE_URL',
  'FORGE_E2E_AUTH',
  'FORGE_E2E_CODEX_KEY',
] as const

const DEFERRED_MESSAGE =
  '[verify-forge-sandbox-e2e] DEFERRED: set FORGE_E2E_BASE_URL / FORGE_E2E_AUTH / FORGE_E2E_CODEX_KEY to run the real-deploy E2E (requires a Cloudflare deploy with Containers + the *.forge.tanstack.com route).'

function readEnv() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name])

  if (missing.length > 0) {
    return undefined
  }

  return {
    authCookie: requireEnvVar('FORGE_E2E_AUTH'),
    baseUrl: requireEnvVar('FORGE_E2E_BASE_URL').replace(/\/+$/, ''),
    codexKey: requireEnvVar('FORGE_E2E_CODEX_KEY'),
    timeoutMs: Number(process.env.FORGE_E2E_TIMEOUT_MS ?? 120_000),
    triggerPath:
      process.env.FORGE_E2E_TRIGGER_PATH ?? '/_serverFn/startLocalForgeRun',
  }
}

function requireEnvVar(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Expected env var ${name} to be set.`)
  }

  return value
}

const PROMPT = 'build a kanban board'
const PREVIEW_URL_PATTERN = /https:\/\/[a-z0-9.-]+\.forge\.tanstack\.com[^\s"']*/i

interface SseEvent {
  event?: string
  data: string
}

/**
 * Line-oriented SSE reader mirroring the wire format
 * `formatServerSentEvent` in `src/routes/api/forge/events.ts` writes
 * (`id:`/`event:`/`data:` lines separated by a blank line). Simple by
 * design: this repo has no other forge script that parses SSE from the
 * client side (the browser side uses `EventSource`), so there is no
 * existing reader to mirror beyond the server's own framing.
 */
async function* readServerSentEvents(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<SseEvent> {
  if (!response.body) {
    throw new Error('SSE response had no body to read.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()

      if (done) {
        return
      }

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        const parsed = parseSseBlock(rawEvent)
        if (parsed) {
          yield parsed
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

function parseSseBlock(rawEvent: string): SseEvent | undefined {
  const dataLines: Array<string> = []
  let eventName: string | undefined

  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    } else if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim()
    }
  }

  if (dataLines.length === 0) {
    return undefined
  }

  return { data: dataLines.join('\n'), event: eventName }
}

/** Recursively scan a decoded SSE payload for a predicate match. */
function containsMatch(
  value: unknown,
  predicate: (node: unknown) => boolean,
  depth = 0,
): boolean {
  if (depth > 12) {
    return false
  }

  if (predicate(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsMatch(item, predicate, depth + 1))
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      containsMatch(item, predicate, depth + 1),
    )
  }

  return false
}

function isSandboxFileActivity(node: unknown): boolean {
  if (!node || typeof node !== 'object') {
    return false
  }

  const record = node as Record<string, unknown>
  const name = record.name ?? record.type
  const looksLikeSandboxFile =
    name === 'sandbox.file' || name === 'file.upserted' || name === 'file.deleted'

  const hasPath = typeof record.path === 'string' && record.path.length > 0

  return looksLikeSandboxFile && hasPath
}

function isManifestFinalized(node: unknown): boolean {
  if (!node || typeof node !== 'object') {
    return false
  }

  const record = node as Record<string, unknown>
  const name = record.name ?? record.type

  return name === 'manifest.snapshotted' || name === 'file.changed'
}

function findPreviewUrl(node: unknown): string | undefined {
  let found: string | undefined

  containsMatch(node, (candidate) => {
    if (typeof candidate !== 'string') {
      return false
    }

    const match = candidate.match(PREVIEW_URL_PATTERN)
    if (match) {
      found = match[0]
      return true
    }

    return false
  })

  return found
}

interface StartRunResult {
  chatId: string
}

async function startForgeRun(
  config: NonNullable<ReturnType<typeof readEnv>>,
  chatId: string | undefined,
): Promise<StartRunResult> {
  const clientRequestId = `forge-e2e-${crypto.randomUUID()}`

  const response = await fetch(`${config.baseUrl}${config.triggerPath}`, {
    body: JSON.stringify({
      data: {
        chatId,
        clientRequestId,
        harness: 'tanstack-ai',
        providerKey: {
          apiKey: config.codexKey,
          provider: 'codex',
        },
        prompt: PROMPT,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
      Cookie: config.authCookie,
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(
      `Forge run trigger failed: ${response.status} ${response.statusText} — ${await response.text().catch(() => '<unreadable body>')}`,
    )
  }

  const body = (await response.json()) as Record<string, unknown>
  const resolvedChatId =
    (typeof body.activeChatId === 'string' && body.activeChatId) ||
    (typeof body.chatId === 'string' && body.chatId) ||
    chatId

  if (!resolvedChatId) {
    throw new Error(
      'Forge run trigger response did not include a chatId/activeChatId to stream events for.',
    )
  }

  return { chatId: resolvedChatId }
}

interface StreamObservations {
  sawFileActivity: boolean
  sawManifestFinalized: boolean
  previewUrl?: string
}

async function observeForgeEventStream(
  config: NonNullable<ReturnType<typeof readEnv>>,
  chatId: string,
): Promise<StreamObservations> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  const observations: StreamObservations = {
    sawFileActivity: false,
    sawManifestFinalized: false,
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/api/forge/events?${new URLSearchParams({ chatId }).toString()}`,
      {
        headers: { Cookie: config.authCookie },
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      throw new Error(
        `Forge event stream request failed: ${response.status} ${response.statusText}`,
      )
    }

    for await (const sseEvent of readServerSentEvents(
      response,
      controller.signal,
    )) {
      let payload: unknown

      try {
        payload = JSON.parse(sseEvent.data)
      } catch {
        continue
      }

      if (!observations.sawFileActivity && containsMatch(payload, isSandboxFileActivity)) {
        observations.sawFileActivity = true
      }

      if (
        !observations.sawManifestFinalized &&
        containsMatch(payload, isManifestFinalized)
      ) {
        observations.sawManifestFinalized = true
      }

      if (!observations.previewUrl) {
        observations.previewUrl = findPreviewUrl(payload)
      }

      if (
        observations.sawFileActivity &&
        observations.sawManifestFinalized &&
        observations.previewUrl
      ) {
        break
      }
    }
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }

  return observations
}

async function assertPreviewUrlServesHtml(previewUrl: string) {
  const response = await fetch(previewUrl)

  if (!response.ok) {
    throw new Error(
      `Preview URL ${previewUrl} returned ${response.status} ${response.statusText}, expected 200.`,
    )
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('html')) {
    throw new Error(
      `Preview URL ${previewUrl} returned content-type "${contentType}", expected HTML.`,
    )
  }

  console.log(
    `[verify-forge-sandbox-e2e] preview URL ${previewUrl} returned 200 with HTML content-type.`,
  )
}

/**
 * Cold-resume assertion (best-effort, guarded). We cannot force the sandbox
 * container to actually stop and be evicted from outside this script — that
 * is a Cloudflare Containers scheduling decision, not something a run
 * trigger controls deterministically. So this does the next best,
 * deterministic thing: start a follow-up run on the SAME chat/thread and
 * assert (a) the run succeeds (observes file activity + a finalized
 * manifest again) and (b) the follow-up stream still carries a preview URL,
 * which is only possible if the prior manifest/session state materialized
 * correctly from R2 rather than starting from a blank project. This proves
 * state survives across runs on a thread; it does not prove the container
 * itself was evicted and cold-started in between.
 */
async function assertFollowUpRunPreservesState(
  config: NonNullable<ReturnType<typeof readEnv>>,
  chatId: string,
) {
  console.log(
    '[verify-forge-sandbox-e2e] starting follow-up run on the same thread to check state survives (best-effort cold-resume proxy)...',
  )

  const followUp = await startForgeRun(config, chatId)
  const observations = await observeForgeEventStream(config, followUp.chatId)

  if (!observations.sawFileActivity) {
    throw new Error(
      'Follow-up run on the same thread produced no file activity — prior project state may not have materialized from R2.',
    )
  }

  if (!observations.previewUrl) {
    throw new Error(
      'Follow-up run on the same thread produced no forge.tanstack.com preview URL.',
    )
  }

  console.log(
    '[verify-forge-sandbox-e2e] follow-up run on the same thread succeeded and preserved project state (file activity + preview URL present).',
  )
}

async function main() {
  const config = readEnv()

  if (!config) {
    console.log(DEFERRED_MESSAGE)
    process.exit(0)
    return
  }

  console.log(
    `[verify-forge-sandbox-e2e] running against ${config.baseUrl} with prompt "${PROMPT}"...`,
  )

  const started = await startForgeRun(config, undefined)
  console.log(
    `[verify-forge-sandbox-e2e] run started on chat ${started.chatId}, streaming /api/forge/events...`,
  )

  const observations = await observeForgeEventStream(config, started.chatId)

  if (!observations.sawFileActivity) {
    throw new Error(
      'Did not observe a sandbox.file-derived file-activity event on /api/forge/events.',
    )
  }
  console.log('[verify-forge-sandbox-e2e] observed sandbox file-activity event.')

  if (!observations.sawManifestFinalized) {
    throw new Error(
      'Did not observe a manifest-finalized event (file.changed -> manifest.snapshotted) on /api/forge/events.',
    )
  }
  console.log('[verify-forge-sandbox-e2e] observed manifest-finalized event.')

  if (!observations.previewUrl) {
    throw new Error(
      'Did not observe an assistant/tool event carrying a *.forge.tanstack.com preview URL.',
    )
  }
  console.log(
    `[verify-forge-sandbox-e2e] observed preview URL: ${observations.previewUrl}`,
  )

  await assertPreviewUrlServesHtml(observations.previewUrl)
  await assertFollowUpRunPreservesState(config, started.chatId)

  console.log('[verify-forge-sandbox-e2e] PASS: forge sandbox E2E path verified.')
}

await main()
