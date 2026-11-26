import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ loaded: [], calls: [], initialized: [] }))
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(ctx, env) {
      this.ctx = ctx
      this.env = env
    }
  },
  WorkflowEntrypoint: class {
    constructor(ctx, env) {
      this.ctx = ctx
      this.env = env
    }
  },
}))
vi.mock('~/chat/server/conversation', () => {
  state.loaded.push('conversation')
  return {
    Conversation: class {
      constructor(ctx, env) {
        state.initialized.push([ctx, env])
        ctx.blockConcurrencyWhile(async () => {
          state.initialized.push('storage ready')
        })
      }
      begin(...args) {
        state.calls.push(args)
        return 'started'
      }
      alarm() {
        return 'alarm complete'
      }
    },
  }
})
vi.mock('~/chat/server/workspace-sync-object', () => {
  state.loaded.push('workspace')
  return {
    WorkspaceSync: class {
      snapshot(...args) {
        state.calls.push(args)
        return 'snapshot'
      }
    },
  }
})
vi.mock('@durable-streams/server-cloudflare', () => {
  state.loaded.push('streams')
  return {
    StreamObject: class {
      fetch(request) {
        return new Response(request.url)
      }
      forkAcquire(...args) {
        state.calls.push(args)
        return { ok: true }
      }
    },
  }
})
vi.mock('~/chat/server/workflow-driver', () => {
  state.loaded.push('workflow')
  return {
    TanChatWorkflow: class {
      constructor(ctx, env) {
        state.initialized.push([ctx, env])
      }
      run(...args) {
        state.calls.push(args)
        return 'completed'
      }
    },
  }
})

it('loads implementations on object creation and preserves arguments, results, and initialization', async () => {
  const entries = await import('~/chat/server/entries')
  expect(state.loaded).toEqual([])
  const pending = []
  const ctx = {
    blockConcurrencyWhile: (work) => {
      const task = work()
      pending.push(task)
      return task
    },
  }
  const env = { marker: 'same environment' }
  const conversation = new entries.Conversation(ctx, env)
  await Promise.all(pending)
  expect(state.loaded).toEqual(['conversation'])
  expect(state.initialized).toEqual([[ctx, env], 'storage ready'])
  const input = { messageId: 'message' }
  expect(await conversation.begin(input)).toBe('started')
  expect(state.calls.at(-1)).toEqual([input])
  expect(await conversation.alarm()).toBe('alarm complete')

  const workspace = new entries.WorkspaceSync(ctx, env)
  await Promise.all(pending)
  expect(await workspace.snapshot('workspace', 'user')).toBe('snapshot')
  expect(state.calls.at(-1)).toEqual(['workspace', 'user'])
  const stream = new entries.StreamObject(ctx, env)
  await Promise.all(pending)
  const request = new Request('https://example.com/stream')
  expect(await (await stream.fetch(request)).text()).toBe(request.url)
  expect(await stream.forkAcquire({ edgeId: 'edge' })).toEqual({ ok: true })
  const workflow = new entries.TanChatWorkflow(ctx, env)
  expect(state.loaded).toEqual(['conversation', 'workspace', 'streams'])
  const event = { payload: {} },
    step = {}
  expect(await workflow.run(event, step)).toBe('completed')
  expect(state.calls.at(-1)).toEqual([event, step])
  expect(state.loaded).toEqual([
    'conversation',
    'workspace',
    'streams',
    'workflow',
  ])
})
