import './fixtures/loaded-assistant-tools'
import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'

afterEach(() => vi.unstubAllGlobals())

it('creates a section and places multiple conversations through one bulk assistant call', async () => {
  const h = await conversationHarness()
  await h.db`INSERT INTO chat_bots(id,workspace_id,name,purpose) VALUES('notes','w','Notes','')`
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('notes-main','notes',${'00000000-0000-4000-8000-000000000001'})`
  await h.db`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES('notes',${'00000000-0000-4000-8000-000000000001'},'notes-main')`
  const network = vi.fn(() => {
    throw Error('No external requests allowed')
  })
  vi.stubGlobal('fetch', network)
  let pass = 0
  const run = vi.fn(async (_model: string, payload: any) => {
    const current = pass++
    const names = payload.tools.map((tool: any) => tool.function.name)
    expect(names).toContain('create_conversation_section')
    expect(names).toContain('set_conversation_sections')
    const prior = current
      ? JSON.parse(
          payload.messages
            .filter((message: any) => message.role === 'tool')
            .at(-1).content,
        )
      : undefined
    const call =
      current === 0
        ? { name: 'create_conversation_section', args: { name: 'Projects' } }
        : current === 1
          ? {
              name: 'set_conversation_sections',
              args: {
                moves: [
                  {
                    conversationId: 'main-conversation',
                    sectionId: prior.section.id,
                  },
                  { conversationId: 'notes-main', sectionId: prior.section.id },
                ],
              },
            }
          : undefined
    if (current === 1)
      expect(prior).toMatchObject({ ok: true, section: { name: 'Projects' } })
    if (current === 2)
      expect(prior).toMatchObject({
        ok: true,
        moves: [{ ok: true }, { ok: true }],
      })
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      `data: ${JSON.stringify({ id: `bulk-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      frame(
        call
          ? {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: `bulk-call-${current}`,
                  type: 'function',
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.args),
                  },
                },
              ],
            }
          : { role: 'assistant', content: 'Organized both conversations.' },
      ) +
        frame({}, call ? 'tool_calls' : 'stop') +
        'data: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input('bulk', 'Put these conversations in Projects'),
    fixture: false,
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  const sections =
    await h.db`SELECT id FROM chat_bot_sections WHERE name='Projects'`
  expect(sections).toHaveLength(1)
  expect(
    await h.db`SELECT bot_id,section_id FROM chat_bot_viewer_state ORDER BY bot_id`,
  ).toEqual([
    { bot_id: 'b', section_id: sections[0].id },
    { bot_id: 'notes', section_id: sections[0].id },
  ])
  expect(run).toHaveBeenCalledTimes(3)
  expect(network).not.toHaveBeenCalled()
})

it.each(['move', 'remove', 'rename'] as const)(
  'discovers sections and performs %s through the assistant loop',
  async (operation) => {
    const remove = operation === 'remove'
    const rename = operation === 'rename'
    const h = await conversationHarness()
    await h.db`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) VALUES('projects','w',${'00000000-0000-4000-8000-000000000001'},'Projects',0)`
    await h.db`INSERT INTO chat_bot_viewer_state(bot_id,user_id,pinned,section_id) VALUES('b',${'00000000-0000-4000-8000-000000000001'},true,${remove || rename ? 'projects' : null})`
    const network = vi.fn(() => {
      throw Error('No external requests allowed')
    })
    vi.stubGlobal('fetch', network)
    let pass = 0
    const run = vi.fn(async (_model: string, payload: any) => {
      const current = pass++
      let call: { name: string; args: unknown } | undefined
      if (current === 0)
        call = {
          name: 'list_conversation_sections',
          args: { query: 'Projects' },
        }
      else {
        const result = JSON.parse(
          payload.messages
            .filter((message: any) => message.role === 'tool')
            .at(-1).content,
        )
        if (current === 1) {
          expect(result).toMatchObject({
            untrusted: true,
            truncated: false,
            sections: [{ id: 'projects', name: 'Projects' }],
          })
          call = rename
            ? {
                name: 'rename_conversation_section',
                args: {
                  sectionId: result.sections[0].id,
                  version: result.sections[0].version,
                  name: 'Plans',
                },
              }
            : {
                name: 'set_conversation_section',
                args: { sectionId: remove ? null : result.sections[0].id },
              }
        } else {
          if (rename)
            expect(result).toMatchObject({
              ok: true,
              sectionId: 'projects',
              section: { name: 'Plans', version: 1 },
            })
          else
            expect(result).toEqual({
              ok: true,
              conversationId: 'main-conversation',
              sectionId: remove ? null : 'projects',
            })
        }
      }
      const frame = (delta: unknown, finish_reason: string | null = null) =>
        `data: ${JSON.stringify({ id: `section-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
      return new Response(
        frame(
          call
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: `section-call-${current}`,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.args),
                    },
                  },
                ],
              }
            : { role: 'assistant', content: 'Updated the section.' },
        ) +
          frame({}, call ? 'tool_calls' : 'stop') +
          'data: [DONE]\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    })
    Object.assign(h.env, { AI: { run } })
    await h.c.begin({
      ...h.input(
        'section',
        rename
          ? 'Rename Projects to Plans'
          : remove
            ? 'Remove this conversation from Projects'
            : 'Move this conversation to Projects',
      ),
      fixture: false,
    })
    await h.settle()
    expect((await h.c.snapshot()).error).toBeUndefined()
    expect(
      (
        await h.db`SELECT section_id,pinned FROM chat_bot_viewer_state WHERE bot_id='b' AND user_id=${'00000000-0000-4000-8000-000000000001'}`
      )[0],
    ).toEqual({ section_id: remove ? null : 'projects', pinned: true })
    expect(
      (await h.db`SELECT name FROM chat_bot_sections WHERE id='projects'`)[0]
        ?.name,
    ).toBe(remove ? undefined : rename ? 'Plans' : 'Projects')
    expect(run).toHaveBeenCalledTimes(3)
    expect(network).not.toHaveBeenCalled()
  },
)

it('discovers own conversation metadata through the actual assistant loop without selected transcript access', async () => {
  const h = await conversationHarness()
  await h.db`INSERT INTO chat_bots(id,workspace_id,name,purpose) VALUES('notes','w','Project notes','')`
  await h.db`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES('notes-main','notes',${'00000000-0000-4000-8000-000000000001'})`
  await h.db`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES('notes',${'00000000-0000-4000-8000-000000000001'},'notes-main')`
  const network = vi.fn(() => {
    throw Error('No external requests allowed')
  })
  vi.stubGlobal('fetch', network)
  const payloads: any[] = []
  const run = vi.fn(async (_model: string, payload: any) => {
    payloads.push(payload)
    const names = payload.tools.map((tool: any) => tool.function.name)
    expect(names).toContain('list_workspace_conversations')
    expect(names).toContain('read_conversation')
    const first = payloads.length === 1
    if (!first) {
      const result = JSON.parse(
        payload.messages
          .filter((message: any) => message.role === 'tool')
          .at(-1).content,
      )
      expect(result).toMatchObject({
        untrusted: true,
        nextAfterId: null,
        items: [
          {
            kind: 'conversation',
            label: 'Project notes',
            conversationId: 'notes-main',
          },
        ],
      })
    }
    const delta = first
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'discover',
              type: 'function',
              function: {
                name: 'list_workspace_conversations',
                arguments: JSON.stringify({ query: 'notes' }),
              },
            },
          ],
        }
      : {
          role: 'assistant',
          content: 'Found Project notes. Attach it to read its messages.',
        }
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      `data: ${JSON.stringify({ id: 'response', choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      frame(delta) +
        frame({}, first ? 'tool_calls' : 'stop') +
        'data: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input('discover', 'Find my notes conversation'),
    fixture: false,
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(run).toHaveBeenCalledTimes(2)
  expect(network).not.toHaveBeenCalled()
})

it('inspects and renames the current conversation through the actual assistant loop', async () => {
  const h = await conversationHarness()
  const network = vi.fn(() => {
    throw Error('No external requests allowed')
  })
  vi.stubGlobal('fetch', network)
  let version: number | undefined
  let pass = 0
  const run = vi.fn(async (_model: string, payload: any) => {
    const current = pass++
    let call: { name: string; args: unknown } | undefined
    if (current === 0)
      call = { name: 'inspect_conversation_settings', args: {} }
    else {
      const result = JSON.parse(
        payload.messages
          .filter((message: any) => message.role === 'tool')
          .at(-1).content,
      )
      if (current === 1) {
        expect(result).toMatchObject({
          name: 'Bot',
          version: 0,
          conversationId: 'main-conversation',
        })
        version = result.version
        call = {
          name: 'rename_conversation',
          args: {
            conversationId: result.conversationId,
            version,
            name: 'Cedar notes',
          },
        }
      } else
        expect(result).toEqual({
          ok: true,
          conversationId: 'main-conversation',
          name: 'Cedar notes',
          version: 1,
        })
    }
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      `data: ${JSON.stringify({ id: `rename-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      frame(
        call
          ? {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: `call-${current}`,
                  type: 'function',
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.args),
                  },
                },
              ],
            }
          : { role: 'assistant', content: 'Renamed to Cedar notes.' },
      ) +
        frame({}, call ? 'tool_calls' : 'stop') +
        'data: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input('rename', 'Rename this conversation Cedar notes'),
    fixture: false,
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect((await h.db`SELECT name FROM chat_bots WHERE id='b'`)[0]?.name).toBe(
    'Cedar notes',
  )
  expect(run).toHaveBeenCalledTimes(3)
  expect(network).not.toHaveBeenCalled()
})

it('pins the current conversation through the actual assistant loop', async () => {
  const h = await conversationHarness()
  const network = vi.fn(() => {
    throw Error('No external requests allowed')
  })
  vi.stubGlobal('fetch', network)
  let pass = 0
  const run = vi.fn(async (_model: string, payload: any) => {
    const first = pass++ === 0
    if (!first) {
      const result = JSON.parse(
        payload.messages
          .filter((message: any) => message.role === 'tool')
          .at(-1).content,
      )
      expect(result).toEqual({
        ok: true,
        conversationId: 'main-conversation',
        pinned: true,
      })
    }
    const delta = first
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'pin-call',
              type: 'function',
              function: {
                name: 'set_conversation_pinned',
                arguments: '{"pinned":true}',
              },
            },
          ],
        }
      : { role: 'assistant', content: 'Pinned.' }
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      `data: ${JSON.stringify({ id: `pin-${pass}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      frame(delta) +
        frame({}, first ? 'tool_calls' : 'stop') +
        'data: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input('pin', 'Pin this conversation'),
    fixture: false,
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(
    (
      await h.db`SELECT pinned FROM chat_bot_viewer_state WHERE bot_id='b' AND user_id=${'00000000-0000-4000-8000-000000000001'}`
    )[0]?.pinned,
  ).toBe(true)
  expect(run).toHaveBeenCalledTimes(2)
  expect(network).not.toHaveBeenCalled()
})
