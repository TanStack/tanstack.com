import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import * as references from '../../src/chat/server/message-references'
import * as connections from '../../src/chat/server/mcp-connections'
import * as attachments from '../../src/chat/server/attachment-request'
import { SkillCatalog } from '../../src/chat/server/skill-catalog'

afterEach(() => vi.restoreAllMocks())

it('dispatches a plain response without reading MCP inventory or the skill directory', async () => {
  const h = await conversationHarness()
  const inventory = vi
    .spyOn(connections, 'connectedMcpServers')
    .mockRejectedValue(
      new Error('Unused inventory must not block a plain response'),
    )
  const directory = vi
    .spyOn(SkillCatalog.prototype, 'list')
    .mockRejectedValue(
      new Error('Unused directory must not block a plain response'),
    )
  h.env.AI.run.mockImplementation(
    async () =>
      new Response(
        'data: ' +
          JSON.stringify({
            id: 'synthetic-preparation',
            object: 'chat.completion.chunk',
            created: 1,
            model: h.env.INCLUDED_MODEL,
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'Ready.' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }) +
          '\n\ndata: [DONE]\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  )
  await h.c.begin({ ...h.input('deferred-preparation'), fixture: false })
  await h.settle()
  expect(h.env.AI.run).toHaveBeenCalledOnce()
  expect(inventory).not.toHaveBeenCalled()
  expect(directory).not.toHaveBeenCalled()
  expect(
    (await h.c.snapshot()).messages.some((message) =>
      message.parts.some(
        (part) => part.type === 'text' && part.content === 'Ready.',
      ),
    ),
  ).toBe(true)
})

it('reauthorizes membership inside send admission without requiring a prior identity RPC', async () => {
  const h = await conversationHarness()
  await h.db`DELETE FROM chat_memberships WHERE workspace_id='w'`
  await expect(
    h.c.begin({ ...h.input('revoked-preparation'), fixture: false }),
  ).rejects.toThrow('Conversation not found.')
  expect(h.env.AI.run).not.toHaveBeenCalled()
  expect(h.local.prepare('SELECT turn_id FROM transcript_turns').all()).toEqual(
    [],
  )
})

it.each([false, true])(
  'rejects foreign accounts and scopes before admission with prior binding=%s',
  async (bound) => {
    const h = await conversationHarness()
    const userId = h.input('identity').userId
    const otherUserId = '00000000-0000-4000-8000-000000000002'
    await h.db`INSERT INTO users(id) VALUES(${otherUserId})`
    await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w',${otherUserId},'member')`
    await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('other-user-main','b',${otherUserId}),('sibling','b',${userId})`
    await h.db`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES('b',${otherUserId},'other-user-main')`
    const input = {
      ...h.input('isolated-preparation'),
      conversationId: 'main-conversation',
      fixture: false,
    }
    if (bound)
      await h.c.bindIdentity({
        conversationId: input.conversationId,
        botId: input.bot.id,
        workspaceId: input.bot.workspace_id,
        userId,
      })
    for (const foreign of [
      { ...input, userId: otherUserId },
      { ...input, userId: otherUserId, conversationId: undefined },
      { ...input, conversationId: 'sibling' },
      { ...input, bot: { ...input.bot, id: 'other-bot' } },
      { ...input, bot: { ...input.bot, workspace_id: 'other-workspace' } },
    ])
      await expect(h.c.begin(foreign)).rejects.toThrow()
    expect(h.env.AI.run).not.toHaveBeenCalled()
    expect(
      h.local.prepare('SELECT turn_id FROM transcript_turns').all(),
    ).toEqual([])
  },
)

it('rejects access revoked during preparation before admitting the message', async () => {
  const h = await conversationHarness()
  const validate = attachments.validateAttachmentRequest
  vi.spyOn(attachments, 'validateAttachmentRequest').mockImplementation(
    async (...args) => {
      await validate(...args)
      await h.db`DELETE FROM chat_memberships WHERE workspace_id='w'`
    },
  )
  await expect(
    h.c.begin({ ...h.input('revoked-during-preparation'), fixture: false }),
  ).rejects.toThrow('Conversation not found.')
  expect(h.env.AI.run).not.toHaveBeenCalled()
  expect(h.local.prepare('SELECT turn_id FROM transcript_turns').all()).toEqual(
    [],
  )
})

it('does not resolve empty references after conversation authority is already checked', async () => {
  const h = await conversationHarness()
  const resolve = vi.spyOn(references, 'resolveMessageReferences')
  h.env.AI.run.mockRejectedValue(new Error('Synthetic provider stop'))
  await h.c.begin({
    ...h.input('empty-references'),
    fixture: false,
    references: [],
  })
  await h.settle()
  expect(h.env.AI.run).toHaveBeenCalled()
  expect(resolve).not.toHaveBeenCalled()
})

it('still resolves and rejects an unavailable nonempty conversation reference before admission', async () => {
  const h = await conversationHarness()
  const resolve = vi.spyOn(references, 'resolveMessageReferences')
  await expect(
    h.c.begin({
      ...h.input('unavailable-reference'),
      fixture: false,
      references: [
        {
          kind: 'conversation',
          botId: 'b',
          conversationId: 'unavailable-source',
        },
      ],
    }),
  ).rejects.toThrow()
  expect(resolve).toHaveBeenCalledOnce()
  expect(h.env.AI.run).not.toHaveBeenCalled()
  expect(h.local.prepare('SELECT turn_id FROM transcript_turns').all()).toEqual(
    [],
  )
})
