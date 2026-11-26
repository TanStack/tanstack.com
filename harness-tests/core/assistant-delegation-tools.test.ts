import { convertSchemaToJsonSchema } from '@tanstack/ai'
import { expect, it, vi } from 'vitest'
import {
  assistantDelegationTools,
  delegationCommandId,
} from '../../src/chat/server/assistant-delegation-tools'
import { buildAssistantInstructions } from '../../src/chat/server/assistant-instructions'
import { newAssistantTask } from '../../src/chat/core/assistant-task'

it('offers concrete schemas without model-controlled identity, model or permissions', () => {
  const tools = assistantDelegationTools({ execute: vi.fn() })
  for (const tool of tools) {
    const schema = convertSchemaToJsonSchema(tool.inputSchema!)
    if (!schema) throw new Error(`Tool ${tool.name} has no input schema`)
    expect(schema.type).toBe('object')
    for (const field of ['userId', 'taskId', 'model', 'approvals'])
      expect(Object.keys(schema.properties ?? {})).not.toContain(field)
  }
  const tool = tools[0]
  expect(() =>
    tool.execute!(
      { objective: 'x', context: '', userId: 'other' } as never,
      { toolCallId: 'call' } as any,
    ),
  ).toThrow()
})
it('keeps command identity stable per task and call, and rejects missing or stopped calls', async () => {
  expect(delegationCommandId('task', 'call')).toBe(
    delegationCommandId('task', 'call'),
  )
  expect(delegationCommandId('task', 'call')).not.toBe(
    delegationCommandId('next', 'call'),
  )
  const execute = vi.fn(async () => ({ status: 'pending' }))
  const tool = assistantDelegationTools({ execute })[0]
  const args = {
    objective: 'Read supplied notes',
    context: 'Only this evidence.',
  }
  expect(() => tool.execute!(args as never)).toThrow('no longer active')
  expect(() =>
    tool.execute!(
      args as never,
      { toolCallId: 'call', abortSignal: AbortSignal.abort() } as any,
    ),
  ).toThrow('no longer active')
  expect(execute).not.toHaveBeenCalled()
  await tool.execute!(args as never, { toolCallId: 'call' } as any)
  expect(execute).toHaveBeenCalledWith({ type: 'delegate', ...args }, 'call')
})
it('includes delegation guidance only with the actual tool enabled', () => {
  const bot = { name: 'delegate_task', purpose: 'delegate_task' }
  const task = newAssistantTask('Check my notes', 'request')
  expect(
    buildAssistantInstructions(bot, task, [], {
      enabledTools: [],
    }).manifest.sections.map((s) => s.id),
  ).not.toContain('capability.delegation')
  const real = buildAssistantInstructions(bot, task, [], {
    enabledTools: ['delegate_task'],
  })
  expect(real.manifest.sections.map((s) => s.id)).toContain(
    'capability.delegation',
  )
  expect(real.systemPrompts.join('\n')).toContain(
    'cannot be approved by another assistant',
  )
})

it('offers bounded history paging without model-controlled access scope', async () => {
  const execute = vi.fn(async () => ({ evidence: 'retained', items: [] }))
  const tool = assistantDelegationTools({ execute }).find(
    (tool) => tool.name === 'list_task_history',
  )!
  const context = { toolCallId: 'history-call' } as any
  await tool.execute!({} as never, context)
  expect(execute).toHaveBeenLastCalledWith(
    { type: 'history', limit: 10 },
    'history-call',
  )
  const beforeId = crypto.randomUUID()
  await tool.execute!({ beforeId, limit: 25 } as never, context)
  expect(execute).toHaveBeenLastCalledWith(
    { type: 'history', beforeId, limit: 25 },
    'history-call',
  )
  for (const input of [
    { limit: 26 },
    { beforeId: 'invented' },
    { userId: 'other' },
  ]) {
    expect(() => tool.execute!(input as never, context)).toThrow()
  }
  expect(() =>
    tool.execute!({} as never, {
      ...context,
      abortSignal: AbortSignal.abort(),
    }),
  ).toThrow('no longer active')
})
