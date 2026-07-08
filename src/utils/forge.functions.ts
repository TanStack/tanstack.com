import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getSandbox } from '@cloudflare/sandbox'
import * as v from 'valibot'
import {
  ensureForgeMetaSession,
  createForgeMetaChatSession,
  deleteForgeMetaChatSession,
  type ForgeActiveMetaSession,
  readForgeMetaSessionForChat,
  selectForgeMetaChatSession,
  toLocalForgeChats,
  updateForgeMetaChatSessionFromSnapshot,
  type ForgeMetaChatSession,
  type ForgeMetaSession,
} from '~/builder/runtime/forge-meta.server'
import {
  appendLocalForgeRuntimeEvent,
  readLocalForgeSnapshotForRuntimeSession,
  reconcileInterruptedLocalForgeRun,
  withLocalForgeRuntimeSession,
  type LocalForgeChat,
  type LocalForgeSnapshot,
} from '~/builder/runtime/local-store.server'
import {
  cancelLocalForgeAgentRun,
  ensureLocalForgeBaseline,
  startLocalForgeAgentRun,
} from '~/builder/runtime/local-agent.server'
import {
  forgeByokProviders,
  forgeRequiresByokForRuns,
  sealForgeProviderKey,
  unsealForgeProviderKey,
  type ForgeSealedProviderKey,
} from '~/builder/runtime/forge-byok.server'
import { materializeLatestLocalForgeManifest } from '~/builder/runtime/local-materialize.server'
import { getForgeSandboxProviderId } from '~/builder/runtime/sandbox-agent.server'
import {
  createForgeSandboxPreviewUrl,
  forgeSandboxPortIsListening,
  FORGE_SANDBOX_OPTIONS,
  type ForgeSandboxPreviewTunnelEnv,
} from '~/builder/runtime/sandbox-preview.server'
import { getHostRuntimeEnv } from '~/server/runtime/host.server'
import {
  isForgeAuthBypassEnabled,
  requireForgeAccess as requireForgeRequestAccess,
} from '~/utils/forge-access.server'
import {
  applyForgeBypassRuntimeScope,
  createForgeBypassRuntimeScope,
  LOCAL_FORGE_PROJECT_ID,
  readForgeBypassRuntimeSnapshot,
} from '~/utils/forge-bypass-runtime.server'

export interface ForgeChatShell {
  archivedAt?: string
  createdAt: string
  currentManifestVersionId?: string
  id: string
  latestRunId?: string
  latestRunStatus?: string
  projectId: string
  title: string
  updatedAt: string
}

export interface ForgeChatShellsResult {
  activeChatId?: string
  chats: Array<ForgeChatShell>
  projectId: string
  runRequiresProviderKey: boolean
}

export interface ForgeChatShellResult {
  activeChatId: string
  chat: ForgeChatShell
  projectId: string
  runRequiresProviderKey: boolean
}

export interface ForgeRunConfig {
  runRequiresProviderKey: boolean
}

export type ForgeBrowserProviderKey = ForgeSealedProviderKey

const forgeProviderSchema = v.picklist(forgeByokProviders)

const forgeProviderModelSchema = v.optional(
  v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
)

const forgeBrowserProviderKeySchema = v.object({
  fingerprint: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  model: forgeProviderModelSchema,
  provider: forgeProviderSchema,
  sealedKey: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(12000)),
})

async function requireForgeUser() {
  return requireForgeRequestAccess(getRequest())
}

export const requireForgeAccess = createServerFn({ method: 'POST' }).handler(
  requireForgeUser,
)

export const getForgeRunConfig = createServerFn({ method: 'POST' }).handler(
  async (): Promise<ForgeRunConfig> => {
    await requireForgeUser()

    return {
      runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
    }
  },
)

export const getLocalForgeSession = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.optional(
        v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      return readForgeBypassRuntimeSnapshot({ chatId: data.chatId })
    }

    const meta = data.chatId
      ? await readForgeMetaSessionForChat({
          chatId: data.chatId,
          userId: user.userId,
        })
      : requireActiveForgeMetaSession(await ensureForgeMetaSession(user.userId))

    return readForgeSnapshotFromMeta({
      meta,
      ensureBaseline: false,
      userId: user.userId,
    })
  })

export const getForgeChatShells = createServerFn({ method: 'POST' }).handler(
  async (): Promise<ForgeChatShellsResult> => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      const snapshot = await readForgeBypassRuntimeSnapshot()

      return {
        activeChatId: snapshot.activeChatId,
        chats: snapshot.chats.map((chat) =>
          toForgeBypassChatShell(chat, snapshot),
        ),
        projectId: LOCAL_FORGE_PROJECT_ID,
        runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
      }
    }

    const meta = await ensureForgeMetaSession(user.userId)

    return {
      activeChatId: meta.activeChatId,
      chats: meta.chats.map(toForgeChatShell),
      projectId: meta.project.id,
      runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
    }
  },
)

export const startLocalForgeRun = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
      clientRequestId: v.pipe(
        v.string(),
        v.trim(),
        v.minLength(1),
        v.maxLength(120),
      ),
      providerKey: v.optional(forgeBrowserProviderKeySchema),
      prompt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4000)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()
    const publicHost = new URL(getRequest().url).host
    const providerCredential = data.providerKey
      ? unsealForgeProviderKey({
          provider: data.providerKey.provider,
          sealedKey: data.providerKey.sealedKey,
          userId: user.userId,
        })
      : undefined

    if (!providerCredential && forgeRunRequiresBrowserProviderKey()) {
      throw new Error('Add a Forge provider key before starting a run.')
    }

    if (isForgeAuthBypassEnabled()) {
      const scope = createForgeBypassRuntimeScope({
        chatId: data.chatId,
        title: data.prompt,
      })
      const snapshot = await withLocalForgeRuntimeSession(
        scope.runtimeSessionId,
        () =>
          startLocalForgeAgentRun({
            clientRequestId: data.clientRequestId,
            prompt: data.prompt,
            providerCredential,
            publicHost,
          }),
      )

      return applyForgeBypassRuntimeScope(snapshot, {
        chatId: scope.runtimeSessionId,
        title: data.prompt,
      })
    }

    const meta = requireActiveForgeMetaSession(
      await selectForgeMetaChatSession({
        chatId: data.chatId,
        userId: user.userId,
      }),
    )

    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      () =>
        startLocalForgeAgentRun({
          clientRequestId: data.clientRequestId,
          prompt: data.prompt,
          providerCredential,
          publicHost,
        }),
    )

    return readForgeSnapshotFromMeta({
      meta,
      prompt: data.prompt,
      userId: user.userId,
    })
  })

export const cancelLocalForgeRun = createServerFn({ method: 'POST' })
  .validator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      const scope = createForgeBypassRuntimeScope({ chatId: data.chatId })
      await withLocalForgeRuntimeSession(
        scope.runtimeSessionId,
        cancelLocalForgeAgentRun,
      )

      return readForgeBypassRuntimeSnapshot({ chatId: data.chatId })
    }

    const meta = requireActiveForgeMetaSession(
      await selectForgeMetaChatSession({
        chatId: data.chatId,
        userId: user.userId,
      }),
    )

    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      cancelLocalForgeAgentRun,
    )

    return readForgeSnapshotFromMeta({
      meta,
      ensureBaseline: false,
      userId: user.userId,
    })
  })

function forgeRunRequiresBrowserProviderKey() {
  return forgeRequiresByokForRuns()
}

export const sealForgeBrowserProviderKey = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      apiKey: v.pipe(v.string(), v.trim(), v.minLength(20), v.maxLength(4000)),
      model: forgeProviderModelSchema,
      provider: forgeProviderSchema,
    }),
  )
  .handler(async ({ data }): Promise<ForgeBrowserProviderKey> => {
    const user = await requireForgeUser()

    return sealForgeProviderKey({
      apiKey: data.apiKey,
      model: data.model,
      provider: data.provider,
      userId: user.userId,
    })
  })

export const validateLocalForgeWorkspace = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      const scope = createForgeBypassRuntimeScope({ chatId: data.chatId })

      await withLocalForgeRuntimeSession(
        scope.runtimeSessionId,
        materializeLatestLocalForgeManifest,
      )

      return readForgeBypassRuntimeSnapshot({
        chatId: scope.runtimeSessionId,
      })
    }

    const meta = requireActiveForgeMetaSession(
      await selectForgeMetaChatSession({
        chatId: data.chatId,
        userId: user.userId,
      }),
    )

    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      materializeLatestLocalForgeManifest,
    )

    return readForgeSnapshotFromMeta({
      meta,
      userId: user.userId,
    })
  })

export const reconnectForgeSandboxPreview = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()
    if (isForgeAuthBypassEnabled()) {
      const scope = createForgeBypassRuntimeScope({ chatId: data.chatId })

      return withLocalForgeRuntimeSession(scope.runtimeSessionId, async () => {
        await reconnectForgeSandboxPreviewForRuntimeSession({
          publicHost: new URL(getRequest().url).host,
          runtimeSessionId: scope.runtimeSessionId,
        })

        return readForgeBypassRuntimeSnapshot({
          chatId: scope.runtimeSessionId,
        })
      })
    }

    const meta = await readForgeMetaSessionForChat({
      chatId: data.chatId,
      userId: user.userId,
    })

    return withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      async () => {
        await reconnectForgeSandboxPreviewForRuntimeSession({
          publicHost: new URL(getRequest().url).host,
          runtimeSessionId: meta.activeChatSession.runtimeSessionId,
          runId: meta.activeChatSession.latestRunId,
        })

        return readForgeSnapshotFromMeta({
          ensureBaseline: false,
          meta,
          userId: user.userId,
        })
      },
    )
  })

export const createForgeChat = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      return readForgeBypassRuntimeSnapshot({
        chatId: createForgeBypassChatId(),
      })
    }

    const meta = await createForgeMetaChatSession(user.userId)

    return readForgeSnapshotFromMeta({
      meta,
      userId: user.userId,
    })
  },
)

export const createForgeChatShell = createServerFn({ method: 'POST' }).handler(
  async (): Promise<ForgeChatShellResult> => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      const scope = createForgeBypassRuntimeScope({
        chatId: createForgeBypassChatId(),
      })
      const chat = scope.chats[0]

      if (!chat) {
        throw new Error('Forge bypass chat could not be created.')
      }

      return {
        activeChatId: scope.activeChatId,
        chat: toForgeBypassChatShell(chat),
        projectId: LOCAL_FORGE_PROJECT_ID,
        runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
      }
    }

    const meta = await createForgeMetaChatSession(user.userId)

    return {
      activeChatId: meta.activeChatId,
      chat: toForgeChatShell(meta.activeChatSession),
      projectId: meta.project.id,
      runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
    }
  },
)

export const deleteForgeChatShell = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }): Promise<ForgeChatShellsResult> => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      return {
        activeChatId: undefined,
        chats: [],
        projectId: LOCAL_FORGE_PROJECT_ID,
        runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
      }
    }

    const meta = requireActiveForgeMetaSession(
      await deleteForgeMetaChatSession({
        chatId: data.chatId,
        userId: user.userId,
      }),
    )

    return {
      activeChatId: meta.activeChatId,
      chats: meta.chats.map(toForgeChatShell),
      projectId: meta.project.id,
      runRequiresProviderKey: forgeRunRequiresBrowserProviderKey(),
    }
  })

export const selectForgeChat = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      return readForgeBypassRuntimeSnapshot({ chatId: data.chatId })
    }

    const meta = await selectForgeMetaChatSession({
      chatId: data.chatId,
      userId: user.userId,
    })

    return readForgeSnapshotFromMeta({
      meta: requireActiveForgeMetaSession(meta),
      userId: user.userId,
    })
  })

export const deleteForgeChat = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      chatId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireForgeUser()

    if (isForgeAuthBypassEnabled()) {
      return readForgeBypassRuntimeSnapshot()
    }

    const meta = await deleteForgeMetaChatSession({
      chatId: data.chatId,
      userId: user.userId,
    })

    return readForgeSnapshotFromMeta({
      meta: requireActiveForgeMetaSession(meta),
      userId: user.userId,
    })
  })

function toForgeChatShell(chat: ForgeMetaChatSession): ForgeChatShell {
  return {
    archivedAt: chat.archivedAt,
    createdAt: chat.createdAt,
    currentManifestVersionId: chat.currentManifestVersionId,
    id: chat.id,
    latestRunId: chat.latestRunId,
    latestRunStatus: chat.latestRunStatus,
    projectId: chat.projectId,
    title: chat.title,
    updatedAt: chat.updatedAt,
  }
}

type ForgeSandboxBinding = Parameters<typeof getSandbox>[0]

interface ForgeReconnectHostEnv extends ForgeSandboxPreviewTunnelEnv {
  Sandbox: ForgeSandboxBinding
}

async function reconnectForgeSandboxPreviewForRuntimeSession({
  publicHost,
  runId,
  runtimeSessionId,
}: {
  publicHost?: string
  runId?: string
  runtimeSessionId: string
}) {
  const hostEnv = readForgeReconnectHostEnv(await getHostRuntimeEnv())

  if (!hostEnv) {
    return
  }

  const sandboxId = getForgeSandboxProviderId({
    projectId: LOCAL_FORGE_PROJECT_ID,
    threadId: runtimeSessionId,
  })
  const sandbox = getSandbox(hostEnv.Sandbox, sandboxId, FORGE_SANDBOX_OPTIONS)

  if (!(await forgeSandboxPortIsListening({ sandbox }))) {
    return
  }

  const result = await createForgeSandboxPreviewUrl({
    env: hostEnv,
    publicHost,
    sandbox,
    sandboxId,
  })

  if (!result.ok) {
    return
  }

  await appendLocalForgeRuntimeEvent({
    detail: result.url,
    message: 'Sandbox preview reconnected',
    name: 'workflow.preview.reconnected',
    producerId: 'forge-preview',
    runId: runId ?? `preview-reconnect-${crypto.randomUUID()}`,
    status: 'finished',
  })
}

function readForgeReconnectHostEnv(
  value: Record<string, unknown> | undefined,
): ForgeReconnectHostEnv | undefined {
  if (!value || !isForgeSandboxBinding(value.Sandbox)) {
    return undefined
  }

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
    Sandbox: value.Sandbox,
  }
}

function isForgeSandboxBinding(value: unknown): value is ForgeSandboxBinding {
  return typeof value === 'object' && value !== null
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function toForgeBypassChatShell(
  chat: LocalForgeChat,
  snapshot?: LocalForgeSnapshot,
): ForgeChatShell {
  return {
    createdAt: chat.createdAt,
    currentManifestVersionId: snapshot?.manifestVersionId,
    id: chat.id,
    latestRunId: snapshot?.latestRun?.id,
    latestRunStatus: snapshot?.latestRun?.status,
    projectId: LOCAL_FORGE_PROJECT_ID,
    title: chat.title,
    updatedAt: chat.updatedAt,
  }
}

function createForgeBypassChatId() {
  return `local-chat-${crypto.randomUUID()}`
}

function requireActiveForgeMetaSession(
  meta: ForgeMetaSession,
): ForgeActiveMetaSession {
  const { activeChatId, activeChatSession } = meta

  if (activeChatId && activeChatSession) {
    return {
      ...meta,
      activeChatId,
      activeChatSession,
    }
  }

  throw new Error('Forge has no active chat.')
}

async function readForgeSnapshotFromMeta({
  ensureBaseline = true,
  meta,
  prompt,
  userId,
}: {
  ensureBaseline?: boolean
  meta: ForgeActiveMetaSession
  prompt?: string
  userId: string
}): Promise<LocalForgeSnapshot> {
  // Self-heal an orphaned run (e.g. left active by a runtime restart) before
  // reading so the UI isn't wedged waiting on a run that can't complete.
  await withLocalForgeRuntimeSession(
    meta.activeChatSession.runtimeSessionId,
    async () => {
      await reconcileInterruptedLocalForgeRun()
      if (ensureBaseline) {
        await ensureLocalForgeBaseline()
      }
    },
  )

  const snapshot = await readLocalForgeSnapshotForRuntimeSession({
    activeChatId: meta.activeChatId,
    chats: toLocalForgeChats(meta.chats),
    runtimeSessionId: meta.activeChatSession.runtimeSessionId,
  })

  if (
    ensureBaseline ||
    forgeMetaChatSessionNeedsSnapshotUpdate(meta.activeChatSession, snapshot)
  ) {
    await updateForgeMetaChatSessionFromSnapshot({
      chatId: meta.activeChatId,
      prompt,
      snapshot,
      userId,
    })
  }

  if (!prompt) {
    return snapshot
  }

  const nextMeta = await ensureForgeMetaSession(userId)
  const activeNextMeta = requireActiveForgeMetaSession(nextMeta)

  return readLocalForgeSnapshotForRuntimeSession({
    activeChatId: activeNextMeta.activeChatId,
    chats: toLocalForgeChats(activeNextMeta.chats),
    runtimeSessionId: activeNextMeta.activeChatSession.runtimeSessionId,
  })
}

function forgeMetaChatSessionNeedsSnapshotUpdate(
  chat: ForgeMetaChatSession,
  snapshot: LocalForgeSnapshot,
) {
  return (
    (chat.currentManifestVersionId ?? undefined) !==
      snapshot.manifestVersionId ||
    (chat.latestRunId ?? undefined) !== snapshot.latestRun?.id ||
    (chat.latestRunStatus ?? undefined) !== snapshot.latestRun?.status
  )
}
