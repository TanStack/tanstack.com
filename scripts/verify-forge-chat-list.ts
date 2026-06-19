import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-chat-list-'))

process.chdir(runtimeRoot)

try {
  const {
    createLocalForgeChat,
    deleteLocalForgeChat,
    LOCAL_FORGE_SESSION_ID,
    readLocalForgeSnapshot,
    resetLocalForgeRuntime,
    selectLocalForgeChat,
    updateActiveLocalForgeChatTitleFromPrompt,
  } = await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const initial = await readLocalForgeSnapshot()

  assert.equal(initial.activeChatId, LOCAL_FORGE_SESSION_ID)
  assert.equal(initial.chats.length, 1)
  assert.equal(initial.chats[0]?.title, 'New chat')

  const created = await createLocalForgeChat()
  const createdChatId = created.activeChatId

  assert.notEqual(createdChatId, initial.activeChatId)
  assert.equal(created.chats.length, 2)
  assert.deepEqual(created.messages, [])
  assert.equal(created.timelineEventCount, 0)

  await updateActiveLocalForgeChatTitleFromPrompt(
    'Build a tiny TanStack Start app with auth and preview',
  )

  const renamed = await readLocalForgeSnapshot()
  const renamedChat = renamed.chats.find((chat) => chat.id === createdChatId)

  assert.equal(
    renamedChat?.title,
    'Build a tiny TanStack Start app with auth and preview',
  )

  const selected = await selectLocalForgeChat(initial.activeChatId)

  assert.equal(selected.activeChatId, initial.activeChatId)
  assert.equal(selected.chats.length, 2)

  const deletedInactive = await deleteLocalForgeChat(createdChatId)

  assert.equal(deletedInactive.activeChatId, initial.activeChatId)
  assert.equal(
    deletedInactive.chats.some((chat) => chat.id === createdChatId),
    false,
  )
  assert.equal(deletedInactive.chats.length, 1)

  const replacement = await deleteLocalForgeChat(initial.activeChatId)

  assert.notEqual(replacement.activeChatId, initial.activeChatId)
  assert.equal(replacement.chats.length, 1)
  assert.equal(replacement.chats[0]?.title, 'New chat')
  assert.equal(replacement.timelineEventCount, 0)
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge chat list verifier passed')
