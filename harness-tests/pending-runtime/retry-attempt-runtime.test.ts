import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import { conversationHarness } from './fixtures/conversation-runtime'
import { sqliteDoTransactions } from '../core/fixtures/sqlite-do-storage'
import { Conversation, type RunInput } from '../../src/chat/server/conversation'
import { ConversationRetries } from '../../src/chat/server/conversation-retries'
import { ConversationCopies } from '../../src/chat/server/conversation-copies'
import type { CopyExportRequest } from '../../src/chat/core/conversation-copy'
import {
  actionEvidenceInventory,
  retryTurnSource,
  type ActionEvidence,
} from '../../src/chat/core/retry-source'
import {
  importedActionEvidence,
  importedRetrySource,
} from '../../src/chat/server/conversation-copy-storage'
import { durableResultStore } from '../../src/chat/server/durable-results'
import * as attachmentRequest from '../../src/chat/server/attachment-request'
import { defaultPolicy } from '../../src/chat/core/types'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db as sharedDb } from '../../src/db/client'
import {
  chatConversationCopies,
  chatConversationRetries,
} from '../../src/db/schema'
import { readWorkspaceBot } from '../../src/chat/server/bot-workspace-reads'
import * as copyWorker from '../../src/chat/server/conversation-copy-worker'
import * as conversationDatabase from '../../src/chat/server/conversation-database'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const options = { policy: defaultPolicy, fixture: true }
const children: DatabaseSync[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const db of children.splice(0)) db.close()
})

async function runtime() {
  const h = await conversationHarness({
    messages: [
      {
        id: 'request',
        role: 'user',
        parts: [{ type: 'text', content: 'Original request' }],
      },
      {
        id: 'answer',
        role: 'assistant',
        parts: [
          { type: 'thinking', content: 'Private reasoning' },
          {
            type: 'tool-call',
            id: 'read',
            name: 'read_document',
            arguments: '{}',
            state: 'complete',
            output: { kind: 'stored-tool-result', resultId: 'previous-result' },
          },
          { type: 'text', content: 'The action outcome is unknown.' },
        ],
      },
    ],
    approvals: [
      {
        id: 'action',
        messageId: 'request',
        title: 'Update document',
        code: '',
        status: 'error',
        executionOutcome: 'unknown',
        result: 'Verify the effect before trying again.',
        resumeRequest: 'Must not transfer',
      },
    ],
    turnOutcomes: { request: { status: 'error' } },
  })
  type Entry = {
    c: Conversation
    local: DatabaseSync
    ctx: any
    settle(): Promise<void>
  }
  const entries = new Map<string, Entry>([
    [
      identity.conversationId,
      { c: h.c, local: h.local, ctx: h.ctx, settle: h.settle },
    ],
  ])
  let afterFirst: ((query: string) => Promise<void> | void) | undefined
  const authorizeCopy = copyWorker.getAuthorizedCopyOperation
  vi.spyOn(copyWorker, 'getAuthorizedCopyOperation').mockImplementation(
    async (...args) => {
      const result = await authorizeCopy(...args)
      await afterFirst?.('copy authorization')
      return result
    },
  )
  const lifecycle = conversationDatabase.readConversationLifecycle
  vi.spyOn(
    conversationDatabase,
    'readConversationLifecycle',
  ).mockImplementation(async (...args) => {
    const result = await lifecycle(...args)
    await afterFirst?.('bot authorization')
    return result
  })
  const create = (name: string) => {
    const local = new DatabaseSync(':memory:')
    children.push(local)
    const pending: Promise<unknown>[] = []
    const ctx = {
      id: { equals: (other: string) => other === name },
      storage: {
        sql: {
          exec(query: string, ...values: any[]) {
            const statement = local.prepare(query),
              args = values.map((value) =>
                value instanceof ArrayBuffer ? new Uint8Array(value) : value,
              )
            const rows = statement.columns().length
              ? statement.all(...args)
              : (statement.run(...args), [])
            return { toArray: () => rows }
          },
        },
        ...sqliteDoTransactions(local),
      },
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => pending.push(fn()),
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    }
    const entry: Entry = {
      local,
      ctx,
      c: new Conversation(ctx as any, h.env as any),
      settle: async () => {
        while (pending.length) await pending.shift()
      },
    }
    entries.set(name, entry)
    return entry
  }
  const conversations = Object.assign(h.env.CONVERSATIONS, {
    getByName: (name: string) => {
      const entry = entries.get(name) ?? create(name)
      return new Proxy(entry.c, {
        get:
          (_object, method: string) =>
          async (...args: unknown[]) => {
            await entry.settle()
            return (entry.c as any)[method](...args)
          },
      })
    },
  })
  h.env.GUM_FIXTURE_DELAY_MS = '0'
  await h.c.bindIdentity(identity)
  const source = () => entries.get(identity.conversationId)!
  await durableResultStore(source().ctx.storage, 'original-task').put(
    'previous-result',
    { text: 'Original tool result', confirmed: false },
  )
  const env = { ...h.env, CONVERSATIONS: conversations }
  const service = new ConversationRetries(env, 'w', identity.userId)
  const operationRow = async (condition: ReturnType<typeof eq>) => {
    const [value] = await sharedDb
      .select()
      .from(chatConversationCopies)
      .where(condition)
    if (!value) throw new Error('Expected copy operation')
    return {
      id: value.id,
      retry_id: value.retryId,
      workspace_id: value.workspaceId,
      user_id: value.userId,
      source_bot_id: value.sourceBotId,
      source_conversation_id: value.sourceConversationId,
      target_bot_id: value.targetBotId,
      target_conversation_id: value.targetConversationId,
      idempotency_key: value.idempotencyKey,
      request_digest: value.requestDigest,
      kind: z.enum(['duplicate', 'fork']).parse(value.kind),
      boundary_json: JSON.stringify(value.boundaryJson),
      name: value.name,
      purpose: value.purpose,
      parent_id: value.parentId,
      status: value.status,
      phase: value.phase,
      manifest_json:
        value.manifestJson === null ? null : JSON.stringify(value.manifestJson),
      next_page: value.nextPage,
      work_version: value.workVersion,
      error_code: value.errorCode,
      error_message: value.errorMessage,
      attempts: value.attempts,
      retry_at: value.retryAt,
      created_at: value.createdAt,
      updated_at: value.updatedAt,
      completed_at: value.completedAt,
    }
  }
  const copy = (attemptId: string) =>
    operationRow(eq(chatConversationCopies.retryId, attemptId))
  const row = async (attemptId: string) => {
    const [value] = await sharedDb
      .select()
      .from(chatConversationRetries)
      .where(eq(chatConversationRetries.id, attemptId))
    if (!value) throw new Error('Expected retry attempt')
    return { ...value, source_json: JSON.stringify(value.sourceJson) }
  }
  const operation = (operationId: string) =>
    operationRow(eq(chatConversationCopies.id, operationId))
  const start = () =>
    service.create(
      identity,
      { idempotencyKey: crypto.randomUUID(), messageId: 'request' },
      options,
    )
  const exportRequest = async (
    attemptId: string,
  ): Promise<CopyExportRequest> => {
    const operation = await copy(attemptId)
    return {
      ...identity,
      operationId: operation.id,
      kind: operation.kind,
      boundary: JSON.parse(operation.boundary_json),
      targetConversationId: operation.target_conversation_id,
    }
  }
  const reload = async () => {
    for (const entry of entries.values()) {
      await entry.settle()
      entry.c = new Conversation(entry.ctx, h.env as any)
      await entry.settle()
    }
  }
  const completeOperation = async (operationId: string) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const current = await operation(operationId)
      if (current.phase === 'done') {
        expect(current.status, JSON.stringify(current)).toBe('ready')
        return
      }
      for (const entry of [...entries.values()]) await entry.c.alarm()
      await reload()
    }
    throw new Error(
      'Copy did not complete: ' + JSON.stringify(await operation(operationId)),
    )
  }
  const completeCopy = async (attemptId: string) =>
    completeOperation((await copy(attemptId)).id)
  const copies = new ConversationCopies(env, 'w', identity.userId)
  const ordinaryCopy = async (
    scope: typeof identity,
    kind: 'fork' | 'duplicate',
    messageId?: string,
  ) => {
    const source = entries.get(scope.conversationId)!
    const boundary = await source.c.copyBoundary(messageId)
    if (!boundary.ok) throw new Error('Copy boundary unavailable')
    const created = await copies.create(
      scope.botId,
      {
        idempotencyKey: crypto.randomUUID(),
        kind,
        boundary: boundary.boundary,
      },
      scope.conversationId,
    )
    await completeOperation(created.operationId)
    return operation(created.operationId)
  }
  const input = async (
    attemptId: string,
    messageId: string,
  ): Promise<RunInput> => {
    const operation = await copy(attemptId)
    const bot = await readWorkspaceBot(
      'w',
      identity.userId,
      operation.target_bot_id,
    )
    return {
      messageId,
      retry: { attemptId, draftRevision: 2 },
      text: 'Revised request',
      bot,
      conversationId: operation.target_conversation_id,
      userId: '00000000-0000-4000-8000-000000000001',
      policy: defaultPolicy,
      recipes: [],
      fixture: true,
    }
  }
  return {
    ...h,
    entries,
    source,
    service,
    start,
    copy,
    copies,
    operation,
    ordinaryCopy,
    row,
    exportRequest,
    reload,
    completeCopy,
    completeOperation,
    input,
    hook: (value: typeof afterFirst) => {
      afterFirst = value
    },
  }
}

describe('durable retry attempt evidence', () => {
  it('loads the immutable server review and ignores caller-supplied retry evidence', async () => {
    const h = await runtime(),
      attempt = await h.start()
    const original = JSON.parse((await h.row(attempt.attemptId)).source_json)
    expect(
      JSON.parse(
        await h.source().c.captureRetrySourceJson(identity, 'request', options),
      ),
    ).toEqual({ ok: true, source: original })
    const forged = structuredClone(original)
    forged.request.text = 'Caller-injected request'
    forged.evidence.receipts[0].executionOutcome = 'succeeded'
    const result = await h.source().c.startCopyExport({
      ...(await h.exportRequest(attempt.attemptId)),
      retry: forged,
    })
    expect(['building', 'sealed']).toContain(result.status)
    const exported = JSON.parse(
      h.local
        .prepare('SELECT json FROM copy_exports WHERE id=?')
        .get((await h.copy(attempt.attemptId)).id)!.json as string,
    )
    expect(exported.request.retry).toEqual(original)
    await expect(
      h.db`UPDATE chat_conversation_retries SET source_json=${h.db.json(forged)} WHERE id=${attempt.attemptId}`,
    ).rejects.toThrow('immutable')
    await h.completeCopy(attempt.attemptId)
    const target = h.entries.get(
      (await h.copy(attempt.attemptId)).target_conversation_id,
    )!
    expect(
      importedRetrySource(
        target.ctx.storage.sql,
        (await h.copy(attempt.attemptId)).id,
      ),
    ).toEqual(original)
  })

  it.each(['running', 'pending', 'late receipt', 'reset'] as const)(
    'rejects a %s source change during final authorization before freeze',
    async (change) => {
      const h = await runtime(),
        attempt = await h.start()
      let checks = 0
      h.hook(async (query) => {
        if (query !== 'copy authorization' || ++checks !== 2) return
        h.hook(undefined)
        if (change === 'reset') await h.source().c.reset()
        else {
          const state = (h.source().c as any).state
          if (change === 'running') state.status = 'running'
          else if (change === 'pending')
            state.pendingTask = { requestId: 'continued-request' }
          else
            Object.assign(state.approvals[0], {
              status: 'done',
              executionOutcome: 'succeeded',
              result: 'A late receipt confirmed the effect.',
            })
        }
      })
      const result = await h
        .source()
        .c.startCopyExport(await h.exportRequest(attempt.attemptId))
      expect(result.status).toBe('failed')
      expect(checks).toBe(2)
      expect(
        h.local.prepare('SELECT count(*) AS n FROM copy_exports').get()!.n,
      ).toBe(0)
      ;(h.source().c as any).state.status = 'idle'
      ;(h.source().c as any).state.pendingTask = undefined
    },
  )

  it('keeps a published branch blocked until preparation is ready and retains inert effects in model context after reconstruction', async () => {
    const h = await runtime(),
      original = await h.source().c.snapshot(),
      attempt = await h.start()
    await h.completeCopy(attempt.attemptId)
    const copy = await h.copy(attempt.attemptId),
      target = h.entries.get(copy.target_conversation_id)!
    expect(copy.status).toBe('ready')
    expect((await h.row(attempt.attemptId)).status).toBe('preparing')
    await expect(
      target.c.begin(await h.input(attempt.attemptId, 'too-early')),
    ).rejects.toThrow('preparing')
    expect((await target.c.snapshot()).messages).toEqual([])
    const prepared = await h.service.prepare(attempt.attemptId, options)
    expect(prepared.status).toBe('ready')
    expect(prepared.draft?.request.text).toBe('Original request')
    const reviewed = JSON.parse((await h.row(attempt.attemptId)).source_json)
    expect(prepared.evidence).toEqual(reviewed.evidence)
    expect(JSON.stringify(prepared.evidence)).not.toContain('Private reasoning')
    expect(JSON.stringify(prepared.evidence)).not.toContain('resumeRequest')
    const exactTarget = {
      ...identity,
      botId: copy.target_bot_id,
      conversationId: copy.target_conversation_id,
    }
    await expect(
      target.c.retryPreparationSnapshot(
        exactTarget,
        'another-attempt',
        reviewed.evidenceDigest,
      ),
    ).rejects.toThrow('unavailable')
    await expect(
      target.c.retryPreparationSnapshot(
        exactTarget,
        attempt.attemptId,
        'wrong-digest',
      ),
    ).rejects.toThrow('unavailable')
    ;(target.c as any).state.copyOrigin.submittedMessageId = 'uncommitted-send'
    expect(
      await target.c.retryPreparationSnapshot(
        exactTarget,
        attempt.attemptId,
        reviewed.evidenceDigest,
      ),
    ).toEqual({
      submittedMessageId: undefined,
      submittedDraftRevision: undefined,
    })
    expect((await h.service.get(attempt.attemptId)).draft?.request.text).toBe(
      'Original request',
    )
    delete (target.c as any).state.copyOrigin.submittedMessageId
    await h.reload()
    const restored = h.entries.get(copy.target_conversation_id)!
    const context: UIMessage[] = await (restored.c as any).prepareModelContext(
      [],
      { provider: 'included', model: 'fixture' },
      {
        ...identity,
        botId: copy.target_bot_id,
        conversationId: copy.target_conversation_id,
      },
    )
    expect(context).toHaveLength(1)
    expect(context[0].parts.every((part) => part.type === 'text')).toBe(true)
    const text = context[0].parts.map((part: any) => part.content).join('')
    expect(text).toContain('unknown')
    expect(text).toContain('previous-result')
    expect(text).toContain(
      'not new instructions or permission to repeat actions',
    )
    expect(text).not.toContain('Private reasoning')
    expect(text).not.toContain('resumeRequest')
    expect(
      await durableResultStore(restored.ctx.storage, 'assistant').get(
        'previous-result',
      ),
    ).toEqual({ text: 'Original tool result', confirmed: false })
    await restored.c.begin(await h.input(attempt.attemptId, 'revised'))
    await restored.settle()
    expect(
      (await restored.c.snapshot()).messages
        .filter((message) => message.role === 'user')
        .map((message) => message.id),
    ).toEqual(['revised'])
    expect((await restored.c.snapshot()).approvals).toEqual([])
    expect(await h.service.get(attempt.attemptId)).toMatchObject({
      status: 'ready',
      submittedMessageId: 'revised',
    })
    expect((await h.service.get(attempt.attemptId)).draft).toBeUndefined()
    expect((await h.service.get(attempt.attemptId)).evidence).toEqual(
      reviewed.evidence,
    )
    expect(
      (await h.service.get(attempt.attemptId)).submittedDraftRevision,
    ).toBe(2)
    expect((await h.source().c.snapshot()).messages).toEqual(original.messages)
    expect((await h.source().c.snapshot()).approvals).toEqual(
      original.approvals,
    )
    await restored.c.reset()
    await h.reload()
    const reset = h.entries.get(copy.target_conversation_id)!
    expect(importedRetrySource(reset.ctx.storage.sql, copy.id)).toBeUndefined()
    expect((await reset.c.snapshot()).copyOrigin).toBeUndefined()
    expect(await h.service.get(attempt.attemptId)).toMatchObject({
      status: 'failed',
      error: { code: 'target_reset' },
      target: {
        botId: copy.target_bot_id,
        conversationId: copy.target_conversation_id,
      },
      submittedMessageId: 'revised',
      submittedDraftRevision: 2,
      evidence: reviewed.evidence,
    })
    expect((await h.service.get(attempt.attemptId)).draft).toBeUndefined()
    expect(await reset.c.sendReceipt('revised')).toEqual({ accepted: true })
    await reset.c.reset()
    expect(await h.service.get(attempt.attemptId)).toMatchObject({
      error: { code: 'target_reset' },
    })
    expect(
      await (reset.c as any).prepareModelContext(
        [],
        { provider: 'included', model: 'fixture' },
        {
          ...identity,
          botId: copy.target_bot_id,
          conversationId: copy.target_conversation_id,
        },
      ),
    ).toEqual([])
    await expect(
      reset.c.begin(await h.input(attempt.attemptId, 'after-reset')),
    ).rejects.toThrow('retry draft')
    await reset.c.begin({
      ...(await h.input(attempt.attemptId, 'after-reset')),
      retry: undefined,
    })
    await reset.settle()
    expect(
      (await reset.c.snapshot()).messages.some(
        (message) => message.id === 'after-reset',
      ),
    ).toBe(true)
  })

  it.each(['reset', 'membership revoked'] as const)(
    'rejects the request when the target is %s during input validation',
    async (change) => {
      const h = await runtime(),
        attempt = await h.start()
      await h.completeCopy(attempt.attemptId)
      await h.service.prepare(attempt.attemptId, options)
      const copy = await h.copy(attempt.attemptId),
        target = h.entries.get(copy.target_conversation_id)!,
        before = await target.c.snapshot(),
        validate = attachmentRequest.validateAttachmentRequest
      const intercepted = vi
        .spyOn(attachmentRequest, 'validateAttachmentRequest')
        .mockImplementationOnce(async (...args) => {
          await validate(...args)
          if (change === 'reset') await target.c.reset()
          else
            await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
        })
      await expect(
        target.c.begin(await h.input(attempt.attemptId, 'raced-request')),
      ).rejects.toThrow(
        change === 'reset' ? 'reset' : /access|available|found|membership/i,
      )
      expect(intercepted).toHaveBeenCalledOnce()
      const after = await target.c.snapshot()
      expect(after.messages).toEqual([])
      expect(after.queue?.items ?? []).toEqual([])
      expect(after.activeRun).toBeNull()
      expect(after.copyOrigin?.submittedMessageId).toBeUndefined()
      if (change === 'reset') {
        expect(after.transcriptEpoch).not.toBe(before.transcriptEpoch)
        expect(after.copyOrigin).toBeUndefined()
      } else {
        expect(after.copyOrigin).toEqual(before.copyOrigin)
        expect(
          importedRetrySource(target.ctx.storage.sql, copy.id),
        ).toBeDefined()
        await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w',${identity.userId},'owner')`
      }
      await target.settle()
    },
  )

  it('reports only an explicit committed reset as terminal before the first revised request', async () => {
    const h = await runtime(),
      attempt = await h.start()
    await h.completeCopy(attempt.attemptId)
    await h.service.prepare(attempt.attemptId, options)
    const copy = await h.copy(attempt.attemptId),
      target = h.entries.get(copy.target_conversation_id)!
    const persisted = target.local
      .prepare('SELECT json FROM state WHERE id=1')
      .get()!.json as string
    const corrupt = JSON.parse(persisted)
    delete corrupt.copyOrigin
    target.local
      .prepare('UPDATE state SET json=? WHERE id=1')
      .run(JSON.stringify(corrupt))
    await expect(h.service.get(attempt.attemptId)).rejects.toThrow(
      'unavailable',
    )
    target.local.prepare('UPDATE state SET json=? WHERE id=1').run(persisted)
    await target.c.reset()
    await h.reload()
    const view = await h.service.get(attempt.attemptId)
    expect(view).toMatchObject({
      status: 'failed',
      error: { code: 'target_reset' },
      target: {
        botId: copy.target_bot_id,
        conversationId: copy.target_conversation_id,
      },
    })
    expect(view.draft).toBeUndefined()
    expect(view.submittedMessageId).toBeUndefined()
    expect(view.submittedDraftRevision).toBeUndefined()
    expect(view.evidence).toBeDefined()
    expect(await h.service.prepare(attempt.attemptId, options)).toEqual(view)
    const reset = h.entries.get(copy.target_conversation_id)!
    expect(await reset.c.sendReceipt('never-sent')).toEqual({ accepted: false })
    await expect(
      reset.c.retryPreparationSnapshot(
        {
          ...identity,
          botId: copy.target_bot_id,
          conversationId: copy.target_conversation_id,
        },
        crypto.randomUUID(),
        'wrong',
      ),
    ).rejects.toThrow('unavailable')
  })

  it('consumes the prepared draft when the revised request is accepted into a paused queue', async () => {
    const h = await runtime(),
      attempt = await h.start()
    await h.completeCopy(attempt.attemptId)
    await h.service.prepare(attempt.attemptId, options)
    const copy = await h.copy(attempt.attemptId),
      target = h.entries.get(copy.target_conversation_id)!
    await target.c.updateQueue({ type: 'pause', version: 0 })
    expect(
      await target.c.begin(await h.input(attempt.attemptId, 'queued-revision')),
    ).toMatchObject({ queued: true })
    await target.settle()
    await h.reload()
    const restored = h.entries.get(copy.target_conversation_id)!
    expect((await restored.c.snapshot()).messages).toEqual([])
    expect(
      (await restored.c.snapshot()).queue?.items.map((item) => item.id),
    ).toEqual(['queued-revision'])
    const view = await h.service.get(attempt.attemptId)
    expect(view.submittedMessageId).toBe('queued-revision')
    expect(view.submittedDraftRevision).toBe(2)
    expect(view.draft).toBeUndefined()
    expect(importedRetrySource(restored.ctx.storage.sql, copy.id)).toBeDefined()
  })

  it('requires the exact first-send binding and accepts only the same bound receipt after admission', async () => {
    const h = await runtime(),
      attempt = await h.start()
    await h.completeCopy(attempt.attemptId)
    await h.service.prepare(attempt.attemptId, options)
    const copy = await h.copy(attempt.attemptId),
      target = h.entries.get(copy.target_conversation_id)!
    const input = await h.input(attempt.attemptId, 'bound-send')
    await expect(
      target.c.begin({ ...input, retry: undefined }),
    ).rejects.toThrow('prepared retry draft')
    await expect(
      target.c.begin({
        ...input,
        retry: { ...input.retry!, attemptId: crypto.randomUUID() },
      }),
    ).rejects.toThrow('retry draft')
    await expect(
      target.c.begin({
        ...input,
        retry: { ...input.retry!, draftRevision: -1 },
      }),
    ).rejects.toThrow()
    expect(await target.c.sendReceipt(input.messageId)).toEqual({
      accepted: false,
    })
    await target.c.updateQueue({ type: 'pause', version: 0 })
    expect(await target.c.begin(input)).toMatchObject({ queued: true })
    await target.settle()
    await h.reload()
    const restored = h.entries.get(copy.target_conversation_id)!
    expect(await restored.c.begin(input)).toEqual({ duplicate: true })
    expect(await restored.c.sendReceipt(input.messageId)).toEqual({
      accepted: true,
    })
    await expect(
      restored.c.begin({
        ...input,
        retry: { ...input.retry!, draftRevision: 3 },
      }),
    ).rejects.toThrow('retry draft')
    await expect(
      restored.c.begin({ ...input, messageId: 'another-bound-send' }),
    ).rejects.toThrow('retry draft')
    expect(
      await restored.c.begin({
        ...input,
        messageId: 'ordinary-followup',
        retry: undefined,
      }),
    ).toMatchObject({ queued: true })
    expect(
      (await restored.c.snapshot()).queue?.items.map((item) => item.id),
    ).toEqual(['bound-send', 'ordinary-followup'])
    const settings = restored.local
      .prepare('SELECT settings FROM queue_inputs WHERE id=?')
      .get(input.messageId)!.settings as string
    expect(JSON.parse(settings).retry).toEqual(input.retry)
    expect(
      (await h.service.get(attempt.attemptId)).submittedDraftRevision,
    ).toBe(2)
    await restored.settle()
  })

  it.each(['another message', 'another revision'] as const)(
    'rechecks the first-send binding if %s wins during input validation',
    async (change) => {
      const h = await runtime(),
        attempt = await h.start()
      await h.completeCopy(attempt.attemptId)
      await h.service.prepare(attempt.attemptId, options)
      const copy = await h.copy(attempt.attemptId),
        target = h.entries.get(copy.target_conversation_id)!
      await target.c.updateQueue({ type: 'pause', version: 0 })
      let release!: () => void, reached!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const validating = new Promise<void>((resolve) => {
        reached = resolve
      })
      const validate = attachmentRequest.validateAttachmentRequest
      vi.spyOn(
        attachmentRequest,
        'validateAttachmentRequest',
      ).mockImplementationOnce(async (...args) => {
        await validate(...args)
        reached()
        await gate
      })
      const input = await h.input(attempt.attemptId, 'first-candidate')
      const first = target.c.begin(input)
      await validating
      const winner =
        change === 'another message'
          ? { ...input, messageId: 'second-candidate' }
          : { ...input, retry: { ...input.retry!, draftRevision: 3 } }
      expect(await target.c.begin(winner)).toMatchObject({ queued: true })
      release()
      await expect(first).rejects.toThrow('retry draft')
      expect(
        (await target.c.snapshot()).queue?.items.map((item) => item.id),
      ).toEqual([winner.messageId])
      expect(await h.service.get(attempt.attemptId)).toMatchObject({
        submittedMessageId: winner.messageId,
        submittedDraftRevision: winner.retry!.draftRevision,
      })
      await target.settle()
    },
  )

  it.each(['queued', 'running'] as const)(
    'does not acknowledge speculative %s admission after a failed durable save',
    async (mode) => {
      const h = await runtime(),
        attempt = await h.start()
      await h.completeCopy(attempt.attemptId)
      await h.service.prepare(attempt.attemptId, options)
      const copy = await h.copy(attempt.attemptId),
        target = h.entries.get(copy.target_conversation_id)!
      if (mode === 'queued')
        await target.c.updateQueue({ type: 'pause', version: 0 })
      const execute = target.ctx.storage.sql.exec.bind(target.ctx.storage.sql)
      let failed = false
      vi.spyOn(target.ctx.storage.sql, 'exec').mockImplementation(
        (...args: unknown[]) => {
          if (
            !failed &&
            String(args[0]).startsWith('INSERT INTO state VALUES')
          ) {
            failed = true
            throw new Error('Admission commit failed')
          }
          return execute(...args)
        },
      )
      const input = await h.input(attempt.attemptId, 'recoverable-admission')
      await expect(target.c.begin(input)).rejects.toThrow(
        'Admission commit failed',
      )
      expect(await target.c.sendReceipt(input.messageId)).toEqual({
        accepted: false,
      })
      expect((await h.service.get(attempt.attemptId)).draft).toBeDefined()
      expect(
        (await target.c.snapshot()).copyOrigin?.submittedMessageId,
      ).toBeUndefined()
      expect((await target.c.snapshot()).messages).toEqual([])
      expect((await target.c.snapshot()).queue?.items ?? []).toEqual([])
      expect(await target.c.begin(input)).toMatchObject(
        mode === 'queued' ? { queued: true } : { runId: input.messageId },
      )
      expect(await target.c.sendReceipt(input.messageId)).toEqual({
        accepted: true,
      })
      expect((await h.service.get(attempt.attemptId)).submittedMessageId).toBe(
        input.messageId,
      )
      await target.settle()
    },
  )

  it('retains a flat action inventory through retry, ordinary fork, retry and duplicate after reconstruction', async () => {
    const h = await runtime(),
      firstAttempt = await h.start()
    await h.completeCopy(firstAttempt.attemptId)
    await h.service.prepare(firstAttempt.attemptId, options)
    const firstCopy = await h.copy(firstAttempt.attemptId),
      firstScope = {
        ...identity,
        botId: firstCopy.target_bot_id,
        conversationId: firstCopy.target_conversation_id,
      },
      firstReview = JSON.parse(
        (await h.row(firstAttempt.attemptId)).source_json,
      ),
      firstRecord = { id: firstCopy.id, source: retryTurnSource(firstReview) }
    let first = h.entries.get(firstScope.conversationId)!
    await first.c.begin(await h.input(firstAttempt.attemptId, 'revised'))
    await first.settle()
    const firstSnapshot = await first.c.snapshot(),
      lastMessage = firstSnapshot.messages.at(-1)!
    expect(firstSnapshot.approvals).toEqual([])
    expect(importedActionEvidence(first.ctx.storage.sql, firstCopy.id)).toEqual(
      [firstRecord],
    )
    h.source().local.exec('DELETE FROM task_result_chunks')

    const fork = await h.ordinaryCopy(firstScope, 'fork', lastMessage.id),
      forkScope = {
        ...identity,
        botId: fork.target_bot_id,
        conversationId: fork.target_conversation_id,
      }
    let forked = h.entries.get(forkScope.conversationId)!
    expect(fork.retry_id).toBeNull()
    expect(
      (await forked.c.snapshot()).copyOrigin?.retryAttemptId,
    ).toBeUndefined()
    expect((await forked.c.snapshot()).approvals).toEqual([])
    expect(importedRetrySource(forked.ctx.storage.sql, fork.id)).toBeUndefined()
    expect(importedActionEvidence(forked.ctx.storage.sql, fork.id)).toEqual([
      firstRecord,
    ])
    expect(JSON.parse(await forked.c.actionEvidenceJson(forkScope))).toEqual({
      operationId: fork.id,
      records: [firstRecord],
    })
    const ordinaryInput = {
      ...(await h.input(firstAttempt.attemptId, 'ordinary-followup')),
      bot: await readWorkspaceBot('w', identity.userId, forkScope.botId),
      conversationId: forkScope.conversationId,
      retry: undefined,
    }
    for (const mode of [
      { systemOne: true },
      { proposeToolsOnly: true },
      { policy: { ...defaultPolicy, allowChatModels: false } },
    ]) {
      await expect(
        forked.c.begin({ ...ordinaryInput, ...mode }),
      ).rejects.toMatchObject({ status: 422 })
      expect(await forked.c.sendReceipt(ordinaryInput.messageId)).toEqual({
        accepted: false,
      })
      expect((await forked.c.snapshot()).approvals).toEqual([])
      expect((await forked.c.snapshot()).queue?.items ?? []).toEqual([])
    }
    expect(await forked.c.begin(ordinaryInput)).toMatchObject({
      runId: ordinaryInput.messageId,
    })
    await forked.settle()
    first = h.entries.get(firstScope.conversationId)!
    first.local.exec('DELETE FROM task_result_chunks')

    const secondAttempt = await h.service.create(
      forkScope,
      { idempotencyKey: crypto.randomUUID(), messageId: 'revised' },
      options,
    )
    const secondReview = JSON.parse(
      (await h.row(secondAttempt.attemptId)).source_json,
    )
    expect(secondReview.inheritedEvidence).toEqual(
      actionEvidenceInventory([firstRecord]),
    )
    expect(secondReview.reviewDigest).toMatch(/^[A-Za-z0-9_-]{43}$/)
    await h.completeCopy(secondAttempt.attemptId)
    const prepared = await h.service.prepare(secondAttempt.attemptId, options)
    expect(prepared.status).toBe('ready')
    const secondCopy = await h.copy(secondAttempt.attemptId),
      secondScope = {
        ...identity,
        botId: secondCopy.target_bot_id,
        conversationId: secondCopy.target_conversation_id,
      },
      secondRecord = {
        id: secondCopy.id,
        source: retryTurnSource(secondReview),
      },
      expected = [firstRecord, secondRecord]
    const second = h.entries.get(secondScope.conversationId)!
    expect(
      importedActionEvidence(second.ctx.storage.sql, secondCopy.id),
    ).toEqual(expected)
    expect(JSON.parse(await second.c.actionEvidenceJson(secondScope))).toEqual({
      operationId: secondCopy.id,
      currentEvidenceId: secondCopy.id,
      records: expected,
    })
    await second.c.begin(
      await h.input(secondAttempt.attemptId, 'revised-again'),
    )
    await second.settle()
    forked = h.entries.get(forkScope.conversationId)!
    forked.local.exec('DELETE FROM task_result_chunks')

    const duplicate = await h.ordinaryCopy(secondScope, 'duplicate'),
      duplicateScope = {
        ...identity,
        botId: duplicate.target_bot_id,
        conversationId: duplicate.target_conversation_id,
      }
    for (const scope of [identity, firstScope, forkScope, secondScope]) {
      const ancestor = h.entries.get(scope.conversationId)!
      ancestor.local.exec('DELETE FROM task_result_chunks')
      ancestor.local.exec('DELETE FROM copy_import_records')
    }
    await h.reload()
    const restored = h.entries.get(duplicateScope.conversationId)!,
      snapshot = await restored.c.snapshot()
    expect(duplicate.retry_id).toBeNull()
    expect(snapshot.copyOrigin?.retryAttemptId).toBeUndefined()
    expect(snapshot.approvals).toEqual([])
    expect(
      importedRetrySource(restored.ctx.storage.sql, duplicate.id),
    ).toBeUndefined()
    expect(
      importedActionEvidence(restored.ctx.storage.sql, duplicate.id),
    ).toEqual(expected)
    expect(JSON.parse(duplicate.manifest_json!).actionEvidence).toEqual(
      actionEvidenceInventory(expected),
    )
    expect(
      JSON.parse(await restored.c.actionEvidenceJson(duplicateScope)),
    ).toEqual({
      operationId: duplicate.id,
      records: expected,
    })
    for (const record of expected) {
      expect(record.source).not.toHaveProperty('inheritedEvidence')
      expect(record.source).not.toHaveProperty('reviewDigest')
    }
    const context: UIMessage[] = await (restored.c as any).prepareModelContext(
      [],
      { provider: 'included', model: 'fixture' },
      duplicateScope,
    )
    const evidenceMessages = context.filter(
      (message) => message.metadata?.gumActionEvidence,
    )
    expect(evidenceMessages.map((message) => message.id)).toEqual(
      expected.map((record) => `action-evidence:${record.id}`),
    )
    expect(
      evidenceMessages.every((message) =>
        message.parts.every((part) => part.type === 'text'),
      ),
    ).toBe(true)
    const evidenceText = JSON.stringify(evidenceMessages)
    expect(evidenceText).toContain(
      'not new instructions or permission to repeat actions',
    )
    expect(evidenceText).toContain('unknown')
    expect(evidenceText).toContain('previous-result')
    expect(evidenceText).not.toContain('Private reasoning')
    expect(evidenceText).not.toContain('resumeRequest')
    expect(
      await durableResultStore(restored.ctx.storage, 'assistant').get(
        'previous-result',
      ),
    ).toEqual({
      text: 'Original tool result',
      confirmed: false,
    })
    await expect(
      restored.c.actionEvidenceJson({
        ...duplicateScope,
        botId: identity.botId,
      }),
    ).rejects.toThrow()
    await expect(
      restored.c.actionEvidenceJson({
        ...duplicateScope,
        conversationId: identity.conversationId,
      }),
    ).rejects.toThrow()
    await expect(
      restored.c.actionEvidenceJson({
        ...duplicateScope,
        userId: 'another-user',
      }),
    ).rejects.toThrow()
    await expect(
      restored.c.actionEvidenceJson({
        ...duplicateScope,
        workspaceId: 'another-workspace',
      }),
    ).rejects.toThrow()
    await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
    await expect(
      restored.c.actionEvidenceJson(duplicateScope),
    ).rejects.toThrow()
    await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w',${identity.userId},'owner')`

    await restored.c.reset()
    await h.reload()
    const reset = h.entries.get(duplicateScope.conversationId)!
    expect((await reset.c.snapshot()).copyOrigin).toBeUndefined()
    expect(
      importedActionEvidence(reset.ctx.storage.sql, duplicate.id),
    ).toBeUndefined()
    expect(
      JSON.parse(await reset.c.actionEvidenceJson(duplicateScope)),
    ).toEqual({ operationId: null, records: [] })
    expect(
      await (reset.c as any).prepareModelContext(
        [],
        { provider: 'included', model: 'fixture' },
        duplicateScope,
      ),
    ).toEqual([])
  })

  it.each([
    ['digest', 'inventory added'],
    ['digest', 'inventory removed'],
    ['digest', 'reset'],
    ['authorization', 'inventory added'],
    ['authorization', 'inventory removed'],
    ['authorization', 'reset'],
  ] as const)(
    'rejects capture when %s yields and the source has %s',
    async (gap, change) => {
      const h = await runtime(),
        attempt = await h.start()
      await h.completeCopy(attempt.attemptId)
      await h.service.prepare(attempt.attemptId, options)
      const copy = await h.copy(attempt.attemptId),
        scope = {
          ...identity,
          botId: copy.target_bot_id,
          conversationId: copy.target_conversation_id,
        },
        target = h.entries.get(scope.conversationId)!
      await target.c.begin(await h.input(attempt.attemptId, 'revised'))
      await target.settle()
      const before = await target.c.snapshot(),
        original = importedActionEvidence(target.ctx.storage.sql, copy.id)!
      let inventory: ActionEvidence[] = original,
        changed = false
      vi.spyOn(target.c as any, 'actionEvidence').mockImplementation(
        () => inventory,
      )
      const mutate = async () => {
        if (changed) return
        changed = true
        if (change === 'reset') await target.c.reset()
        else if (change === 'inventory added')
          inventory = [...original, { ...original[0], id: 'new-evidence' }]
        else inventory = []
      }
      if (gap === 'digest') {
        const digest = crypto.subtle.digest.bind(crypto.subtle)
        vi.spyOn(crypto.subtle, 'digest').mockImplementation(
          async (...args) => {
            await mutate()
            return digest(...args)
          },
        )
      } else {
        let checks = 0
        h.hook(async (query) => {
          if (query === 'bot authorization' && ++checks === 2) await mutate()
        })
      }
      expect(
        await target.c.captureRetrySource(scope, 'revised', options),
      ).toMatchObject({ ok: false, code: 'source_changed' })
      expect(changed).toBe(true)
      if (change !== 'reset')
        expect((await target.c.snapshot()).transcriptRevision).toBe(
          before.transcriptRevision,
        )
      expect(
        Number(
          (await h.db`SELECT count(*) AS n FROM chat_conversation_retries`)[0]
            .n,
        ),
      ).toBe(1)
      h.hook(undefined)
      await target.settle()
    },
  )

  it.each(['retry', 'ordinary fork', 'ordinary duplicate'] as const)(
    'rejects inherited inventory changes during final authorization of a %s export',
    async (kind) => {
      const h = await runtime(),
        first = await h.start()
      await h.completeCopy(first.attemptId)
      await h.service.prepare(first.attemptId, options)
      const firstCopy = await h.copy(first.attemptId),
        scope = {
          ...identity,
          botId: firstCopy.target_bot_id,
          conversationId: firstCopy.target_conversation_id,
        },
        target = h.entries.get(scope.conversationId)!
      await target.c.begin(await h.input(first.attemptId, 'revised'))
      await target.settle()
      let operation: Awaited<ReturnType<typeof h.operation>>
      if (kind === 'retry') {
        const next = await h.service.create(
          scope,
          { idempotencyKey: crypto.randomUUID(), messageId: 'revised' },
          options,
        )
        operation = await h.copy(next.attemptId)
      } else {
        const boundary = await target.c.copyBoundary(
          kind === 'ordinary fork' ? 'revised' : undefined,
        )
        if (!boundary.ok) throw new Error('Copy boundary unavailable')
        const copy = await h.copies.create(
          scope.botId,
          {
            idempotencyKey: crypto.randomUUID(),
            kind: kind === 'ordinary fork' ? 'fork' : 'duplicate',
            boundary: boundary.boundary,
          },
          scope.conversationId,
        )
        operation = await h.operation(copy.operationId)
      }
      const before = await target.c.snapshot(),
        original = importedActionEvidence(target.ctx.storage.sql, firstCopy.id)!
      let inventory = original,
        checks = 0
      vi.spyOn(target.c as any, 'actionEvidence').mockImplementation(
        () => inventory,
      )
      h.hook((query) => {
        if (query === 'copy authorization' && ++checks === 2) {
          inventory = [...original, { ...original[0], id: 'new-evidence' }]
          h.hook(undefined)
        }
      })
      const result = await target.c.startCopyExport({
        ...scope,
        operationId: operation.id,
        kind: operation.kind,
        boundary: JSON.parse(operation.boundary_json),
        targetConversationId: operation.target_conversation_id,
      })
      expect(result).toMatchObject({
        status: 'failed',
        error: { code: 'source_changed' },
      })
      expect(checks).toBe(2)
      expect((await target.c.snapshot()).transcriptRevision).toBe(
        before.transcriptRevision,
      )
      expect(
        target.local
          .prepare('SELECT count(*) AS n FROM copy_exports WHERE id=?')
          .get(operation.id)!.n,
      ).toBe(0)
    },
  )
})
