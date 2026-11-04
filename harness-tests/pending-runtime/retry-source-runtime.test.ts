import { afterEach, expect, it, vi } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import { defaultPolicy, type Approval } from '../../src/chat/core/types'
import { conversationHarness } from './fixtures/conversation-runtime'

const identity = {
  userId: '00000000-0000-4000-8000-000000000001',
  workspaceId: 'w',
  botId: 'b',
  conversationId: 'main-conversation',
}
const options = { policy: defaultPolicy, fixture: true }
const prompt = (id: string, text = 'Exact original request'): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', content: text }],
})
const receipt = (outcome: Approval['executionOutcome'] = 'unknown'): Approval =>
  ({
    id: 'reviewed-action',
    messageId: 'first',
    title: 'Save a record',
    code: 'original code',
    status: outcome === 'unknown' ? 'error' : 'done',
    executionOutcome: outcome,
    result: outcome,
    resumeRequest: 'Must not appear in review data',
  }) as Approval
afterEach(() => vi.restoreAllMocks())

it('captures exact settled inputs and inert effects without copying or starting work', async () => {
  const h = await conversationHarness({
    messages: [
      prompt('first', '  Exact\nrequest  '),
      {
        id: 'answer',
        role: 'assistant',
        parts: [
          { type: 'thinking', content: 'private reasoning' },
          {
            type: 'tool-call',
            id: 'read',
            name: 'read_messages',
            arguments: '{}',
            state: 'complete',
            output: { count: 3 },
          },
          { type: 'text', content: 'I found three messages.' },
        ],
      },
    ],
    approvals: [receipt()],
  })
  const original = await h.c.snapshot()
  const result = await h.c.captureRetrySource(identity, 'first', options)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  expect(result.source.request.text).toBe('  Exact\nrequest  ')
  expect(result.source.boundary).toMatchObject({
    kind: 'message',
    messageId: 'first',
    side: 'before',
  })
  expect(result.source.evidenceDigest).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(JSON.stringify(result)).not.toContain('private reasoning')
  expect(JSON.stringify(result)).not.toContain('resumeRequest')
  expect(result.source.evidence.receipts).toMatchObject([
    { executionOutcome: 'unknown', result: 'unknown' },
  ])
  expect(result.source.evidence.messages[1].parts).toContainEqual(
    expect.objectContaining({
      type: 'tool-call',
      name: 'read_messages',
      output: { count: 3 },
    }),
  )
  const after = await h.c.snapshot()
  expect(after.messages).toEqual(original.messages)
  expect(after.approvals).toEqual(original.approvals)
  expect(after.activeRun).toBe(null)
  expect(after.usageSteps).toEqual([])
  expect(
    (await h.db`SELECT count(*)::int AS n FROM chat_conversations`)[0],
  ).toMatchObject({ n: 1 })
  expect(
    await (
      await h.reconstruct()
    ).captureRetrySource(identity, 'first', options),
  ).toEqual(result)
})

it('captures an archived request and excludes later turns', async () => {
  const h = await conversationHarness()
  for (let i = 0; i < 8; i++) {
    await h.c.begin(h.input(`turn-${i}`, `Request ${i}`))
    await h.settle()
  }
  const restored = await h.reconstruct()
  const result = await restored.captureRetrySource(identity, 'turn-0', options)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  expect(result.source.request.text).toBe('Request 0')
  expect(
    result.source.evidence.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.id),
  ).toEqual(['turn-0'])
  expect(result.source.evidence.messages).toHaveLength(2)
  expect(
    await restored.captureRetrySource(
      identity,
      result.source.evidence.messages[1].id,
      options,
    ),
  ).toMatchObject({ ok: false, status: 400, code: 'not_request' })
})

it('refuses a running request but permits a completed earlier one', async () => {
  const h = await conversationHarness({ messages: [prompt('first')] })
  h.env.GUM_FIXTURE_DELAY_MS = '100'
  await h.c.begin(h.input('second'))
  expect(
    await h.c.captureRetrySource(identity, 'second', options),
  ).toMatchObject({ ok: false, code: 'source_running' })
  expect(
    await h.c.captureRetrySource(identity, 'first', options),
  ).toMatchObject({ ok: true })
  await h.settle()
})

it('does not replace missing, malformed or reset requests with a fresh prompt', async () => {
  const h = await conversationHarness({
    messages: [
      prompt('first'),
      { ...prompt('bad'), metadata: { gumAttachments: null } },
    ],
  })
  expect(await h.c.captureRetrySource(identity, 'bad', options)).toMatchObject({
    ok: false,
    code: 'unsupported_request',
  })
  expect(
    await h.c.captureRetrySource(identity, 'missing', options),
  ).toMatchObject({ ok: false, status: 404 })
  await h.c.reset()
  await h.settle()
  expect(
    await h.c.captureRetrySource(identity, 'first', options),
  ).toMatchObject({ ok: false, status: 404 })
})

it('binds the current action evidence even if only an approval outcome changed', async () => {
  const h = await conversationHarness({
    messages: [prompt('first')],
    approvals: [receipt()],
  })
  const original = await h.c.captureRetrySource(identity, 'first', options)
  const nativeDigest = crypto.subtle.digest.bind(crypto.subtle)
  let changed = false
  vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    if (!changed) {
      changed = true
      const state = await h.c.snapshot()
      state.approvals[0].executionOutcome = 'succeeded'
      state.approvals[0].result = 'Record exists.'
    }
    return nativeDigest(...args)
  })
  expect(
    await h.c.captureRetrySource(identity, 'first', options),
  ).toMatchObject({ ok: false, code: 'source_changed' })
  vi.restoreAllMocks()
  const latest = await h.c.captureRetrySource(identity, 'first', options)
  expect(original.ok && latest.ok).toBe(true)
  if (!original.ok || !latest.ok) throw new Error('Missing source')
  expect(latest.source.boundary).toEqual(original.source.boundary)
  expect(latest.source.evidenceDigest).not.toEqual(
    original.source.evidenceDigest,
  )
})

it('rechecks ownership after async work and never returns a revoked snapshot', async () => {
  const h = await conversationHarness({ messages: [prompt('first')] })
  const nativeDigest = crypto.subtle.digest.bind(crypto.subtle)
  vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
    return nativeDigest(...args)
  })
  await expect(
    h.c.captureRetrySource(identity, 'first', options),
  ).rejects.toMatchObject({ status: 404 })
})

it('rejects another owner, deleted sources and unavailable attachments', async () => {
  const attachment = {
    id: 'e3aa027c-6bab-48d7-b865-b487e887bf19',
    botId: 'b',
    conversationId: 'main-conversation',
    name: 'notes.txt',
    size: 5,
    sha256: 'a'.repeat(64),
    mediaType: 'text/plain',
    source: 'upload',
    state: 'ready',
    createdAt: 1,
  }
  const h = await conversationHarness({
    messages: [
      { ...prompt('first'), metadata: { gumAttachments: [attachment] } },
    ],
  })
  expect(
    await h.c.captureRetrySource(identity, 'first', options),
  ).toMatchObject({ ok: false, code: 'input_unavailable' })
  await expect(
    h.c.captureRetrySource({ ...identity, userId: 'other' }, 'first', options),
  ).rejects.toThrow()
  await h.db`UPDATE chat_bots SET deleted_at=to_timestamp(0.001) WHERE id='b'`
  await expect(
    h.c.captureRetrySource(identity, 'first', options),
  ).rejects.toMatchObject({ status: 409 })
})

it('preserves successful file references and original model intent without choosing a new model', async () => {
  const file = {
    id: 'e3aa027c-6bab-48d7-b865-b487e887bf19',
    botId: 'b',
    conversationId: 'main-conversation',
    name: 'notes.txt',
    size: 5,
    sha256: 'a'.repeat(64),
    mediaType: 'text/plain',
    source: 'upload',
    state: 'ready',
    createdAt: 1,
  }
  const reference = {
    kind: 'file',
    botId: 'b',
    conversationId: 'main-conversation',
    fileId: file.id,
    label: file.name,
  }
  const runModel = {
    provider: 'openai',
    model: 'original-choice',
    reasoning: 'high',
  }
  const h = await conversationHarness({
    messages: [
      {
        ...prompt('first'),
        metadata: {
          gumAttachments: [file],
          gumReferences: [reference],
          gumRunModel: runModel,
        },
      },
    ],
  })
  await h.db`INSERT INTO chat_saved_files(id,workspace_id,user_id,bot_id,conversation_id,name,media_type,size,sha256,source,state,created_at) VALUES(${file.id},'w',${identity.userId},'b','main-conversation','notes.txt','text/plain',5,${file.sha256},'upload','ready',1)`
  const result = await h.c.captureRetrySource(identity, 'first', options)
  expect(result).toMatchObject({
    ok: true,
    source: {
      request: { attachments: [file], references: [reference], runModel },
    },
  })
  expect((await h.c.snapshot()).usageSteps).toEqual([])
})

it('rejects reset during asynchronous capture instead of returning a stale source', async () => {
  const h = await conversationHarness({ messages: [prompt('first')] })
  const nativeDigest = crypto.subtle.digest.bind(crypto.subtle)
  let reset = false
  vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    if (!reset) {
      reset = true
      await h.c.reset()
      await h.settle()
    }
    return nativeDigest(...args)
  })
  expect(
    await h.c.captureRetrySource(identity, 'first', options),
  ).toMatchObject({ ok: false, code: 'source_changed' })
  expect((await h.c.snapshot()).messages).toEqual([])
})

it('uses a late live approval outcome when reviewing an archived source turn', async () => {
  const h = await conversationHarness({
    messages: [prompt('first')],
    approvals: [receipt()],
  })
  for (let i = 0; i < 7; i++) {
    await h.c.begin(h.input(`later-${i}`))
    await h.settle()
  }
  const old = await h.c.captureRetrySource(identity, 'first', options)
  const state = await h.c.snapshot()
  expect(state.messages.some((item) => item.id === 'first')).toBe(false)
  state.approvals.push(receipt('succeeded'))
  const latest = await h.c.captureRetrySource(identity, 'first', options)
  if (!old.ok || !latest.ok) throw new Error('Missing source')
  expect(latest.source.evidence.receipts).toMatchObject([
    { executionOutcome: 'succeeded' },
  ])
  expect(latest.source.boundary).toEqual(old.source.boundary)
  expect(latest.source.evidenceDigest).not.toEqual(old.source.evidenceDigest)
})
