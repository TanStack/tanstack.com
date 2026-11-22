import { catalogEntrySource } from './catalog-evidence'
import { Validator } from '@cfworker/json-schema'
import type { CatalogEntry } from './mcp-catalog'

export interface TaskObservation {
  id: string
  toolId: string
  toolName: string
  source?: Pick<CatalogEntry, 'serverId' | 'serverLabel' | 'kind'>
  /** Advertised at execution time. Evidence only, never an execution grant. */
  contract?: Pick<CatalogEntry, 'description'> & Partial<CatalogEntry>
  arguments: Record<string, unknown>
  ok: boolean
  effect?: 'read' | 'write' | 'unknown'
  value: unknown
}
export interface TaskState {
  request: string
  /** Earlier turns are reference evidence, never new action authorization. */
  context?: Array<{
    taskId?: string
    request: string
    observations: TaskObservation[]
  }>
  contextWindow?: { includedTurns: number; totalTurns: number }
  observations: TaskObservation[]
  unresolved: Array<{ toolId: string; reason: string; atObservation: number }>
}
export type TaskDecision =
  | { type: 'tool'; id: string }
  | { type: 'done' | 'needs-input' | 'unsupported' }
export interface TaskBindingContext {
  /** Inference finding, never an argument value or an authorization grant. */
  missingVerificationObservationIds: string[]
  /** Ranked advertised contracts, for reviewing prerequisites. Not callable grants. */
  reviewCandidates?: CatalogEntry[]
  /** A rejected proposal, never executed evidence or a source of argument values. */
  rejectedCall?: {
    toolId: string
    arguments: Record<string, unknown>
    assessment: 'contradicted' | 'repeated'
  }
}
export interface TaskDependencies {
  /** Host-owned authoritative catalog snapshot after a call, only when it changed.
   * Must include local tools. Tool-returned descriptions alone never enter this hook.
   */
  refreshCatalog?(signal: AbortSignal): Promise<CatalogEntry[] | undefined>

  /** Metadata resolution only. Execution still requires a separate host grant. */
  resolve?(
    entry: CatalogEntry,
    signal: AbortSignal,
  ): Promise<
    | { status: 'ready'; entry: CatalogEntry }
    | { status: 'unsupported'; reason: string }
  >
  select(
    state: TaskState,
    entries: CatalogEntry[],
    signal: AbortSignal,
  ): Promise<{
    decision: TaskDecision
    usage?: unknown
    bindingContext?: TaskBindingContext
  }>
  bind(
    state: TaskState,
    entry: CatalogEntry,
    signal: AbortSignal,
    context?: TaskBindingContext,
  ): Promise<
    | { status: 'ready'; arguments: Record<string, unknown>; usage?: unknown }
    | {
        status: 'needs-input' | 'unsupported-schema'
        reason: string
        usage?: unknown
      }
  >
  /** Supplied by the host, never inferred from Jev confidence or server annotations. */
  authorize(
    entry: CatalogEntry,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<
    boolean | { allowed: boolean; effect: 'read' | 'write' | 'unknown' }
  >
  invoke(
    entry: CatalogEntry,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<{ ok: boolean; value: unknown }>
  onCheckpoint?(state: TaskState): Promise<void>
  onEvent?(event: TaskEvent): Promise<void>
}
export type TaskEvent = { type: string; step: number; detail: unknown }
export type TaskStatus =
  | 'done'
  | 'needs-input'
  | 'unsupported'
  | 'denied'
  | 'budget-exhausted'
  | 'no-progress'
  | 'unknown-outcome'

export const canonicalTaskValue = (value: unknown): string => {
  if (Array.isArray(value))
    return '[' + value.map(canonicalTaskValue).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonicalTaskValue(v))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
const canonical = canonicalTaskValue

/** Experimental task loop. The host's observed state, not this status, verifies task completion. */
export async function runSystemOneTask(options: {
  request: string
  entries: CatalogEntry[]
  dependencies: TaskDependencies
  signal: AbortSignal
  initialState?: TaskState
  maxSteps?: number
  maxCalls?: number
  maxObservationBytes?: number
  captureContracts?: boolean | 'description'
  refineRepeatedCall?: boolean
}) {
  const { dependencies: deps, signal } = options
  const maxSteps = options.maxSteps ?? 12,
    maxCalls = options.maxCalls ?? 8,
    maxBytes = options.maxObservationBytes ?? 64000
  if (
    [maxSteps, maxCalls, maxBytes].some(
      (n) => !Number.isSafeInteger(n) || n < 1,
    )
  )
    throw new Error('Invalid task limits.')
  const entries = new Map(options.entries.map((e) => [e.id, e]))
  if (entries.size !== options.entries.length)
    throw new Error('Duplicate task tool identities.')
  const state: TaskState = options.initialState
    ? structuredClone(options.initialState)
    : {
        request: options.request,
        observations: [],
        unresolved: [],
      }
  if (state.request !== options.request)
    throw new Error('Task checkpoint request mismatch.')
  const events: TaskEvent[] = []
  const executed = new Map<string, number>()
  const effects = new Map<string, 'read' | 'write' | 'unknown'>()
  let mutationRevision = 0
  let calls = state.observations.length
  for (const observation of state.observations) {
    executed.set(
      canonical({ id: observation.toolId, arguments: observation.arguments }),
      mutationRevision,
    )
    effects.set(
      canonical({ id: observation.toolId, arguments: observation.arguments }),
      observation.effect ?? 'unknown',
    )
    if (observation.ok && observation.effect !== 'read') mutationRevision++
  }
  const emit = async (type: string, step: number, detail: unknown) => {
    const event = { type, step, detail }
    events.push(event)
    await deps.onEvent?.(event)
  }
  const finish = (status: TaskStatus, reason: string) => ({
    status,
    reason,
    state,
    events,
    calls,
  })
  if (
    new TextEncoder().encode(
      JSON.stringify({
        observations: state.observations,
        context: state.context,
      }),
    ).byteLength > maxBytes
  )
    return finish(
      'budget-exhausted',
      'Saved observations exceed the evidence budget.',
    )
  for (let step = 0; step < maxSteps; step++) {
    signal.throwIfAborted()
    const selection = await deps.select(state, [...entries.values()], signal)
    signal.throwIfAborted()
    await emit('decision', step, selection)
    if (selection.decision.type !== 'tool') {
      if (
        selection.decision.type === 'done' &&
        !state.observations.some((o) => o.ok)
      )
        return finish(
          'no-progress',
          'Completion was proposed without any successful tool evidence.',
        )
      return finish(
        selection.decision.type,
        'Jev selected a terminal task decision. Completion must be verified against observed results.',
      )
    }
    let entry = entries.get(selection.decision.id)
    if (!entry) throw new Error('Decision selected an unknown tool.')
    const selectedId = entry.id
    if (calls >= maxCalls)
      return finish('budget-exhausted', 'Tool call budget exhausted.')
    if (
      state.unresolved.some(
        (u) =>
          u.toolId === selectedId &&
          u.atObservation === state.observations.length,
      )
    )
      return finish(
        'needs-input',
        'The same unresolved operation was selected without new evidence.',
      )
    if (!entry.inputSchema && deps.resolve) {
      const resolved = await deps.resolve(entry, signal)
      signal.throwIfAborted()
      await emit('contract', step, { toolId: entry.id, ...resolved })
      if (resolved.status === 'unsupported') {
        state.unresolved.push({
          toolId: entry.id,
          reason: resolved.reason,
          atObservation: state.observations.length,
        })
        continue
      }
      if (
        resolved.entry.id !== entry.id ||
        resolved.entry.serverId !== entry.serverId ||
        resolved.entry.name !== entry.name ||
        canonical(resolved.entry.target) !== canonical(entry.target)
      )
        throw new Error(
          'Contract resolution changed the selected tool identity.',
        )
      entry = resolved.entry
      entries.set(entry.id, entry)
    }
    let binding = await deps.bind(
      state,
      entry,
      signal,
      selection.bindingContext,
    )
    signal.throwIfAborted()
    await emit('arguments', step, { toolId: entry.id, ...binding })
    if (binding.status !== 'ready') {
      state.unresolved.push({
        toolId: entry.id,
        reason: binding.reason,
        atObservation: state.observations.length,
      })
      continue
    }
    let signature = ''
    let previousRevision: number | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      if (
        !entry.inputSchema ||
        !new Validator(entry.inputSchema).validate(binding.arguments).valid
      )
        throw new Error(
          'Arguments do not satisfy the advertised input contract.',
        )
      signature = canonical({ id: entry.id, arguments: binding.arguments })
      previousRevision = executed.get(signature)
      if (
        previousRevision === undefined ||
        (effects.get(signature) === 'read' &&
          previousRevision !== mutationRevision)
      )
        break
      if (attempt !== 0 || !options.refineRepeatedCall)
        return finish(
          'no-progress',
          'An identical operation was proposed again without a state change justifying a read. No duplicate action executed.',
        )
      const refined = await deps.bind(state, entry, signal, {
        ...selection.bindingContext,
        missingVerificationObservationIds:
          selection.bindingContext?.missingVerificationObservationIds ?? [],
        rejectedCall: {
          toolId: entry.id,
          arguments: binding.arguments,
          assessment: 'repeated',
        },
      })
      signal.throwIfAborted()
      await emit('arguments', step, {
        toolId: entry.id,
        bindingRetry: 'repeated-call',
        ...refined,
      })
      if (refined.status !== 'ready')
        return finish('needs-input', refined.reason)
      binding = refined
    }
    const grant = await deps.authorize(entry, binding.arguments, signal)
    const allowed = typeof grant === 'boolean' ? grant : grant.allowed
    const effect = typeof grant === 'boolean' ? 'unknown' : grant.effect
    if (!allowed)
      return finish(
        'denied',
        'Host execution policy did not authorize this operation.',
      )
    if (previousRevision !== undefined && effect !== 'read')
      return finish(
        'no-progress',
        'A repeated operation no longer has a read-only grant.',
      )
    signal.throwIfAborted()
    // Record attempted invocation before calling. A thrown transport error can hide a completed mutation.
    executed.set(signature, mutationRevision)
    effects.set(signature, effect)
    calls++
    await emit('invoke', step, {
      toolId: entry.id,
      arguments: binding.arguments,
    })
    let result: { ok: boolean; value: unknown }
    try {
      result = await deps.invoke(entry, binding.arguments, signal)
    } catch {
      await emit('unknown-outcome', step, { toolId: entry.id })
      return finish(
        'unknown-outcome',
        'Invocation did not produce a confirmed outcome. Do not retry automatically.',
      )
    }
    const observation: TaskObservation = {
      id: 'observation_' + state.observations.length,
      toolId: entry.id,
      toolName: entry.name,
      arguments: binding.arguments,
      ...result,
      source: catalogEntrySource(entry),
      ...(options.captureContracts
        ? {
            contract:
              options.captureContracts === 'description'
                ? { description: entry.description }
                : structuredClone(entry),
          }
        : {}),
      effect,
    }
    state.observations.push(observation)
    if (result.ok && effect !== 'read') mutationRevision++
    await deps.onCheckpoint?.(structuredClone(state))
    await emit('result', step, observation)
    if (deps.refreshCatalog) {
      let refreshed: CatalogEntry[] | undefined
      try {
        refreshed = await deps.refreshCatalog(signal)
      } catch {
        signal.throwIfAborted()
        await emit('catalog-error', step, { afterObservation: observation.id })
        return finish(
          'no-progress',
          'The operation returned a confirmed result, but its updated tool catalog could not be loaded. Do not repeat the operation automatically.',
        )
      }
      signal.throwIfAborted()
      if (refreshed) {
        const next = new Map(refreshed.map((item) => [item.id, item]))
        if (next.size !== refreshed.length)
          throw new Error('Duplicate refreshed tool identities.')
        const added = [...next.keys()].filter((id) => !entries.has(id))
        const removed = [...entries.keys()].filter((id) => !next.has(id))
        const changed = [...next.keys()].filter(
          (id) =>
            entries.has(id) &&
            canonical(entries.get(id)) !== canonical(next.get(id)),
        )
        entries.clear()
        for (const [id, item] of next) entries.set(id, item)
        await emit('catalog', step, {
          added,
          removed,
          changed,
          count: entries.size,
        })
      }
    }
    if (
      new TextEncoder().encode(
        JSON.stringify({
          observations: state.observations,
          context: state.context,
        }),
      ).byteLength > maxBytes
    )
      return finish(
        'budget-exhausted',
        'Observation budget exceeded. Results were retained without silently truncating evidence.',
      )
  }
  return finish('budget-exhausted', 'Decision step budget exhausted.')
}
