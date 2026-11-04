import { expect, it } from 'vitest'
import {
  runSystemOneTask,
  type TaskDependencies,
} from '../../src/chat/server/system-one-loop'
import type { CatalogEntry } from '../../src/chat/server/mcp-catalog'
const entry: CatalogEntry = {
  id: 'test',
  name: 'test',
  title: 'Test',
  kind: 'tool',
  serverId: 'fixture',
  serverLabel: 'Fixture',
  description: 'Operation',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
    additionalProperties: false,
  },
  target: { method: 'tools/call', name: 'test' },
}
const defaults = (): TaskDependencies => ({
  select: async (state) => ({
    decision: state.observations.length
      ? { type: 'done' }
      : { type: 'tool', id: 'test' },
  }),
  bind: async () => ({ status: 'ready', arguments: { id: 'A' } }),
  authorize: async () => true,
  invoke: async () => ({ ok: true, value: { updated: true } }),
})
const run = (dependencies: TaskDependencies) =>
  runSystemOneTask({
    request: 'Perform the operation',
    entries: [entry],
    signal: new AbortController().signal,
    dependencies,
  })
it('records actual results and requires successful evidence before done', async () => {
  const result = await run(defaults())
  expect(result.status).toBe('done')
  expect(result.calls).toBe(1)
  expect(result.state.observations[0].value).toEqual({ updated: true })
  expect(result.state.observations[0].source).toEqual({
    serverId: 'fixture',
    serverLabel: 'Fixture',
    kind: 'tool',
  })
  const deps = defaults()
  deps.select = async () => ({ decision: { type: 'done' } })
  expect((await run(deps)).status).toBe('no-progress')
})
it('does not invoke when host policy denies or arguments violate the schema', async () => {
  let calls = 0
  const deps = defaults()
  deps.invoke = async () => {
    calls++
    return { ok: true, value: null }
  }
  deps.authorize = async () => false
  expect((await run(deps)).status).toBe('denied')
  expect(calls).toBe(0)
  deps.authorize = async () => true
  deps.bind = async () => ({ status: 'ready', arguments: { id: 42 } })
  await expect(run(deps)).rejects.toThrow('input contract')
  expect(calls).toBe(0)
})
it('does not replay an identical action or retry an uncertain outcome', async () => {
  let calls = 0
  const deps = defaults()
  deps.select = async () => ({ decision: { type: 'tool', id: 'test' } })
  deps.invoke = async () => {
    calls++
    return { ok: true, value: {} }
  }
  expect((await run(deps)).status).toBe('no-progress')
  expect(calls).toBe(1)
  calls = 0
  deps.invoke = async () => {
    calls++
    throw new Error('Transport disconnected after possible mutation')
  }
  expect((await run(deps)).status).toBe('unknown-outcome')
  expect(calls).toBe(1)
})

it.each([true, false])(
  'requires fresh host authorization after refining a repeated call (allowed=%s)',
  async (allowed) => {
    const invoked: string[] = []
    const deps = defaults()
    deps.select = async (state) => ({
      decision:
        state.observations.length >= 2
          ? { type: 'done' }
          : { type: 'tool', id: entry.id },
    })
    deps.bind = async (_state, _entry, _signal, context) => {
      if (context?.rejectedCall) {
        expect(context.rejectedCall).toEqual({
          toolId: entry.id,
          arguments: { id: 'A' },
          assessment: 'repeated',
        })
        return { status: 'ready', arguments: { id: 'B' } }
      }
      return { status: 'ready', arguments: { id: 'A' } }
    }
    deps.authorize = async (_entry, args) => args.id === 'A' || allowed
    deps.invoke = async (_entry, args) => {
      invoked.push(String(args.id))
      return { ok: true, value: args }
    }
    const result = await runSystemOneTask({
      request: 'Update A and B',
      entries: [entry],
      signal: new AbortController().signal,
      dependencies: deps,
      refineRepeatedCall: true,
    })
    expect(result.status).toBe(allowed ? 'done' : 'denied')
    expect(invoked).toEqual(allowed ? ['A', 'B'] : ['A'])
  },
)

it('limits repeated-call refinement and never retries an unknown execution outcome', async () => {
  let bindings = 0,
    calls = 0
  const deps = defaults()
  deps.select = async () => ({ decision: { type: 'tool', id: entry.id } })
  deps.bind = async () => {
    bindings++
    return { status: 'ready', arguments: { id: 'A' } }
  }
  deps.invoke = async () => {
    calls++
    return { ok: true, value: {} }
  }
  const options = {
    request: 'Update records',
    entries: [entry],
    signal: new AbortController().signal,
    dependencies: deps,
    refineRepeatedCall: true,
  }
  expect((await runSystemOneTask(options)).status).toBe('no-progress')
  expect(bindings).toBe(3)
  expect(calls).toBe(1)
  bindings = 0
  calls = 0
  deps.invoke = async () => {
    calls++
    throw new Error('Connection lost')
  }
  expect((await runSystemOneTask(options)).status).toBe('unknown-outcome')
  expect(bindings).toBe(1)
  expect(calls).toBe(1)
})
it('returns to decision-making after unresolved binding without claiming execution', async () => {
  const deps = defaults()
  deps.bind = async () => ({ status: 'needs-input', reason: 'Missing ID' })
  deps.select = async (state) => ({
    decision: state.unresolved.length
      ? { type: 'needs-input' }
      : { type: 'tool', id: 'test' },
  })
  const result = await run(deps)
  expect(result.status).toBe('needs-input')
  expect(result.calls).toBe(0)
  expect(result.state.unresolved).toHaveLength(1)
})
it('keeps oversized results as evidence but stops before sending them onward', async () => {
  const deps = defaults()
  deps.invoke = async () => ({ ok: true, value: 'x'.repeat(1000) })
  const result = await runSystemOneTask({
    request: 'Read',
    entries: [entry],
    signal: new AbortController().signal,
    dependencies: deps,
    maxObservationBytes: 100,
  })
  expect(result.status).toBe('budget-exhausted')
  expect(result.state.observations[0].value).toHaveLength(1000)
})

it('permits a host-confirmed read again after a mutation, without permitting duplicate writes', async () => {
  const read = { ...entry, id: 'read', name: 'read' }
  const write = { ...entry, id: 'write', name: 'write' }
  let stored = 0
  const sequence = ['read', 'write', 'read']
  const dependencies: TaskDependencies = {
    ...defaults(),
    select: async (state) => ({
      decision:
        state.observations.length < sequence.length
          ? { type: 'tool', id: sequence[state.observations.length] }
          : { type: 'done' },
    }),
    authorize: async (entry) => ({
      allowed: true,
      effect: entry.id === 'read' ? 'read' : 'write',
    }),
    invoke: async (entry) => {
      if (entry.id === 'write') stored++
      return { ok: true, value: { stored } }
    },
  }
  const result = await runSystemOneTask({
    request: 'Update then verify',
    entries: [read, write],
    signal: new AbortController().signal,
    dependencies,
  })
  expect(result.status).toBe('done')
  expect(result.calls).toBe(3)
  expect(result.state.observations.map((o) => o.value)).toEqual([
    { stored: 0 },
    { stored: 1 },
    { stored: 1 },
  ])
  sequence.push('write')
  const repeat = await runSystemOneTask({
    request: 'Update',
    entries: [read, write],
    signal: new AbortController().signal,
    dependencies,
  })
  expect(repeat.status).toBe('no-progress')
  expect(repeat.calls).toBe(3)
})

it('resolves missing contracts before binding and keeps resolution separate from permission', async () => {
  const deps = defaults()
  let bound = false
  deps.resolve = async (selected) => ({
    status: 'ready',
    entry: { ...selected, inputSchema: entry.inputSchema },
  })
  deps.bind = async (_state, selected) => {
    expect(selected.inputSchema).toEqual(entry.inputSchema)
    bound = true
    return { status: 'ready', arguments: { id: 'A' } }
  }
  deps.authorize = async () => false
  const options = {
    request: 'Read',
    entries: [{ ...entry, inputSchema: undefined }],
    signal: new AbortController().signal,
    dependencies: deps,
  }
  expect((await runSystemOneTask(options)).status).toBe('denied')
  expect(bound).toBe(true)
  deps.resolve = async (selected) => ({
    status: 'ready',
    entry: { ...selected, serverId: 'different' },
  })
  await expect(runSystemOneTask(options)).rejects.toThrow('identity')
})
it('records unresolved contracts without invoking or presenting metadata as task results', async () => {
  const deps = defaults()
  deps.resolve = async () => ({
    status: 'unsupported',
    reason: 'Open-ended argument object',
  })
  const result = await runSystemOneTask({
    request: 'Read',
    entries: [{ ...entry, inputSchema: undefined }],
    signal: new AbortController().signal,
    dependencies: deps,
  })
  expect(result.calls).toBe(0)
  expect(result.state.observations).toHaveLength(0)
  expect(result.state.unresolved[0].reason).toBe('Open-ended argument object')
})

it('resumes from confirmed evidence without replaying an earlier action', async () => {
  const deps = defaults()
  const first = await run(deps)
  const resumed = await runSystemOneTask({
    request: first.state.request,
    initialState: first.state,
    entries: [entry],
    dependencies: deps,
    signal: new AbortController().signal,
  })
  expect(resumed.status).toBe('done')
  expect(resumed.calls).toBe(1)
  deps.select = async () => ({ decision: { type: 'tool', id: entry.id } })
  expect(
    (
      await runSystemOneTask({
        request: first.state.request,
        initialState: first.state,
        entries: [entry],
        dependencies: deps,
        signal: new AbortController().signal,
      })
    ).status,
  ).toBe('no-progress')
  await expect(
    runSystemOneTask({
      request: 'different',
      initialState: first.state,
      entries: [entry],
      dependencies: deps,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('checkpoint request mismatch')
})
it('keeps historical successes separate from new action completion and budgets', async () => {
  const previous = await run(defaults())
  const initialState = {
    request: 'Perform the operation again',
    observations: [],
    unresolved: [],
    context: [
      {
        request: previous.state.request,
        observations: previous.state.observations,
      },
    ],
  }
  const opts = {
    request: initialState.request,
    entries: [entry],
    initialState,
    signal: new AbortController().signal,
  }
  const premature = await runSystemOneTask({
    ...opts,
    dependencies: {
      ...defaults(),
      select: async () => ({ decision: { type: 'done' } }),
    },
  })
  expect(premature.status).toBe('no-progress')
  const repeated = await runSystemOneTask({ ...opts, dependencies: defaults() })
  expect(repeated.status).toBe('done')
  expect(repeated.calls).toBe(1)
  expect(initialState.observations).toEqual([])
  const denied = await runSystemOneTask({
    ...opts,
    dependencies: { ...defaults(), authorize: async () => false },
  })
  expect(denied.status).toBe('denied')
  const oversized = await runSystemOneTask({
    ...opts,
    maxObservationBytes: 1,
    dependencies: defaults(),
  })
  expect(oversized.status).toBe('budget-exhausted')
  expect(oversized.calls).toBe(0)
})

it('uses a host-refreshed catalog after discovery and still authorizes the new tool', async () => {
  const discovered = {
    ...entry,
    id: 'new',
    name: 'new',
    target: { method: 'tools/call' as const, name: 'new' },
  }
  const authorizations: string[] = []
  const result = await runSystemOneTask({
    request: 'Discover and read',
    entries: [entry],
    signal: new AbortController().signal,
    dependencies: {
      ...defaults(),
      select: async (state, entries) => ({
        decision:
          state.observations.length === 2
            ? { type: 'done' }
            : { type: 'tool', id: entries.at(-1)!.id },
      }),
      refreshCatalog: async () => [entry, discovered],
      authorize: async (e) => {
        authorizations.push(e.id)
        return true
      },
    },
  })
  expect(result.status).toBe('done')
  expect(authorizations).toEqual(['test', 'new'])
  expect(result.events.find((e) => e.type === 'catalog')?.detail).toMatchObject(
    { added: ['new'], count: 2 },
  )
})
it('does not interpret tool-returned text as a callable catalog', async () => {
  const deps = defaults()
  deps.invoke = async () => ({
    ok: true,
    value: { tools: [{ ...entry, id: 'invented' }] },
  })
  deps.select = async (state, entries) => {
    expect(entries.map((e) => e.id)).toEqual(['test'])
    return {
      decision: state.observations.length
        ? { type: 'done' }
        : { type: 'tool', id: 'test' },
    }
  }
  expect((await run(deps)).status).toBe('done')
})
it('rejects duplicate identities in a refreshed catalog', async () => {
  await expect(
    run({ ...defaults(), refreshCatalog: async () => [entry, entry] }),
  ).rejects.toThrow('Duplicate refreshed')
})
it('retains confirmed operation evidence when catalog refresh fails', async () => {
  let invoked = 0
  const result = await run({
    ...defaults(),
    invoke: async () => {
      invoked++
      return { ok: true, value: { saved: true } }
    },
    refreshCatalog: async () => {
      throw new Error('Unavailable')
    },
  })
  expect(result.status).toBe('no-progress')
  expect(result.state.observations[0].value).toEqual({ saved: true })
  expect(invoked).toBe(1)
  expect(result.reason).toContain('confirmed result')
})
it('persists confirmed observations before a later inference failure', async () => {
  const saved: unknown[] = []
  const deps = defaults()
  deps.onCheckpoint = async (state) => {
    saved.push(structuredClone(state))
  }
  deps.select = async (state) => {
    if (state.observations.length) throw new Error('Inference unavailable')
    return { decision: { type: 'tool', id: 'test' } }
  }
  await expect(run(deps)).rejects.toThrow('Inference unavailable')
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    observations: [{ toolId: 'test', ok: true, value: { updated: true } }],
  })
})

it('forwards selection context to binding without bypassing authorization', async () => {
  const context = { missingVerificationObservationIds: ['earlier'] }
  let invoked = false
  const deps = defaults()
  deps.select = async () => ({
    decision: { type: 'tool', id: 'test' },
    bindingContext: context,
  })
  deps.bind = async (_state, _entry, _signal, received) => {
    expect(received).toEqual(context)
    return { status: 'ready', arguments: { id: 'A' } }
  }
  deps.authorize = async () => false
  deps.invoke = async () => {
    invoked = true
    return { ok: true, value: {} }
  }
  const result = await run(deps)
  expect(invoked).toBe(false)
  expect(result.state).not.toHaveProperty('bindingContext')
})

it.each([true, 'description'] as const)(
  'retains execution evidence after catalog removal with capture=%s',
  async (captureContracts) => {
    const original =
      captureContracts === 'description'
        ? { description: entry.description }
        : structuredClone(entry)
    const current = structuredClone(entry)
    const result = await runSystemOneTask({
      request: 'Perform the operation',
      entries: [current],
      signal: new AbortController().signal,
      captureContracts,
      dependencies: {
        ...defaults(),
        refreshCatalog: async () => {
          current.description = 'A different contract after execution'
          return []
        },
        select: async (state, available) => {
          if (!state.observations.length)
            return { decision: { type: 'tool', id: current.id } }
          expect(available).toEqual([])
          expect(state.observations[0].contract).toEqual(original)
          return { decision: { type: 'done' } }
        },
      },
    })
    expect(result.status).toBe('done')
    expect(result.state.observations[0].contract).toEqual(original)
  },
)

it('counts captured contracts against the observation budget', async () => {
  const result = await runSystemOneTask({
    request: 'Perform the operation',
    entries: [{ ...entry, description: 'x'.repeat(2000) }],
    signal: new AbortController().signal,
    captureContracts: true,
    maxObservationBytes: 1000,
    dependencies: defaults(),
  })
  expect(result.status).toBe('budget-exhausted')
  expect(result.calls).toBe(1)
  expect(result.state.observations[0].contract?.description).toHaveLength(2000)
  expect((await run(defaults())).state.observations[0].contract).toBeUndefined()
})
