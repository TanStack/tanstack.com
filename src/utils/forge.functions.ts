import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
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
  readLocalForgeSnapshotForRuntimeSession,
  withLocalForgeRuntimeSession,
  type LocalForgeSnapshot,
} from '~/builder/runtime/local-store.server'
import {
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
import { requireForgeAccess as requireForgeRequestAccess } from '~/utils/forge-access.server'

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
}

export interface ForgeChatShellResult {
  activeChatId: string
  chat: ForgeChatShell
  projectId: string
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
    const meta = await ensureForgeMetaSession(user.userId)

    return {
      activeChatId: meta.activeChatId,
      chats: meta.chats.map(toForgeChatShell),
      projectId: meta.project.id,
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
    const providerCredential = data.providerKey
      ? unsealForgeProviderKey({
          provider: data.providerKey.provider,
          sealedKey: data.providerKey.sealedKey,
          userId: user.userId,
        })
      : undefined

    if (!providerCredential && forgeRequiresByokForRuns()) {
      throw new Error('Add a Forge provider key before starting a run.')
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
        }),
    )

    return readForgeSnapshotFromMeta({
      meta,
      prompt: data.prompt,
      userId: user.userId,
    })
  })

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

export const createForgeChat = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireForgeUser()
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
    const meta = await createForgeMetaChatSession(user.userId)

    return {
      activeChatId: meta.activeChatId,
      chat: toForgeChatShell(meta.activeChatSession),
      projectId: meta.project.id,
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
  if (ensureBaseline) {
    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      ensureLocalForgeBaseline,
    )
  }

  const snapshot = await readLocalForgeSnapshotForRuntimeSession({
    activeChatId: meta.activeChatId,
    chats: toLocalForgeChats(meta.chats),
    runtimeSessionId: meta.activeChatSession.runtimeSessionId,
  })

  if (ensureBaseline) {
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
