import { convertSchemaToJsonSchema } from '@tanstack/ai'
import { describe, expect, it, vi } from 'vitest'
import {
  assistantWorkspaceCommandId,
  assistantWorkspaceTools,
} from '../../src/chat/server/assistant-workspace-tools'
import type { ExecutionRunOrigin } from '../../src/chat/core/execution-sessions'

const identity = {
  userId: 'u',
  workspaceId: 'w',
  botId: 'b',
  conversationId: 'c',
}
const binding = {
  sessionId: crypto.randomUUID(),
  runtimeId: crypto.randomUUID(),
  hostGeneration: 1,
}
const origin: ExecutionRunOrigin = {
  kind: 'run',
  runId: 'r',
  taskId: 't',
  messageId: 'm',
  taskGeneration: 1,
  modelPass: 1,
  toolCallId: 'call',
}
const context = { toolCallId: 'call', emitCustomEvent: () => {} }
function setup() {
  const execute = vi.fn(async () => ({ status: 'queued' }))
  const tools = assistantWorkspaceTools({ execute })
  return {
    execute,
    tools,
    tool: (name: string) => tools.find((tool) => tool.name === name)!,
  }
}

describe('assistant workspace tool boundary', () => {
  it('offers only named object schemas for reads and reviewed file/command requests', () => {
    const f = setup()
    expect(f.tools.map((tool) => tool.name)).toEqual([
      'workspace_read_file',
      'workspace_write_file',
      'workspace_run',
    ])
    for (const tool of f.tools) {
      const schema = convertSchemaToJsonSchema(tool.inputSchema!)
      if (!schema) throw new Error('Workspace tool has no input schema')
      expect(schema.type).toBe('object')
    }
  })
  it('uses the runtime schema before admission and resolves complete review arguments', async () => {
    const f = setup()
    await f.tool('workspace_run').execute!(
      { command: 'node', args: ['check.cjs'] } as never,
      context,
    )
    expect(f.execute).toHaveBeenCalledWith(
      {
        type: 'run',
        command: 'node',
        args: ['check.cjs'],
        cwd: '/project',
        timeoutMs: 30_000,
      },
      'call',
      undefined,
    )
    for (const path of [
      '/etc/passwd',
      '/project/../secret',
      '/project/a/../../b',
      '/project//x',
    ]) {
      expect(() =>
        f.tool('workspace_read_file').execute!({ path } as never, context),
      ).toThrow()
    }
    expect(() =>
      f.tool('workspace_write_file').execute!(
        { path: '/project/a', text: '界'.repeat(4000) } as never,
        context,
      ),
    ).toThrow()
    expect(f.execute).toHaveBeenCalledOnce()
  })
  it('rejects missing call identity and cancelled tool context before admission', () => {
    const f = setup()
    const read = f.tool('workspace_read_file')
    expect(() => read.execute!({ path: '/project/a' } as never)).toThrow(
      'no longer active',
    )
    expect(() =>
      read.execute!({ path: '/project/a' } as never, {
        ...context,
        abortSignal: AbortSignal.abort(),
      }),
    ).toThrow('no longer active')
    expect(f.execute).not.toHaveBeenCalled()
  })
  it('keeps one stable command ID across retries but separates every authority coordinate', () => {
    const id = assistantWorkspaceCommandId(identity, binding, origin)
    expect(id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    )
    expect(
      assistantWorkspaceCommandId(
        { ...identity },
        { ...binding },
        { ...origin },
      ),
    ).toBe(id)
    for (const key of Object.keys(identity))
      expect(
        assistantWorkspaceCommandId(
          { ...identity, [key]: 'different' },
          binding,
          origin,
        ),
      ).not.toBe(id)
    for (const key of ['sessionId', 'runtimeId'])
      expect(
        assistantWorkspaceCommandId(
          identity,
          { ...binding, [key]: crypto.randomUUID() },
          origin,
        ),
      ).not.toBe(id)
    expect(
      assistantWorkspaceCommandId(
        identity,
        { ...binding, hostGeneration: 2 },
        origin,
      ),
    ).not.toBe(id)
    for (const key of ['runId', 'taskId', 'messageId', 'toolCallId'])
      expect(
        assistantWorkspaceCommandId(identity, binding, {
          ...origin,
          [key]: 'different',
        }),
      ).not.toBe(id)
    for (const key of ['taskGeneration', 'modelPass'])
      expect(
        assistantWorkspaceCommandId(identity, binding, { ...origin, [key]: 2 }),
      ).not.toBe(id)
  })
})
