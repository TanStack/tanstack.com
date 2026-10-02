import { expect, it } from 'vitest'
import { AssistantConversations } from '../../src/chat/server/assistant-conversation-tools'
import { conversationHarness } from './fixtures/conversation-runtime'

const userId = '00000000-0000-4000-8000-000000000001'
it.each(['access', 'destination', 'selection'] as const)(
  'rejects a bulk move when %s changes during the awaited pre-commit check',
  async (change) => {
    const h = await conversationHarness()
    await h.db`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES('target','w',${userId},'Target',0),('other','w',${userId},'Other',1)`
    const service = new AssistantConversations(
      {
        ...h.env,
        CONVERSATIONS: {
          getByName() {
            throw new Error(
              'Bulk section moves must not reserve a conversation lifecycle',
            )
          },
        },
      },
      {
        workspaceId: 'w',
        userId,
        botId: 'b',
        conversationId: 'main-conversation',
      },
      async () => {
        if (change === 'access')
          await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${userId}`
        else if (change === 'destination')
          await h.db`DELETE FROM chat_bot_sections WHERE id='target'`
        else
          await h.db`INSERT INTO chat_bot_viewer_state(bot_id,user_id,section_id) VALUES('b',${userId},'other') ON CONFLICT(bot_id,user_id) DO UPDATE SET section_id=excluded.section_id`
      },
    )
    await expect(
      service.setSections({
        moves: [{ conversationId: 'main-conversation', sectionId: 'target' }],
      }),
    ).rejects.toMatchObject({ status: change === 'access' ? 404 : 409 })
    const rows =
      await h.db`SELECT section_id FROM chat_bot_viewer_state WHERE bot_id='b' AND user_id=${userId}`
    expect(rows.map((row) => row.section_id)).toEqual(
      change === 'selection' ? ['other'] : [],
    )
  },
)
