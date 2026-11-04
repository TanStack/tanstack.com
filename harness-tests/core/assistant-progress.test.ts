import { describe, expect, it } from 'vitest'
import {
  newAssistantTask,
  checkAssistantCall,
} from '../../src/chat/core/assistant-task'
import {
  observeAssistantToolProgress as observe,
  observeAssistantApprovalProgress as approval,
} from '../../src/chat/server/assistant-progress'
const scope = { workspaceId: 'w', userId: 'u', conversationId: 'c' }
const file = {
  id: 'file',
  botId: 'b',
  mediaType: 'text/plain',
  sha256: 'hash',
  name: 'a.txt',
  state: 'ready',
  source: 'assistant',
  size: 14,
}
const saved = { ok: true, file }
const call = (
  task: ReturnType<typeof newAssistantTask>,
  name: string,
  result: unknown,
  args: unknown = {},
) => observe(task, { scope, name, result, args, ok: true })
describe('durable outcome progress', () => {
  it('counts a copied file once without treating publication retries as fresh evidence', async () => {
    const task = newAssistantTask('copy file', 'm')
    expect(
      await call(
        task,
        'copy_file',
        { ...saved, delivery: { status: 'pending' } },
        { sourceFileId: 'source', name: 'a.txt' },
      ),
    ).toBeUndefined()
    expect(task.progress!.revision).toBe(1)
    for (let i = 0; i < 2; i++)
      expect(
        await call(
          task,
          'copy_file',
          { ...saved, outcome: 'New wording ' + i },
          { sourceFileId: 'source', name: 'a.txt' },
        ),
      ).toBeUndefined()
    expect(
      await call(task, 'copy_file', saved, {
        sourceFileId: 'source',
        name: 'a.txt',
      }),
    ).toContain('no new evidence')
    expect(task.progress!.revision).toBe(1)
  })
  it('stops interleaved unchanged save/read/list cycles, even after reconstruction', async () => {
    let task = newAssistantTask('make file', 'm')
    let reason: string | undefined
    for (let i = 0; i < 5 && !reason; i++) {
      reason = await call(
        task,
        'save_file',
        { ...saved, delivery: { status: i ? 'confirmed' : 'pending' } },
        { content: 'PRIVATE_BYTES' },
      )
      if (!reason)
        reason = await call(task, 'read_file', {
          ...saved,
          text: 'PRIVATE_BYTES',
          offset: 0,
          totalChars: 13,
        })
      if (!reason)
        reason = await call(task, 'list_files', {
          ok: true,
          files: [{ ...file, createdAt: i, viewUrl: 'opaque' + i }],
        })
      task = JSON.parse(JSON.stringify(task))
    }
    expect(reason).toContain('no new evidence')
    expect(JSON.stringify(task.progress)).not.toContain('PRIVATE_BYTES')
    expect(JSON.stringify(task.progress)).not.toContain('opaque')
  })
  it('observes changed fourth reads and confirmed mutations without pre-call suppression', async () => {
    const task = newAssistantTask('read', 'm')
    for (let i = 0; i < 3; i++) {
      expect(checkAssistantCall(task, 'external', {})).toBeUndefined()
      expect(await call(task, 'external', { value: 1 })).toBeUndefined()
    }
    expect(checkAssistantCall(task, 'external', {})).toBeUndefined()
    expect(await call(task, 'external', { value: 2 })).toBeUndefined()
    expect(
      await approval(task, {
        scope,
        actionIdentity: { server: 's', tool: 'write', args: { value: 3 } },
        outcome: 'succeeded',
        result: { value: 3 },
      }),
    ).toBeUndefined()
    expect(await call(task, 'external', { value: 1 })).toBeUndefined()
    expect(task.progress?.revision).toBe(3)
  })
  it('does not call an A/B/A cycle new evidence or let identical errors reset it', async () => {
    const task = newAssistantTask('read', 'm')
    await call(task, 'external', { value: 'A' })
    await call(task, 'external', { value: 'B' })
    await call(task, 'external', { value: 'A' })
    const revision = task.progress!.revision
    await call(task, 'read_skill', { ok: false, error: 'same failure' })
    await call(task, 'external', { value: 'B' })
    await call(task, 'external', { value: 'A' })
    expect(task.progress!.revision).toBe(revision)
    expect(await call(task, 'external', { value: 'A' })).toContain(
      'no new evidence',
    )
  })
  it('permits corrected arguments, new resource pages and genuinely changing external fields', async () => {
    const task = newAssistantTask('read', 'm')
    await call(task, 'tool', { status: 'invalid_arguments' }, { wrong: true })
    await call(
      task,
      'tool',
      { status: 'succeeded', value: 1 },
      { correct: true },
    )
    for (let offset = 0; offset < 5; offset++)
      expect(
        await call(
          task,
          'read_plugin_file',
          {
            ok: true,
            installationId: 'p',
            version: 1,
            path: 'a',
            digest: 'd',
            text: String(offset),
          },
          { offset },
        ),
      ).toBeUndefined()
    for (let timestamp = 0; timestamp < 5; timestamp++)
      expect(
        await call(task, 'external', { timestamp, value: 1 }),
      ).toBeUndefined()
    expect(task.progress!.revision).toBe(11)
  })
  it('keeps failed, rejected and unknown approvals non-progressing, using stable action identity', async () => {
    const task = newAssistantTask('act', 'm')
    for (const outcome of ['failed', 'unknown', 'rejected'] as const)
      await approval(task, {
        scope,
        actionIdentity: { tool: 'act' },
        outcome,
        result: { error: 'same' },
      })
    expect(task.progress!.revision).toBe(0)
    for (let i = 0; i < 2; i++)
      expect(
        await approval(task, {
          scope,
          actionIdentity: { tool: 'act' },
          outcome: 'unknown',
          result: { error: 'same' },
        }),
      ).toBeUndefined()
    expect(
      await approval(task, {
        scope,
        actionIdentity: { tool: 'act' },
        outcome: 'unknown',
        result: { error: 'same' },
      }),
    ).toContain('no new evidence')
  })
  it('ignores proposal identities and unresolved stored wrappers and bounds durable records', async () => {
    const task = newAssistantTask('read', 'm')
    await call(task, 'call_connected_tool', {
      status: 'awaiting_user_approval',
      approvalId: 'new',
    })
    await call(task, 'external', {
      kind: 'stored-tool-result',
      resultId: 'new',
    })
    expect(task.progress).toBeUndefined()
    for (let i = 0; i < 96; i++)
      expect(await call(task, 'external', { value: i })).toBeUndefined()
    expect(await call(task, 'external', { value: 97 })).toContain(
      'observation limit',
    )
    expect(task.progress!.entries).toHaveLength(96)
    expect(JSON.stringify(task.progress).length).toBeLessThan(15000)
  })
  it('repeated presentations and loaded skill versions do not acquire new progress', async () => {
    const task = newAssistantTask('show', 'm')
    for (let i = 0; i < 3; i++)
      expect(
        await call(task, 'present_file', saved, { id: file.id }),
      ).toBeUndefined()
    expect(await call(task, 'present_file', saved, { id: file.id })).toContain(
      'no new evidence',
    )
    const skill = newAssistantTask('skill', 'n')
    for (let i = 0; i < 3; i++)
      await call(skill, 'read_skill', {
        ok: true,
        id: 's',
        version: 1,
        document: { instructions: 'PRIVATE' },
      })
    expect(
      await call(skill, 'read_skill', {
        ok: true,
        id: 's',
        version: 1,
        document: { instructions: 'PRIVATE' },
      }),
    ).toContain('no new evidence')
  })
})

it('preserves unfamiliar skill/resource fields and ignores waiting allocation IDs', async () => {
  const task = newAssistantTask('inspect', 'm')
  for (let i = 0; i < 4; i++) {
    expect(
      await call(task, 'wait_for_user', {
        status: 'awaiting_user_step',
        taskId: String(i),
      }),
    ).toBeUndefined()
    expect(
      await call(task, 'call_connected_tool', {
        status: 'awaiting_user_approval',
        approvalId: String(i),
      }),
    ).toBeUndefined()
  }
  expect(task.progress).toBeUndefined()
  for (let i = 0; i < 4; i++) {
    expect(
      await call(task, 'read_skill', {
        ok: true,
        unexpectedDocument: String(i),
      }),
    ).toBeUndefined()
    expect(
      await call(task, 'read_plugin_file', {
        ok: true,
        installationId: 'p',
        version: 1,
        path: 'a',
        digest: 'd',
        text: 'same',
        futureMeaningfulField: i,
      }),
    ).toBeUndefined()
  }
  expect(task.progress!.revision).toBe(8)
})

it('counts distinct confirmed effect receipts even when responses match, never failed or ambiguous receipts', async () => {
  const task = newAssistantTask('increment', 'm')
  for (let i = 0; i < 4; i++)
    expect(
      await approval(task, {
        scope,
        actionIdentity: { tool: 'increment' },
        outcome: 'succeeded',
        confirmedEffect: { receiptId: String(i) },
        result: { ok: true },
      }),
    ).toBeUndefined()
  expect(task.progress!.revision).toBe(4)
  for (let i = 0; i < 4; i++)
    await approval(task, {
      scope,
      actionIdentity: { tool: 'increment' },
      outcome: 'unknown',
      confirmedEffect: { receiptId: 'unknown' + i },
      result: { ok: true },
    })
  expect(task.progress!.revision).toBe(4)
  expect(
    await approval(task, {
      scope,
      actionIdentity: { tool: 'increment' },
      outcome: 'succeeded',
      confirmedEffect: { receiptId: '3' },
      result: { ok: true },
    }),
  ).toBeUndefined()
  expect(task.progress!.revision).toBe(4)
})

it('stops a real TanStack loop through post-call hooks after serializing and resuming its task', async () => {
  const { chat, maxIterations, toolDefinition } = await import('@tanstack/ai')
  const { z } = await import('zod')
  let task = newAssistantTask('save and inspect', 'm')
  task.recentCalls = [{ key: 'PRIVATE_OLD_CONTENT', revision: 0 }]
  let passes = 0
  let reason: string | undefined
  let persisted = ''
  const args = new Map<string, unknown>()
  const adapter: any = {
    kind: 'text',
    name: 'scripted',
    model: 'synthetic',
    async *chatStream() {
      const pass = passes++,
        id = 'call-' + pass,
        name = pass % 2 === 0 ? 'save_file' : 'read_file'
      yield {
        type: 'TOOL_CALL_START',
        toolCallId: id,
        toolCallName: name,
        parentMessageId: 'message-' + pass,
      }
      yield { type: 'TOOL_CALL_ARGS', toolCallId: id, delta: '{}' }
      yield { type: 'TOOL_CALL_END', toolCallId: id }
      yield {
        type: 'RUN_FINISHED',
        threadId: 'thread',
        runId: 'run-' + pass,
        finishReason: 'tool_calls',
      }
    },
  }
  const tools = ['save_file', 'read_file'].map((name) =>
    toolDefinition({
      name,
      description: 'Synthetic native outcome',
      inputSchema: z.object({}),
    }).server(async () =>
      name === 'save_file'
        ? saved
        : { ...saved, text: 'PRIVATE_BYTES', offset: 0, totalChars: 13 },
    ),
  )
  async function run(limit: number) {
    for await (const _chunk of chat({
      adapter,
      tools,
      messages: [{ role: 'user', content: 'Continue the task' }],
      agentLoopStrategy: maxIterations(limit),
      middleware: [
        {
          name: 'durable-progress-test',
          onBeforeToolCall: (_ctx, call) => {
            args.set(call.toolCallId, call.args)
            const stop = checkAssistantCall(task, call.toolName, call.args)
            if (stop) return { type: 'abort', reason: stop }
          },
          onAfterToolCall: async (_ctx, call) => {
            reason = await observe(task, {
              scope,
              name: call.toolName,
              args: args.get(call.toolCallId),
              ok: call.ok,
              result: call.result,
            })
            persisted = JSON.stringify(task)
          },
          onShouldContinue: () => (reason ? false : undefined),
        },
      ],
    })) {
      /* Actual SDK runs the hooks and controls further adapter calls. */
    }
  }
  await run(2)
  expect(passes).toBe(2)
  expect(reason).toBeUndefined()
  expect(persisted).not.toContain('PRIVATE_')
  task = JSON.parse(persisted)
  await run(12)
  expect(passes).toBe(7)
  expect(task.toolCalls).toBe(7)
  expect(reason).toContain('no new evidence')
  expect(JSON.parse(persisted).progress).toEqual(task.progress)
})
