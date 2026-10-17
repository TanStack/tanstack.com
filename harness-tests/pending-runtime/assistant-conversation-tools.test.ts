import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { AssistantConversations } from '../../src/chat/server/assistant-conversation-tools'

async function setup(beforeCommit?: () => void | Promise<void>) {
  const h = await conversationHarness()
  const hooks = { afterCommit: async () => {} }
  const env = {
    ...h.env,
    CONVERSATIONS: {
      getByName() {
        throw new Error('Unexpected lifecycle reservation')
      },
    },
    WORKSPACE_SYNC: {
      getByName() {
        return { publish: async () => hooks.afterCommit() }
      },
    },
  }
  const service = new AssistantConversations(
    env,
    {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      botId: 'b',
      conversationId: 'main-conversation',
    },
    beforeCommit,
  )
  return { ...h, env, hooks, service }
}
it('renames a discovered section and rejects a stale version', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['s', 'w', '00000000-0000-4000-8000-000000000001', 'Before', 0],
  )
  const [section] = (await h.service.sections({})).sections
  expect(
    await h.service.renameSection({
      sectionId: section.id,
      version: section.version,
      name: 'After',
    }),
  ).toMatchObject({ ok: true, section: { id: 's', name: 'After', version: 1 } })
  await expect(
    h.service.renameSection({ sectionId: 's', version: 0, name: 'Stale' }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.sections({})).sections[0].name).toBe('After')
})
it('creates a section, then moves several main conversations in one verified write', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_bots(id,workspace_id,parent_id,name,purpose,created_at) VALUES($1,$2,$3,$4,$5,$6)',
    ['second', 'w', 'b', 'Second', '', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['second-main', 'second', '00000000-0000-4000-8000-000000000001', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES($1,$2,$3)',
    ['second', '00000000-0000-4000-8000-000000000001', 'second-main'],
  )
  await h.service.pin({ pinned: true })
  const created = await h.service.createSection({ name: 'Projects' })
  expect(created).toMatchObject({ ok: true, section: { name: 'Projects' } })
  const sectionId = created.section!.id
  expect(
    await h.service.setSections({
      moves: [
        { conversationId: 'main-conversation', sectionId },
        { conversationId: 'second-main', sectionId },
      ],
    }),
  ).toEqual({
    ok: true,
    moves: [
      { conversationId: 'main-conversation', sectionId, ok: true },
      { conversationId: 'second-main', sectionId, ok: true },
    ],
  })
  expect(await h.service.inspect({})).toMatchObject({ pinned: true, sectionId })
  expect(
    (
      await h.db.unsafe('SELECT parent_id FROM chat_bots WHERE id=$1', [
        'second',
      ])
    )[0],
  ).toMatchObject({ parent_id: 'b' })
  expect(
    (
      await h.db.unsafe(
        'SELECT section_id FROM chat_bot_viewer_state WHERE bot_id=$1',
        ['second'],
      )
    )[0],
  ).toMatchObject({ section_id: sectionId })
})
it('does not partly move conversations when a section or selection changes before commit', async () => {
  const h = await setup(async () => {
    await h.db.unsafe(
      'INSERT INTO chat_bot_viewer_state(bot_id,user_id,section_id) VALUES($1,$2,$3) ON CONFLICT(bot_id,user_id) DO UPDATE SET section_id=excluded.section_id',
      ['b', '00000000-0000-4000-8000-000000000001', 'other'],
    )
  })
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['target', 'w', '00000000-0000-4000-8000-000000000001', 'Target', 0],
  )
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['other', 'w', '00000000-0000-4000-8000-000000000001', 'Other', 1],
  )
  await h.db.unsafe(
    'INSERT INTO chat_bots(id,workspace_id,parent_id,name,purpose,created_at) VALUES($1,$2,$3,$4,$5,$6)',
    ['second', 'w', null, 'Second', '', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['second-main', 'second', '00000000-0000-4000-8000-000000000001', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES($1,$2,$3)',
    ['second', '00000000-0000-4000-8000-000000000001', 'second-main'],
  )
  await expect(
    h.service.setSections({
      moves: [
        { conversationId: 'main-conversation', sectionId: 'target' },
        { conversationId: 'second-main', sectionId: 'target' },
      ],
    }),
  ).rejects.toMatchObject({ status: 409 })
  expect(
    (
      await h.db.unsafe(
        'SELECT section_id FROM chat_bot_viewer_state WHERE bot_id=$1',
        ['b'],
      )
    )[0],
  ).toMatchObject({ section_id: 'other' })
  expect(
    (
      await h.db.unsafe(
        'SELECT section_id FROM chat_bot_viewer_state WHERE bot_id=$1',
        ['second'],
      )
    )[0],
  ).toBeUndefined()
})
it('rolls back every section move if one database write fails', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['target', 'w', '00000000-0000-4000-8000-000000000001', 'Target', 0],
  )
  await h.db.unsafe(
    'INSERT INTO chat_bots(id,workspace_id,parent_id,name,purpose,created_at) VALUES($1,$2,$3,$4,$5,$6)',
    ['second', 'w', null, 'Second', '', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['second-main', 'second', '00000000-0000-4000-8000-000000000001', 2],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES($1,$2,$3)',
    ['second', '00000000-0000-4000-8000-000000000001', 'second-main'],
  )
  await h.db`CREATE OR REPLACE FUNCTION fail_second_section() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.bot_id='second' THEN RAISE EXCEPTION 'Synthetic section write failure'; END IF; RETURN NEW; END $$`
  await h.db`CREATE TRIGGER fail_second_section BEFORE INSERT ON chat_bot_viewer_state FOR EACH ROW EXECUTE FUNCTION fail_second_section()`
  try {
    await expect(
      h.service.setSections({
        moves: [
          { conversationId: 'main-conversation', sectionId: 'target' },
          { conversationId: 'second-main', sectionId: 'target' },
        ],
      }),
    ).rejects.toMatchObject({
      cause: { message: 'Synthetic section write failure' },
    })
    expect(
      await h.db.unsafe(
        'SELECT bot_id,section_id FROM chat_bot_viewer_state',
        [],
      ),
    ).toEqual([])
  } finally {
    await h.db`DROP TRIGGER IF EXISTS fail_second_section ON chat_bot_viewer_state`
    await h.db`DROP FUNCTION IF EXISTS fail_second_section()`
  }
})
it('rejects a destination section removed before the bulk write', async () => {
  const h = await setup(async () => {
    await h.db.unsafe('DELETE FROM chat_bot_sections WHERE id=$1', ['target'])
  })
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['target', 'w', '00000000-0000-4000-8000-000000000001', 'Target', 0],
  )
  await expect(
    h.service.setSections({
      moves: [{ conversationId: 'main-conversation', sectionId: 'target' }],
    }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.inspect({})).sectionId).toBeNull()
})
it('rejects a bulk move if workspace access is revoked before commit', async () => {
  const h = await setup(async () => {
    await h.db.unsafe(
      'DELETE FROM chat_memberships WHERE workspace_id=$1 AND user_id=$2',
      ['w', '00000000-0000-4000-8000-000000000001'],
    )
  })
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['target', 'w', '00000000-0000-4000-8000-000000000001', 'Target', 0],
  )
  await expect(
    h.service.setSections({
      moves: [{ conversationId: 'main-conversation', sectionId: 'target' }],
    }),
  ).rejects.toMatchObject({ status: 404 })
  expect(await h.db.unsafe('SELECT * FROM chat_bot_viewer_state', [])).toEqual(
    [],
  )
})
it('rejects thread, duplicate and foreign section assignments before writing', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['thread', 'b', '00000000-0000-4000-8000-000000000001', 2],
  )
  await h.db`INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000002')`
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['foreign', 'w', '00000000-0000-4000-8000-000000000002', 'Private', 0],
  )
  await expect(
    h.service.setSections({
      moves: [{ conversationId: 'thread', sectionId: null }],
    }),
  ).rejects.toMatchObject({ status: 404 })
  await expect(
    h.service.setSections({
      moves: [
        { conversationId: 'main-conversation', sectionId: null },
        { conversationId: 'main-conversation', sectionId: null },
      ],
    }),
  ).rejects.toThrow('Select each conversation only once.')
  await expect(
    h.service.setSections({
      moves: [{ conversationId: 'main-conversation', sectionId: 'foreign' }],
    }),
  ).rejects.toMatchObject({ status: 404 })
  expect((await h.service.inspect({})).sectionId).toBeNull()
})
it('does not create a section after task cancellation', async () => {
  const h = await setup(async () => {
    throw Error('Stopped')
  })
  await expect(h.service.createSection({ name: 'Projects' })).rejects.toThrow(
    'Stopped',
  )
  expect((await h.service.sections({})).sections).toEqual([])
})
it('cancels a section rename before writing', async () => {
  const h = await setup(async () => {
    throw Error('Stopped')
  })
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['s', 'w', '00000000-0000-4000-8000-000000000001', 'Before', 0],
  )
  await expect(
    h.service.renameSection({ sectionId: 's', version: 0, name: 'After' }),
  ).rejects.toThrow('Stopped')
  expect((await h.service.sections({})).sections[0]).toMatchObject({
    name: 'Before',
    version: 0,
  })
})
it('reports a later section edit instead of claiming the requested rename persists', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['s', 'w', '00000000-0000-4000-8000-000000000001', 'Before', 0],
  )
  h.hooks.afterCommit = async () => {
    await h.db.unsafe(
      'UPDATE chat_bot_sections SET name=$1,version=version+1 WHERE id=$2',
      ['Concurrent', 's'],
    )
  }
  expect(
    await h.service.renameSection({
      sectionId: 's',
      version: 0,
      name: 'After',
    }),
  ).toMatchObject({
    ok: false,
    outcome: 'changed_after_write',
    section: { name: 'Concurrent', version: 2 },
  })
})
it('discovers and selects personal sections without changing pinning or parentage', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['s', 'w', '00000000-0000-4000-8000-000000000001', 'Projects', 0],
  )
  expect(await h.service.sections({ query: 'ject' })).toMatchObject({
    untrusted: true,
    sections: [{ id: 's', name: 'Projects' }],
    truncated: false,
  })
  await h.service.pin({ pinned: true })
  expect(await h.service.section({ sectionId: 's' })).toMatchObject({
    ok: true,
    sectionId: 's',
  })
  expect(await h.service.inspect({})).toMatchObject({
    sectionId: 's',
    pinned: true,
  })
  expect(await h.service.section({ sectionId: null })).toMatchObject({
    ok: true,
    sectionId: null,
  })
  expect((await h.service.inspect({})).pinned).toBe(true)
  expect(
    (
      await h.db.unsafe('SELECT parent_id FROM chat_bots WHERE id=$1', ['b'])
    )[0],
  ).toMatchObject({ parent_id: null })
})
it('rejects nonexistent section IDs and checks membership before discovery', async () => {
  const h = await setup()
  await expect(
    h.service.section({ sectionId: 'unknown' }),
  ).rejects.toMatchObject({ status: 404 })
  expect((await h.service.inspect({})).sectionId).toBeNull()
  await h.db.unsafe('DELETE FROM chat_memberships WHERE user_id=$1', [
    '00000000-0000-4000-8000-000000000001',
  ])
  await expect(h.service.sections({})).rejects.toMatchObject({ status: 404 })
})
it('does not expose or select another viewer’s sections', async () => {
  const h = await setup()
  await h.db`INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000002')`
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    [
      'private',
      'w',
      '00000000-0000-4000-8000-000000000002',
      'Private section',
      0,
    ],
  )
  expect(await h.service.sections({})).toMatchObject({ sections: [] })
  await expect(
    h.service.section({ sectionId: 'private' }),
  ).rejects.toMatchObject({ status: 404 })
  await expect(
    h.service.renameSection({
      sectionId: 'private',
      version: 0,
      name: 'Unauthorized',
    }),
  ).rejects.toMatchObject({ status: 404 })
})
it('pages through duplicate section names despite changes in sidebar ordering', async () => {
  const h = await setup()
  for (let i = 0; i < 205; i++)
    await h.db`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES(${`s${String(i).padStart(3, '0')}`},'w','00000000-0000-4000-8000-000000000001','Projects',${205 - i})`
  await h.db`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES('literal','w','00000000-0000-4000-8000-000000000001','100%_complete',0)`
  const first = await h.service.sections({ query: 'projects' })
  expect(first.sections).toHaveLength(100)
  expect(first.nextAfterId).toBe('s099')
  await h.db`UPDATE chat_bot_sections SET position=-position`
  const second = await h.service.sections({
    query: 'projects',
    afterId: first.nextAfterId!,
  })
  const third = await h.service.sections({
    query: 'projects',
    afterId: second.nextAfterId!,
  })
  const ids = [...first.sections, ...second.sections, ...third.sections].map(
    (row) => row.id,
  )
  expect(ids).toHaveLength(205)
  expect(new Set(ids).size).toBe(205)
  expect(third.nextAfterId).toBeNull()
  expect(third.truncated).toBe(false)
  expect(
    (await h.service.sections({ query: '%_' })).sections.map((row) => row.id),
  ).toEqual(['literal'])
})
it('does not perform a section move after task cancellation', async () => {
  const h = await setup(async () => {
    throw Error('Stopped')
  })
  await h.db.unsafe(
    'INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES($1,$2,$3,$4,$5)',
    ['s', 'w', '00000000-0000-4000-8000-000000000001', 'Projects', 0],
  )
  await expect(h.service.section({ sectionId: 's' })).rejects.toThrow('Stopped')
  expect((await h.service.inspect({})).sectionId).toBeNull()
})
it('renames the inspected current conversation through the shared service', async () => {
  const h = await setup()
  expect(await h.service.inspect({})).toMatchObject({
    name: 'Bot',
    version: 0,
    conversationId: 'main-conversation',
  })
  expect(await h.service.rename({ version: 0, name: 'Project notes' })).toEqual(
    {
      ok: true,
      conversationId: 'main-conversation',
      name: 'Project notes',
      version: 1,
    },
  )
  expect(
    (
      await h.db.unsafe('SELECT name,purpose FROM chat_bots WHERE id=$1', ['b'])
    )[0],
  ).toMatchObject({ name: 'Project notes', purpose: '' })
  await expect(
    h.service.rename({ version: 0, name: 'Repeat' }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.inspect({})).name).toBe('Project notes')
})
it('does not overwrite a competing UI edit', async () => {
  const h = await setup()
  const before = await h.service.inspect({})
  await h.db.unsafe('UPDATE chat_bots SET name=$1 WHERE id=$2', [
    'UI edit',
    'b',
  ])
  await h.db.unsafe('UPDATE chat_bots SET version=version+1 WHERE id=$1', ['b'])
  await expect(
    h.service.rename({ version: before.version, name: 'Stale' }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.inspect({})).name).toBe('UI edit')
})
it.each(['Later edit', 'Requested name'])(
  'reports a later revision with observed name %s without retrying',
  async (observedName) => {
    const h = await setup()
    let writes = 0
    h.hooks.afterCommit = async () => {
      writes++
      await h.db.unsafe('UPDATE chat_bots SET name=$1 WHERE id=$2', [
        observedName,
        'b',
      ])
      await h.db.unsafe('UPDATE chat_bots SET version=version+1 WHERE id=$1', [
        'b',
      ])
    }
    expect(
      await h.service.rename({ version: 0, name: 'Requested name' }),
    ).toMatchObject({
      ok: false,
      untrusted: true,
      outcome: 'changed_after_write',
      appliedVersion: 1,
      name: observedName,
      version: 2,
    })
    expect(writes).toBe(1)
    expect((await h.service.inspect({})).name).toBe(observedName)
  },
)
it('does not map a thread to its parent when renaming', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['thread', 'b', '00000000-0000-4000-8000-000000000001', 1],
  )
  await expect(
    h.service.rename({
      conversationId: 'thread',
      version: 0,
      name: 'Wrong parent',
    }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.inspect({})).name).toBe('Bot')
})
it('rejects another viewer’s conversation even in the same workspace', async () => {
  const h = await setup()
  await h.db`INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000002')`
  await h.db.unsafe(
    'INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES($1,$2,$3)',
    ['w', '00000000-0000-4000-8000-000000000002', 'member'],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['other-main', 'b', '00000000-0000-4000-8000-000000000002', 1],
  )
  await h.db.unsafe(
    'INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES($1,$2,$3)',
    ['b', '00000000-0000-4000-8000-000000000002', 'other-main'],
  )
  await expect(
    h.service.rename({
      conversationId: 'other-main',
      version: 0,
      name: 'Other',
    }),
  ).rejects.toMatchObject({ status: 404 })
})
it('checks the initiating conversation even with a valid target', async () => {
  const h = await setup()
  const service = new AssistantConversations(h.env, {
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
    conversationId: 'missing',
  })
  await expect(
    service.rename({
      conversationId: 'main-conversation',
      version: 0,
      name: 'Other',
    }),
  ).rejects.toMatchObject({ status: 404 })
})
it('rejects revoked membership and deleted conversations', async () => {
  const h = await setup()
  await h.db.unsafe(
    'UPDATE chat_bots SET deleted_at=to_timestamp(0.001) WHERE id=$1',
    ['b'],
  )
  await expect(h.service.inspect({})).rejects.toMatchObject({ status: 404 })
  await h.db.unsafe('DELETE FROM chat_memberships WHERE user_id=$1', [
    '00000000-0000-4000-8000-000000000001',
  ])
  await expect(
    h.service.rename({ version: 0, name: 'Revoked' }),
  ).rejects.toMatchObject({ status: 404 })
})
it('checks current task authority immediately before dispatch', async () => {
  const h = await setup(async () => {
    throw Error('Task stopped')
  })
  await expect(
    h.service.rename({ version: 0, name: 'Stopped' }),
  ).rejects.toThrow('Task stopped')
  expect((await h.service.inspect({})).name).toBe('Bot')
})
it('validates names and accepts no unrelated mutation fields', async () => {
  const h = await setup()
  for (const input of [
    { version: 0, name: '' },
    { version: 0, name: 'x'.repeat(61) },
    { version: 0, name: 'Valid', purpose: 'Injected' },
  ]) {
    await expect(h.service.rename(input)).rejects.toThrow()
  }
  expect((await h.service.inspect({})).version).toBe(0)
})

it('pins and unpins only the current viewer through the shared service', async () => {
  const h = await setup()
  expect(await h.service.pin({ pinned: true })).toEqual({
    ok: true,
    conversationId: 'main-conversation',
    pinned: true,
  })
  expect((await h.service.inspect({})).pinned).toBe(true)
  expect(await h.service.pin({ pinned: true })).toMatchObject({
    ok: true,
    pinned: true,
  })
  expect(await h.service.pin({ pinned: false })).toMatchObject({
    ok: true,
    pinned: false,
  })
  expect(
    await h.db.unsafe('SELECT user_id,pinned FROM chat_bot_viewer_state', []),
  ).toEqual([
    { user_id: '00000000-0000-4000-8000-000000000001', pinned: false },
  ])
})
it('rejects stopped pin requests before writing', async () => {
  const h = await setup(async () => {
    throw Error('Stopped')
  })
  await expect(h.service.pin({ pinned: true })).rejects.toThrow('Stopped')
  expect((await h.service.inspect({})).pinned).toBe(false)
})
it('never maps a requested thread pin to its parent', async () => {
  const h = await setup()
  await h.db.unsafe(
    'INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES($1,$2,$3,$4)',
    ['thread', 'b', '00000000-0000-4000-8000-000000000001', 1],
  )
  await expect(
    h.service.pin({ conversationId: 'thread', pinned: true }),
  ).rejects.toMatchObject({ status: 409 })
  expect((await h.service.inspect({})).pinned).toBe(false)
})

it('keeps conversation settings free of per-chat icons', async () => {
  const h = await setup()
  const settings = await h.service.inspect({})
  expect(settings).not.toHaveProperty('icon')
  expect(settings).not.toHaveProperty('hasCustomImage')
})

afterEach(async () => {
  vi.restoreAllMocks()
})
