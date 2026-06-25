import {
  LOCAL_FORGE_PROJECT_ID,
  LOCAL_FORGE_SESSION_ID,
  readLocalForgeSnapshotForRuntimeSession,
  type LocalForgeChat,
  type LocalForgeSnapshot,
} from '~/builder/runtime/local-store.server'

export { LOCAL_FORGE_PROJECT_ID }

export interface ForgeBypassRuntimeScope {
  activeChatId: string
  chats: Array<LocalForgeChat>
  runtimeSessionId: string
}

export function createForgeBypassRuntimeScope({
  chatId,
  snapshot,
  title,
}: {
  chatId?: string | null
  snapshot?: LocalForgeSnapshot
  title?: string
} = {}): ForgeBypassRuntimeScope {
  const runtimeSessionId = normalizeForgeBypassRuntimeSessionId(chatId)

  return {
    activeChatId: runtimeSessionId,
    chats: [
      createForgeBypassChat({
        chatId: runtimeSessionId,
        snapshot,
        title,
      }),
    ],
    runtimeSessionId,
  }
}

export async function readForgeBypassRuntimeSnapshot({
  chatId,
  title,
}: {
  chatId?: string | null
  title?: string
} = {}) {
  const scope = createForgeBypassRuntimeScope({ chatId, title })
  const snapshot = await readLocalForgeSnapshotForRuntimeSession(scope)

  return applyForgeBypassRuntimeScope(snapshot, {
    chatId: scope.runtimeSessionId,
    title,
  })
}

export function applyForgeBypassRuntimeScope(
  snapshot: LocalForgeSnapshot,
  {
    chatId,
    title,
  }: {
    chatId?: string | null
    title?: string
  } = {},
): LocalForgeSnapshot {
  const scope = createForgeBypassRuntimeScope({
    chatId: chatId ?? snapshot.activeChatId,
    snapshot,
    title,
  })

  return {
    ...snapshot,
    activeChatId: scope.activeChatId,
    chats: scope.chats,
  }
}

function createForgeBypassChat({
  chatId,
  snapshot,
  title,
}: {
  chatId: string
  snapshot?: LocalForgeSnapshot
  title?: string
}): LocalForgeChat {
  const snapshotChat = snapshot?.chats.find((chat) => chat.id === chatId)
  const now = new Date().toISOString()
  const createdAt =
    snapshotChat?.createdAt ?? snapshot?.messages[0]?.createdAt ?? now
  const updatedAt =
    snapshot?.latestRun?.endedAt ??
    snapshot?.latestRun?.startedAt ??
    snapshot?.messages.at(-1)?.createdAt ??
    snapshotChat?.updatedAt ??
    createdAt

  return {
    createdAt,
    id: chatId,
    title:
      normalizeForgeBypassChatTitle(title) ??
      normalizeForgeBypassChatTitle(
        snapshot?.messages.find((message) => message.role === 'user')?.content,
      ) ??
      snapshotChat?.title ??
      'New chat',
    updatedAt,
  }
}

function normalizeForgeBypassRuntimeSessionId(chatId?: string | null) {
  const normalized = chatId?.trim().replace(/[^a-zA-Z0-9:_-]+/g, '-')

  return normalized ? normalized.slice(0, 120) : LOCAL_FORGE_SESSION_ID
}

function normalizeForgeBypassChatTitle(title?: string) {
  const normalized = title?.trim().replace(/\s+/g, ' ')

  return normalized ? normalized.slice(0, 64) : undefined
}
