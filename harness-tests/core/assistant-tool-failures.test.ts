import { chat, maxIterations, toolDefinition } from '@tanstack/ai'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  assistantLimits,
  checkAssistantCall,
  newAssistantTask,
  type AssistantTask,
} from '../../src/chat/core/assistant-task'
import { observeAssistantToolProgress } from '../../src/chat/server/assistant-progress'
import { assistantToolFailureMiddleware } from '../../src/chat/server/assistant-tool-failures'

const scope = { workspaceId: 'w', userId: 'u', conversationId: 'c' }
type Step = { name?: string; args: string } | undefined

async function runPlan(options: {
  task?: AssistantTask
  plan: (pass: number) => Step
  limit?: number
  reserveFailure?: (id: string) => Promise<void>
}) {
  const task = options.task ?? newAssistantTask('Inspect the record', 'm')
  let passes = 0
  let reason: string | undefined
  let persisted: string | undefined
  const execute = vi.fn(async ({ value }: { value: string }) => {
    if (value === 'throw') throw new Error('The record is unavailable.')
    return { value }
  })
  const before = vi.fn()
  const after = vi.fn()
  const save = vi.fn(async () => {
    persisted = JSON.stringify(task)
  })
  const adapter: any = {
    kind: 'text',
    name: 'scripted',
    model: 'synthetic',
    async *chatStream() {
      const pass = passes++
      const step = options.plan(pass)
      const id = 'call-' + pass
      if (step) {
        yield {
          type: 'TOOL_CALL_START',
          toolCallId: id,
          toolCallName: step.name ?? 'inspect_record',
          parentMessageId: 'message-' + pass,
        }
        yield {
          type: 'TOOL_CALL_ARGS',
          toolCallId: id,
          delta: step.args,
        }
        yield { type: 'TOOL_CALL_END', toolCallId: id }
      }
      yield {
        type: 'RUN_FINISHED',
        threadId: 'thread',
        runId: 'run-' + pass,
        finishReason: step ? 'tool_calls' : 'stop',
      }
    },
  }
  const args = new Map<string, unknown>()
  for await (const _chunk of chat({
    adapter,
    tools: [
      toolDefinition({
        name: 'inspect_record',
        description: 'Inspect a record',
        inputSchema: z.object({ value: z.string() }),
      }).server(execute),
    ],
    messages: [{ role: 'user', content: task.objective }],
    agentLoopStrategy: maxIterations(options.limit ?? 12),
    middleware: [
      {
        name: 'normal-execution-accounting',
        onBeforeToolCall: (_ctx, call) => {
          before()
          args.set(call.toolCallId, call.args)
          const limit = checkAssistantCall(task, call.toolName, call.args)
          if (limit) return { type: 'abort', reason: limit }
        },
        onAfterToolCall: async (_ctx, call) => {
          after()
          if (!call.ok) task.repairs++
          reason = await observeAssistantToolProgress(task, {
            scope,
            name: call.toolName,
            args: args.get(call.toolCallId),
            ok: call.ok,
            result: call.ok
              ? call.result
              : { error: (call.error as Error).message },
          })
        },
        onShouldContinue: () => (reason ? false : undefined),
      },
      assistantToolFailureMiddleware({
        reserveFailure: options.reserveFailure,
        task,
        scope,
        stop: (value) => {
          reason = value
        },
        save,
      }),
    ],
  })) {
    // Consume the real SDK loop, including validation and middleware ordering.
  }
  return { task, passes, reason, persisted, execute, before, after, save }
}

it.each([
  ['schema validation', { args: '{"private":"PRIVATE_ARGUMENT"}' }],
  ['JSON parsing', { args: '{"private":"PRIVATE_ARGUMENT"' }],
  [
    'unknown tool',
    { name: 'unknown_record_tool', args: '{"private":"PRIVATE_ARGUMENT"}' },
  ],
] as const)(
  'stops repeated %s failures that bypass both execution hooks',
  async (_name, step) => {
    const result = await runPlan({ plan: () => step })
    expect(result.passes).toBe(4)
    expect(result.before).not.toHaveBeenCalled()
    expect(result.after).not.toHaveBeenCalled()
    expect(result.execute).not.toHaveBeenCalled()
    expect(result.task.toolCalls).toBe(4)
    expect(result.task.repairs).toBe(4)
    expect(result.task.progress?.revision).toBe(0)
    expect(result.task.progress?.entries).toHaveLength(1)
    expect(result.reason).toContain('no new evidence')
    expect(result.save).toHaveBeenCalledTimes(4)
    expect(result.persisted).not.toContain('PRIVATE_ARGUMENT')
    expect(JSON.parse(result.persisted!).progress).toEqual(result.task.progress)
  },
)

it('keeps identical validation failures stopped across task reconstruction and argument key order changes', async () => {
  const first = await runPlan({
    limit: 2,
    plan: () => ({ args: '{"other":true,"private":"PRIVATE_ARGUMENT"}' }),
  })
  expect(first.reason).toBeUndefined()
  const second = await runPlan({
    task: JSON.parse(first.persisted!),
    plan: () => ({ args: '{ "private": "PRIVATE_ARGUMENT", "other": true }' }),
  })
  expect(second.passes).toBe(2)
  expect(second.task.toolCalls).toBe(4)
  expect(second.task.repairs).toBe(4)
  expect(second.reason).toContain('no new evidence')
})

it('lets corrected arguments execute and finish, counting the successful call once', async () => {
  const result = await runPlan({
    plan: (pass) =>
      pass === 0
        ? { args: '{"wrong":"PRIVATE_ARGUMENT"}' }
        : pass === 1
          ? { args: '{"value":"correct"}' }
          : undefined,
  })
  expect(result.passes).toBe(3)
  expect(result.reason).toBeUndefined()
  expect(result.task.toolCalls).toBe(2)
  expect(result.task.repairs).toBe(1)
  expect(result.task.progress?.revision).toBe(1)
  expect(result.execute).toHaveBeenCalledTimes(1)
  expect(result.after).toHaveBeenCalledTimes(1)
  expect(result.save).toHaveBeenCalledTimes(1)
})

it('leaves executed failures to normal accounting without counting them twice', async () => {
  const result = await runPlan({ plan: () => ({ args: '{"value":"throw"}' }) })
  expect(result.passes).toBe(4)
  expect(result.execute).toHaveBeenCalledTimes(4)
  expect(result.task.toolCalls).toBe(4)
  expect(result.task.repairs).toBe(4)
  expect(result.reason).toContain('no new evidence')
  expect(result.save).not.toHaveBeenCalled()
})

it('applies the repair budget even when every invalid attempt uses different arguments', async () => {
  const result = await runPlan({
    plan: (pass) => ({ args: JSON.stringify({ wrong: pass }) }),
  })
  expect(result.passes).toBe(assistantLimits.repairs)
  expect(result.task.repairs).toBe(assistantLimits.repairs)
  expect(result.task.toolCalls).toBe(assistantLimits.repairs)
  expect(result.reason).toContain('several tool errors')
})

it('applies the remaining tool budget to rejected input before another model pass', async () => {
  const task = newAssistantTask('Inspect the record', 'm')
  task.toolCalls = assistantLimits.toolCalls - 1
  const result = await runPlan({ task, plan: () => ({ args: '{}' }) })
  expect(result.passes).toBe(1)
  expect(result.task.toolCalls).toBe(assistantLimits.toolCalls)
  expect(result.task.repairs).toBe(1)
  expect(result.reason).toContain('tool limit')
})

it('reserves rejected calls against the shared allowance before another model pass', async () => {
  const reserveFailure = vi.fn(async (_id: string) => {
    throw new Error('Synthetic exhausted shared allowance')
  })
  const result = await runPlan({ plan: () => ({ args: '{}' }), reserveFailure })
  expect(reserveFailure).toHaveBeenCalledExactlyOnceWith('call-0')
  expect(result.passes).toBe(1)
  expect(result.execute).not.toHaveBeenCalled()
  expect(result.reason).toContain('shared operation limit')
  expect(result.task.toolCalls).toBe(0)
  expect(result.task.repairs).toBe(0)
})
it('does not reserve an executed failure a second time through the fallback hook', async () => {
  const reserveFailure = vi.fn(async (_id: string) => {})
  await runPlan({ plan: () => ({ args: '{"value":"throw"}' }), reserveFailure })
  expect(reserveFailure).not.toHaveBeenCalled()
})
