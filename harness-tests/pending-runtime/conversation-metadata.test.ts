import { expect, it } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { conversationThreadContext } from '../../src/chat/server/conversation-threads'
import { Memories } from '../../src/chat/server/memory'
import {
  readConversationLifecycle,
  readConversationRunContext,
} from '../../src/chat/server/conversation-database'

it('reads fresh run context and ordered saved actions from a single database snapshot', async () => {
  const h = await conversationHarness()
  const input = h.input('metadata')
  const identity = { workspaceId: 'w', botId: 'b', userId: input.userId }
  await h.db`INSERT INTO chat_recipes(id,workspace_id,title,description,code,created_at) VALUES('second','w','Second','','',2),('first','w','First','','',1)`
  const result = await readConversationRunContext(identity)
  expect(result.bot).toMatchObject({ id: 'b', workspace_id: 'w', name: 'Bot' })
  expect(typeof result.bot.created_at).toBe('number')
  expect(result.recipes).toEqual([
    expect.objectContaining({ id: 'first' }),
    expect.objectContaining({ id: 'second' }),
  ])
  expect((await readConversationRunContext(identity, false)).recipes).toEqual(
    [],
  )
  await h.db`DELETE FROM chat_memberships WHERE workspace_id='w'`
  await expect(readConversationRunContext(identity)).rejects.toThrow(
    'Workspace access is unavailable.',
  )
})

it('returns lifecycle nulls and fresh archive state without losing the missing-bot distinction', async () => {
  const h = await conversationHarness()
  expect(await readConversationLifecycle('missing', 'missing')).toEqual({
    bot: null,
    thread: null,
  })
  expect(await readConversationLifecycle('b', 'main-conversation')).toEqual({
    bot: { archived_at: null, deleted_at: null },
    thread: null,
  })
  await h.db`UPDATE chat_bots SET archived_at=to_timestamp(100) WHERE id='b'`
  expect(
    await readConversationLifecycle('b', 'main-conversation'),
  ).toMatchObject({ bot: { archived_at: 100000 } })
})

it.each(['membership', 'owner', 'workspace', 'deleted'])(
  'does not expose memory preferences after %s access changes',
  async (change) => {
    const h = await conversationHarness()
    const userId = h.input('metadata').userId
    const scope = {
      workspaceId: 'w',
      conversationId: 'main-conversation',
      userId,
    }
    const memories = new Memories(scope)
    expect(await memories.preferences()).toEqual({
      enabled: false,
      revision: 0,
    })
    await h.db`INSERT INTO chat_memory_preferences(conversation_id,enabled,revision,updated_at) VALUES('main-conversation',true,7,1)`
    expect(await memories.preferences()).toEqual({ enabled: true, revision: 7 })
    if (change === 'membership')
      await h.db`DELETE FROM chat_memberships WHERE workspace_id='w'`
    if (change === 'owner')
      scope.userId = '00000000-0000-4000-8000-000000000002'
    if (change === 'workspace') scope.workspaceId = 'foreign'
    if (change === 'deleted')
      await h.db`UPDATE chat_bots SET deleted_at=now() WHERE id='b'`
    await expect(memories.preferences()).rejects.toThrow(
      'Conversation access is unavailable.',
    )
  },
)

it.each(['membership', 'owner', 'workspace', 'bot'])(
  'rejects thread context after %s scope changes',
  async (change) => {
    const h = await conversationHarness()
    const identity = {
      workspaceId: 'w',
      botId: 'b',
      conversationId: 'main-conversation',
      userId: h.input('metadata').userId,
    }
    expect(await conversationThreadContext(identity)).toBeUndefined()
    if (change === 'membership')
      await h.db`DELETE FROM chat_memberships WHERE workspace_id='w'`
    if (change === 'owner')
      identity.userId = '00000000-0000-4000-8000-000000000002'
    if (change === 'workspace') identity.workspaceId = 'foreign'
    if (change === 'bot') identity.botId = 'foreign'
    await expect(conversationThreadContext(identity)).rejects.toThrow()
  },
)
