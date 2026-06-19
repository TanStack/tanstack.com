import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  forgeChatSessions,
  forgeProjects,
  type ForgeChatSession,
  type ForgeProject,
} from '~/db/schema'
import {
  assertNoActiveLocalForgeRun,
  deleteLocalForgeRuntimeSession,
  initializeLocalForgeRuntimeSession,
  LOCAL_FORGE_PROJECT_ID,
  withLocalForgeRuntimeSession,
  type LocalForgeChat,
  type LocalForgeSnapshot,
} from './local-store.server'

const DEFAULT_FORGE_PROJECT_NAME = 'Forge project'
const DEFAULT_FORGE_CHAT_TITLE = 'New chat'

export interface ForgeMetaProject {
  activeChatSessionId?: string
  id: string
  name: string
  runtimeProjectId: string
  updatedAt: string
  userId: string
}

export interface ForgeMetaChatSession extends LocalForgeChat {
  archivedAt?: string
  currentManifestVersionId?: string
  latestRunId?: string
  latestRunStatus?: string
  projectId: string
  runtimeSessionId: string
  userId: string
}

export interface ForgeMetaSession {
  activeChatId?: string
  activeChatSession?: ForgeMetaChatSession
  chats: Array<ForgeMetaChatSession>
  project: ForgeMetaProject
}

export interface ForgeActiveMetaSession extends ForgeMetaSession {
  activeChatId: string
  activeChatSession: ForgeMetaChatSession
}

export async function ensureForgeMetaSession(userId: string) {
  return readForgeMetaSession(userId)
}

export async function readForgeMetaSession(userId: string) {
  const project = await ensureForgeProject(userId)
  const chatRows = await readForgeProjectChatRows(project.id)

  if (chatRows.length === 0) {
    if (project.activeChatSessionId) {
      await clearActiveForgeChatSession(project.id)

      return readForgeMetaSession(userId)
    }

    return {
      activeChatId: undefined,
      activeChatSession: undefined,
      chats: [],
      project: toForgeMetaProject(project),
    } satisfies ForgeMetaSession
  }

  const activeChat =
    chatRows.find((chat) => chat.id === project.activeChatSessionId) ??
    chatRows[0]

  if (project.activeChatSessionId !== activeChat.id) {
    await setActiveForgeChatSession({
      chatId: activeChat.id,
      projectId: project.id,
    })
  }

  return {
    activeChatId: activeChat.id,
    activeChatSession: toForgeMetaChatSession(activeChat),
    chats: chatRows.map(toForgeMetaChatSession),
    project: toForgeMetaProject({
      ...project,
      activeChatSessionId: activeChat.id,
    }),
  } satisfies ForgeActiveMetaSession
}

export async function readForgeMetaSessionForChat({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}): Promise<ForgeActiveMetaSession> {
  const meta = await ensureForgeMetaSession(userId)
  const chat = meta.chats.find((item) => item.id === chatId)

  if (!chat) {
    throw new Error(`Forge chat ${chatId} was not found.`)
  }

  return {
    ...meta,
    activeChatId: chat.id,
    activeChatSession: chat,
    project: {
      ...meta.project,
      activeChatSessionId: chat.id,
    },
  } satisfies ForgeActiveMetaSession
}

export async function createForgeMetaChatSession(
  userId: string,
): Promise<ForgeActiveMetaSession> {
  const meta = await ensureForgeMetaSession(userId)

  if (meta.activeChatSession) {
    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      () => assertNoActiveLocalForgeRun('create a new chat'),
    )
  }

  const id = crypto.randomUUID()
  const now = new Date()
  const runtimeSessionId = `local-chat-${id}`
  const [chat] = await db
    .insert(forgeChatSessions)
    .values({
      createdAt: now,
      id,
      projectId: meta.project.id,
      runtimeSessionId,
      title: DEFAULT_FORGE_CHAT_TITLE,
      updatedAt: now,
      userId,
    })
    .returning()

  await setActiveForgeChatSession({
    chatId: chat.id,
    projectId: meta.project.id,
  })
  await initializeLocalForgeRuntimeSession(runtimeSessionId)

  return readForgeMetaSessionForChat({
    chatId: chat.id,
    userId,
  })
}

export async function selectForgeMetaChatSession({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}): Promise<ForgeActiveMetaSession> {
  const meta = await ensureForgeMetaSession(userId)

  if (chatId === meta.activeChatId && meta.activeChatSession) {
    return meta
  }

  const chat = meta.chats.find((item) => item.id === chatId)

  if (!chat) {
    throw new Error(`Forge chat ${chatId} was not found.`)
  }

  if (meta.activeChatSession) {
    await withLocalForgeRuntimeSession(
      meta.activeChatSession.runtimeSessionId,
      () => assertNoActiveLocalForgeRun('switch chats'),
    )
  }
  await setActiveForgeChatSession({
    chatId,
    projectId: meta.project.id,
  })

  return readForgeMetaSessionForChat({
    chatId,
    userId,
  })
}

export async function deleteForgeMetaChatSession({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}) {
  const meta = await ensureForgeMetaSession(userId)
  const chat = meta.chats.find((item) => item.id === chatId)

  if (!chat) {
    return meta
  }

  if (chat.id === meta.activeChatId) {
    await withLocalForgeRuntimeSession(chat.runtimeSessionId, () =>
      assertNoActiveLocalForgeRun('delete the active chat'),
    )
  }

  await db.delete(forgeChatSessions).where(eq(forgeChatSessions.id, chat.id))
  await deleteLocalForgeRuntimeSession(chat.runtimeSessionId)

  const remainingChats = meta.chats.filter((item) => item.id !== chat.id)

  if (remainingChats.length === 0) {
    await clearActiveForgeChatSession(meta.project.id)

    return readForgeMetaSession(userId)
  }

  const nextActiveChat =
    chat.id === meta.activeChatId
      ? remainingChats[0]
      : (remainingChats.find((item) => item.id === meta.activeChatId) ??
        remainingChats[0])

  await setActiveForgeChatSession({
    chatId: nextActiveChat.id,
    projectId: meta.project.id,
  })

  return readForgeMetaSession(userId)
}

export async function updateForgeMetaChatSessionFromSnapshot({
  chatId,
  prompt,
  snapshot,
  userId,
}: {
  chatId: string
  prompt?: string
  snapshot: LocalForgeSnapshot
  userId: string
}) {
  const title = prompt ? normalizeForgeChatTitle(prompt) : undefined

  await db
    .update(forgeChatSessions)
    .set({
      currentManifestVersionId: snapshot.manifestVersionId,
      latestRunId: snapshot.latestRun?.id,
      latestRunStatus: snapshot.latestRun?.status,
      title,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(forgeChatSessions.id, chatId),
        eq(forgeChatSessions.userId, userId),
      ),
    )
}

export function toLocalForgeChats(
  chats: Array<ForgeMetaChatSession>,
): Array<LocalForgeChat> {
  return chats.map((chat) => ({
    createdAt: chat.createdAt,
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
  }))
}

async function ensureForgeProject(userId: string) {
  const existingProject = await db.query.forgeProjects.findFirst({
    where: and(
      eq(forgeProjects.userId, userId),
      eq(forgeProjects.runtimeProjectId, LOCAL_FORGE_PROJECT_ID),
    ),
  })

  if (existingProject) {
    return existingProject
  }

  const [insertedProject] = await db
    .insert(forgeProjects)
    .values({
      name: DEFAULT_FORGE_PROJECT_NAME,
      runtimeProjectId: LOCAL_FORGE_PROJECT_ID,
      userId,
    })
    .onConflictDoNothing({
      target: [forgeProjects.userId, forgeProjects.runtimeProjectId],
    })
    .returning()

  if (insertedProject) {
    return insertedProject
  }

  const project = await db.query.forgeProjects.findFirst({
    where: and(
      eq(forgeProjects.userId, userId),
      eq(forgeProjects.runtimeProjectId, LOCAL_FORGE_PROJECT_ID),
    ),
  })

  if (!project) {
    throw new Error('Forge project metadata could not be initialized.')
  }

  return project
}

async function readForgeProjectChatRows(projectId: string) {
  return db.query.forgeChatSessions.findMany({
    orderBy: desc(forgeChatSessions.updatedAt),
    where: and(
      eq(forgeChatSessions.projectId, projectId),
      isNull(forgeChatSessions.archivedAt),
    ),
  })
}

async function clearActiveForgeChatSession(projectId: string) {
  await db
    .update(forgeProjects)
    .set({
      activeChatSessionId: null,
      updatedAt: new Date(),
    })
    .where(eq(forgeProjects.id, projectId))
}

async function setActiveForgeChatSession({
  chatId,
  projectId,
}: {
  chatId: string
  projectId: string
}) {
  await db
    .update(forgeProjects)
    .set({
      activeChatSessionId: chatId,
      updatedAt: new Date(),
    })
    .where(eq(forgeProjects.id, projectId))
}

function normalizeForgeChatTitle(prompt: string) {
  const title = prompt.trim().replace(/\s+/g, ' ').slice(0, 64)

  return title || undefined
}

function toForgeMetaProject(project: ForgeProject): ForgeMetaProject {
  return {
    activeChatSessionId: project.activeChatSessionId ?? undefined,
    id: project.id,
    name: project.name,
    runtimeProjectId: project.runtimeProjectId,
    updatedAt: project.updatedAt.toISOString(),
    userId: project.userId,
  }
}

function toForgeMetaChatSession(chat: ForgeChatSession): ForgeMetaChatSession {
  return {
    archivedAt: chat.archivedAt?.toISOString(),
    createdAt: chat.createdAt.toISOString(),
    currentManifestVersionId: chat.currentManifestVersionId ?? undefined,
    id: chat.id,
    latestRunId: chat.latestRunId ?? undefined,
    latestRunStatus: chat.latestRunStatus ?? undefined,
    projectId: chat.projectId,
    runtimeSessionId: chat.runtimeSessionId,
    title: chat.title,
    updatedAt: chat.updatedAt.toISOString(),
    userId: chat.userId,
  }
}
