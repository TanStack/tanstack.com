import { createFileRoute } from '@tanstack/react-router'
import { getSandbox } from '@cloudflare/sandbox'
import {
  appendLocalForgeRuntimeEvent,
  readLocalForgeSnapshotForRuntimeSession,
  withLocalForgeRuntimeSession,
  type LocalForgeChat,
  type LocalForgeSnapshot,
} from '~/builder/runtime/local-store.server'
import {
  readForgeMetaSessionForChat,
  toLocalForgeChats,
} from '~/builder/runtime/forge-meta.server'
import { getForgeSandboxProviderId } from '~/builder/runtime/sandbox-agent.server'
import {
  createForgeSandboxPreviewUrl,
  forgeSandboxPreviewDevServerHasHmrPath,
  forgeSandboxPortIsListening,
  FORGE_SANDBOX_OPTIONS,
  FORGE_SANDBOX_PREVIEW_HMR_PATH,
  FORGE_SANDBOX_PREVIEW_PORT,
  readForgeSandboxPreviewLogTail,
  restartForgeSandboxPreviewDevServer,
  resolveForgeSandboxPreviewHmrOptions,
  type ForgeSandboxPreviewTunnelEnv,
} from '~/builder/runtime/sandbox-preview.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  getForgeAccessErrorResponse,
  isForgeAuthBypassEnabled,
  requireForgeAccess,
} from '~/utils/forge-access.server'
import {
  createForgeBypassRuntimeScope,
  LOCAL_FORGE_PROJECT_ID,
  readForgeBypassRuntimeSnapshot,
} from '~/utils/forge-bypass-runtime.server'

const FORGE_SANDBOX_PREVIEW_ATTACH_TUNNEL_WAIT_MS = 45_000
const FORGE_SANDBOX_PREVIEW_ATTACH_PORT_WAIT_MS = 250
const FORGE_SANDBOX_PREVIEW_TUNNEL_ATTEMPTS = 3
const FORGE_SANDBOX_PREVIEW_TUNNEL_READY_POLL_MS = 1_000
const FORGE_SANDBOX_PREVIEW_TUNNEL_READY_TIMEOUT_MS = 8_000
const FORGE_SANDBOX_PREVIEW_TUNNEL_PROBE_TIMEOUT_MS = 2_000
const FORGE_SANDBOX_PREVIEW_RESET_WAIT_MS = 60_000

interface ForgePreviewScope {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}

export const Route = createFileRoute('/api/forge/preview/reconnect')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          return getForgeAccessErrorResponse(error)
        }

        const body = await readReconnectBody(request)

        if (!body.ok) {
          return Response.json({ error: body.error }, { status: 400 })
        }

        const scope = isForgeAuthBypassEnabled()
          ? createForgeBypassRuntimeScope({ chatId: body.chatId })
          : await readForgePreviewScope({
              chatId: body.chatId,
              userId: user.userId,
            })
        const hostEnv = await getHostRuntimeEnv()

        if (!hostEnv || !isForgeSandboxBinding(hostEnv.Sandbox)) {
          return Response.json(
            { error: 'Forge sandbox binding is not available.' },
            { status: 503 },
          )
        }

        const publicHost = new URL(request.url).host
        const sandboxId = getForgeSandboxProviderId({
          projectId: LOCAL_FORGE_PROJECT_ID,
          threadId: scope.runtimeSessionId,
        })
        let sandbox = getSandbox(
          hostEnv.Sandbox,
          sandboxId,
          FORGE_SANDBOX_OPTIONS,
        )

        return withLocalForgeRuntimeSession(scope.runtimeSessionId, async () => {
          const attachStartedAt = Date.now()

          if (body.diagnoseOnly) {
            return Response.json(await readForgeSandboxTunnelDiagnostics(sandbox))
          }

          if (body.mode === 'attach' || body.mode === 'retunnel') {
            const attached = await attachForgeSandboxPreview({
              env: readForgePreviewTunnelEnv(hostEnv),
              publicHost,
              refreshTunnel: body.mode === 'retunnel',
              sandbox,
              sandboxId,
            })

            if (!attached.ok) {
              return Response.json({
                attached: false,
                message: attached.message,
                reason: 'reason' in attached ? attached.reason : undefined,
                url: undefined,
              })
            }

            await appendForgePreviewRuntimeEvent({
              detail: attached.url,
              message: 'Sandbox preview reconnected',
              name: 'workflow.preview.reconnected',
              producerId: 'forge-preview',
              runId: `preview-reconnect-${crypto.randomUUID()}`,
              startedAt: attachStartedAt,
              status: 'finished',
            })

            return Response.json({
              attached: true,
              url: attached.url,
            })
          }

          const snapshot = isForgeAuthBypassEnabled()
            ? await readForgeBypassRuntimeSnapshot({
                chatId: body.chatId,
              })
            : await readLocalForgeSnapshotForRuntimeSession(scope)
          const resetRequested = body.mode === 'reset'

          if (resetRequested) {
            await destroyForgeSandboxPreview(sandbox)
            sandbox = getSandbox(
              hostEnv.Sandbox,
              sandboxId,
              FORGE_SANDBOX_OPTIONS,
            )
          }

          const materializeResult =
            await materializeForgeSnapshotIntoSandboxPreview({
              sandbox,
              snapshot,
            })

          if (!materializeResult.ok) {
            return Response.json(
              {
                error: 'Forge sandbox preview workspace could not be materialized.',
                message: materializeResult.message,
              },
              { status: 500 },
            )
          }

          const hmr = resolveForgeSandboxPreviewHmrOptions({ publicHost })
          let restartResult = await restartForgeSandboxPreviewDevServer(
            sandbox,
            hmr ? { hmr } : {},
          )

          if (
            !restartResult.ok &&
            !resetRequested &&
            canResetForgeSandboxPreviewAfterRestartFailure({
              logTail: restartResult.logTail,
              snapshot,
            })
          ) {
            await appendForgePreviewRuntimeEvent({
              detail:
                restartResult.logTail ||
                'Preview dependencies were missing from the sandbox.',
              message: 'Sandbox preview reset starting',
              name: 'workflow.preview.reset.starting',
              producerId: 'forge-preview',
              runId: `preview-reset-${crypto.randomUUID()}`,
              startedAt: attachStartedAt,
              status: 'running',
            })

            await destroyForgeSandboxPreview(sandbox)
            sandbox = getSandbox(
              hostEnv.Sandbox,
              sandboxId,
              FORGE_SANDBOX_OPTIONS,
            )

            const resetMaterializeResult =
              await materializeForgeSnapshotIntoSandboxPreview({
                sandbox,
                snapshot,
              })

            if (!resetMaterializeResult.ok) {
              return Response.json(
                {
                  error:
                    'Forge sandbox preview workspace could not be materialized after reset.',
                  message: resetMaterializeResult.message,
                },
                { status: 500 },
              )
            }

            restartResult = await restartForgeSandboxPreviewDevServer(sandbox, {
              ...(hmr ? { hmr } : {}),
              waitTimeoutMs: FORGE_SANDBOX_PREVIEW_RESET_WAIT_MS,
            })
          }

          if (!restartResult.ok) {
            return Response.json(
              {
                error: 'Forge sandbox preview dev server did not start in time.',
                logTail: restartResult.logTail,
              },
              { status: 504 },
            )
          }

          const tunnel = await createForgeSandboxPreviewUrl({
            env: readForgePreviewTunnelEnv(hostEnv),
            publicHost,
            sandbox,
            sandboxId,
          })

          if (!tunnel.ok) {
            return Response.json(
              {
                error: 'Forge sandbox preview tunnel did not start in time.',
                message: tunnel.message,
              },
              { status: 503 },
            )
          }

          const { url } = tunnel

          await appendForgePreviewRuntimeEvent({
            detail: url,
            message: 'Sandbox preview reconnected',
            name: 'workflow.preview.reconnected',
            producerId: 'forge-preview',
            runId: `preview-reconnect-${crypto.randomUUID()}`,
            startedAt: attachStartedAt,
            status: 'finished',
          })

          return Response.json({ url })
        })
      },
    },
  },
})

async function readReconnectBody(request: Request) {
  const value = await request.json().catch(() => undefined)

  if (!isRecord(value) || typeof value.chatId !== 'string') {
    return { error: 'Missing chatId.', ok: false } as const
  }

  const chatId = value.chatId.trim()

  if (!chatId || chatId.length > 120) {
    return { error: 'Invalid chatId.', ok: false } as const
  }

  return {
    chatId,
    diagnoseOnly: value.diagnoseOnly === true,
    mode: readReconnectMode(value.mode),
    ok: true,
  } as const
}

function readReconnectMode(value: unknown) {
  return value === 'restart' || value === 'reset' || value === 'retunnel'
    ? value
    : 'attach'
}

async function readForgePreviewScope({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}): Promise<ForgePreviewScope> {
  const meta = await readForgeMetaSessionForChat({ chatId, userId })

  return {
    activeChatId: meta.activeChatId,
    chats: toLocalForgeChats(meta.chats),
    runtimeSessionId: meta.activeChatSession.runtimeSessionId,
  }
}

function readForgePreviewTunnelEnv(
  value: Record<string, unknown>,
): ForgeSandboxPreviewTunnelEnv {
  return {
    CLOUDFLARE_ACCOUNT_ID: readOptionalString(value.CLOUDFLARE_ACCOUNT_ID),
    CLOUDFLARE_API_TOKEN: readOptionalString(value.CLOUDFLARE_API_TOKEN),
    CLOUDFLARE_TUNNEL_ACCOUNT_ID: readOptionalString(
      value.CLOUDFLARE_TUNNEL_ACCOUNT_ID,
    ),
    CLOUDFLARE_TUNNEL_ZONE_ID: readOptionalString(
      value.CLOUDFLARE_TUNNEL_ZONE_ID,
    ),
    CLOUDFLARE_ZONE_ID: readOptionalString(value.CLOUDFLARE_ZONE_ID),
    FORGE_PREVIEW_URL_MODE: readOptionalString(value.FORGE_PREVIEW_URL_MODE),
    FORGE_PREVIEW_TUNNEL_MODE: readOptionalString(
      value.FORGE_PREVIEW_TUNNEL_MODE,
    ),
    FORGE_PREVIEW_TUNNEL_PREFIX: readOptionalString(
      value.FORGE_PREVIEW_TUNNEL_PREFIX,
    ),
    PREVIEW_HOSTNAME: readOptionalString(value.PREVIEW_HOSTNAME),
  }
}

async function attachForgeSandboxPreview({
  env,
  publicHost,
  refreshTunnel,
  sandbox,
  sandboxId,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  publicHost?: string
  refreshTunnel: boolean
  sandbox: ReturnType<typeof getSandbox>
  sandboxId: string
}) {
  if (
    !(await forgeSandboxPortIsListening({
      port: FORGE_SANDBOX_PREVIEW_PORT,
      sandbox,
      timeoutMs: FORGE_SANDBOX_PREVIEW_ATTACH_PORT_WAIT_MS,
    }))
  ) {
    return {
      message: 'No live Forge preview server is listening in this sandbox.',
      ok: false,
      reason: 'port-closed',
    } as const
  }

  if (refreshTunnel) {
    await sandbox.tunnels
      .destroy(FORGE_SANDBOX_PREVIEW_PORT)
      .catch(() => undefined)
  }

  return createForgeSandboxPreviewUrlWithTimeout({
    env,
    publicHost,
    sandbox,
    sandboxId,
    timeoutMs: FORGE_SANDBOX_PREVIEW_ATTACH_TUNNEL_WAIT_MS,
  })
}

async function createForgeSandboxPreviewTunnel(
  env: ForgeSandboxPreviewTunnelEnv,
  publicHost: string | undefined,
  sandbox: ReturnType<typeof getSandbox>,
  sandboxId: string,
) {
  let lastUrl: string | undefined

  for (
    let attempt = 0;
    attempt < FORGE_SANDBOX_PREVIEW_TUNNEL_ATTEMPTS;
    attempt++
  ) {
    try {
      const result = await createForgeSandboxPreviewUrl({
        env,
        publicHost,
        sandbox,
        sandboxId,
      })

      if (!result.ok) {
        return result
      }

      lastUrl = result.url

      if (isForgeSandboxWorkerPreviewUrl(result.url)) {
        return { ok: true, url: result.url } as const
      }

      if (await waitForForgePreviewUrl(result.url)) {
        return { ok: true, url: result.url } as const
      }
    } catch (error) {
      return {
        message:
          error instanceof Error
            ? error.message
            : 'Unknown tunnel startup error.',
        ok: false,
      } as const
    }
  }

  return {
    message: lastUrl
      ? `Forge preview tunnel did not become reachable: ${lastUrl}`
      : 'Forge preview tunnel did not return a URL.',
    ok: false,
  } as const
}

async function createForgeSandboxPreviewUrlWithTimeout({
  env,
  publicHost,
  sandbox,
  sandboxId,
  timeoutMs,
}: {
  env: ForgeSandboxPreviewTunnelEnv
  publicHost?: string
  sandbox: ReturnType<typeof getSandbox>
  sandboxId: string
  timeoutMs: number
}) {
  const tunnelPromise = createForgeSandboxPreviewTunnel(
    env,
    publicHost,
    sandbox,
    sandboxId,
  )
  const timeoutPromise = new Promise<{ message: string; ok: false }>(
    (resolve) => {
      setTimeout(
        () =>
          resolve({
            message:
              'Forge preview tunnel attach timed out; the existing preview was left running.',
            ok: false,
          }),
        timeoutMs,
      )
    },
  )

  return Promise.race([tunnelPromise, timeoutPromise])
}

function isForgeSandboxWorkerPreviewUrl(url: string) {
  try {
    const firstLabel = new URL(url).hostname.split('.')[0]

    return /^\d{4,5}-[a-z0-9-]{1,63}-[a-z0-9_]{1,63}$/.test(
      firstLabel ?? '',
    )
  } catch {
    return false
  }
}

async function waitForForgePreviewUrl(url: string) {
  const startedAt = Date.now()

  while (
    Date.now() - startedAt <
    FORGE_SANDBOX_PREVIEW_TUNNEL_READY_TIMEOUT_MS
  ) {
    if (await forgePreviewUrlIsReachable(url)) {
      return true
    }

    await new Promise((resolve) =>
      setTimeout(resolve, FORGE_SANDBOX_PREVIEW_TUNNEL_READY_POLL_MS),
    )
  }

  return false
}

async function forgePreviewUrlIsReachable(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    FORGE_SANDBOX_PREVIEW_TUNNEL_PROBE_TIMEOUT_MS,
  )

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    })

    return response.status >= 200 && response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function materializeForgeSnapshotIntoSandboxPreview({
  sandbox,
  snapshot,
}: {
  sandbox: ReturnType<typeof getSandbox>
  snapshot: LocalForgeSnapshot
}) {
  if (!snapshot.currentManifest) {
    return { ok: true } as const
  }

  const files = snapshot.files

  try {
    await sandbox.exec(
      [
        'find /workspace/app -mindepth 1',
        '\\(',
        '-path /workspace/app/node_modules',
        '-o -path /workspace/app/.git',
        '-o -path /workspace/app/.pnpm-store',
        '\\) -prune',
        '-o -exec rm -rf {} +',
      ].join(' '),
      { timeout: 30_000 },
    )

    for (const [filePath, content] of Object.entries(files)) {
      if (!isSafeForgeManifestPath(filePath)) {
        continue
      }

      const absolutePath = `/workspace/app/${filePath}`
      const directory = getForgePosixDirectoryName(absolutePath)

      if (directory) {
        await sandbox.mkdir(directory, { recursive: true })
      }

      await sandbox.writeFile(absolutePath, content)
    }

    await sandbox.writeFile(
      '/workspace/app/.forge-manifest',
      snapshot.currentManifest.manifestVersionId,
    )

    await appendForgePreviewRuntimeEvent({
      detail: `${Object.keys(files).length} files from ${snapshot.currentManifest.manifestVersionId}`,
      message: 'Sandbox preview workspace materialized',
      name: 'workflow.preview.materialized',
      producerId: 'forge-preview',
      runId: `preview-materialize-${crypto.randomUUID()}`,
      status: 'finished',
    })

    return { ok: true } as const
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Unknown sandbox materialization error.',
      ok: false,
    } as const
  }
}

async function destroyForgeSandboxPreview(
  sandbox: ReturnType<typeof getSandbox>,
) {
  await sandbox.destroy()
}

function canResetForgeSandboxPreviewAfterRestartFailure({
  logTail,
  snapshot,
}: {
  logTail: string | undefined
  snapshot: LocalForgeSnapshot
}) {
  if (isActiveForgeRunStatus(snapshot.latestRun?.status)) {
    return false
  }

  return forgeSandboxPreviewRestartFailureNeedsReset(logTail)
}

function forgeSandboxPreviewRestartFailureNeedsReset(logTail: string | undefined) {
  if (!logTail) {
    return false
  }

  return (
    logTail.includes('node_modules/.bin/vite is missing') ||
    logTail.includes('offline install failed') ||
    logTail.includes('ERR_PNPM_NO_OFFLINE_META')
  )
}

function isActiveForgeRunStatus(status: string | undefined) {
  return (
    status === 'queued' ||
    status === 'starting' ||
    status === 'running' ||
    status === 'paused' ||
    status === 'finishing'
  )
}

type ForgePreviewRuntimeEvent = Parameters<typeof appendLocalForgeRuntimeEvent>[0]

async function appendForgePreviewRuntimeEvent(event: ForgePreviewRuntimeEvent) {
  try {
    await appendLocalForgeRuntimeEvent(event)
  } catch (error) {
    console.warn('[forge-preview] Runtime event append failed', error)
  }
}

function isSafeForgeManifestPath(filePath: string) {
  return (
    filePath.length > 0 &&
    !filePath.startsWith('/') &&
    !filePath.split('/').includes('..')
  )
}

function getForgePosixDirectoryName(filePath: string) {
  const index = filePath.lastIndexOf('/')

  return index > 0 ? filePath.slice(0, index) : undefined
}

async function readForgeSandboxTunnelDiagnostics(
  sandbox: ReturnType<typeof getSandbox>,
) {
  const result = await sandbox
    .exec(
      [
        'sh',
        '-c',
        JSON.stringify(
          [
            'true',
            `node -e "const net=require('node:net');const socket=net.connect(${FORGE_SANDBOX_PREVIEW_PORT},'127.0.0.1');socket.once('connect',()=>{console.log('port_${FORGE_SANDBOX_PREVIEW_PORT}=listening');socket.destroy();process.exit(0)});socket.once('error',(error)=>{console.log('port_${FORGE_SANDBOX_PREVIEW_PORT}=closed '+error.message);process.exit(0)});setTimeout(()=>{console.log('port_${FORGE_SANDBOX_PREVIEW_PORT}=timeout');socket.destroy();process.exit(0)},750)"`,
            'printf "\\n--- vite.config.ts server ---\\n"',
            'sed -n "1,180p" /workspace/app/vite.config.ts 2>&1 || true',
            'printf "\\n--- forge vite wrapper ---\\n"',
            'sed -n "1,180p" /tmp/forge-vite.config.mjs 2>&1 || true',
            'printf "\\n--- preview start script ---\\n"',
            'nl -ba /tmp/forge-preview-start.sh 2>&1 | sed -n "1,140p" || true',
            'printf "\\n--- route tree log ---\\n"',
            'cat /tmp/forge-route-tree.log 2>&1 || true',
            'printf "\\n--- internal vite client hmr ---\\n"',
            `node -e "const http=require('node:http');let body='';http.get({host:'127.0.0.1',port:${FORGE_SANDBOX_PREVIEW_PORT},path:'/@vite/client'},res=>{res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>{console.log('status='+res.statusCode);console.log('has_hmr_path='+body.includes('${FORGE_SANDBOX_PREVIEW_HMR_PATH}'));console.log((body.match(/socketHost[^\\n]+/)||['socketHost=<missing>'])[0])})}).on('error',error=>console.log('error='+error.message))"`,
            'printf "\\n--- routes ---\\n"',
            'find /workspace/app/src/routes -maxdepth 2 -type f | sort 2>&1 || true',
            'printf "\\n--- index.tsx ---\\n"',
            'sed -n "1,80p" /workspace/app/src/routes/index.tsx 2>&1 || true',
          ].join('; '),
        ),
      ].join(' '),
      { timeout: 30_000 },
    )
    .catch((error: unknown) => ({
      exitCode: 1,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: '',
    }))

  return {
    exitCode: result.exitCode,
    hmrPathReady: await forgeSandboxPreviewDevServerHasHmrPath({ sandbox }),
    logTail: await readForgeSandboxPreviewLogTail(sandbox),
    stderr: result.stderr,
    stdout: result.stdout,
  }
}

function isForgeSandboxBinding(value: unknown) {
  return typeof value === 'object' && value !== null
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
