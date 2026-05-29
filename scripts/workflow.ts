import { materializeWorkflowSchedules } from '@tanstack/workflow-runtime'
import type { WorkflowExecutionStatus } from '@tanstack/workflow-runtime'
import {
  workflowExecutionStore,
  workflowRuntime,
} from '../src/utils/workflow-runtime.server'
import { createAppWorkflowRegistrations } from '../src/utils/workflow-registrations.server'

type CommandName =
  | 'ensure-schema'
  | 'list-workflows'
  | 'list-runs'
  | 'start'
  | 'sweep'
  | 'timeline'
  | 'help'

interface ParsedArgs {
  command: CommandName
  positional: Array<string>
  flags: Map<string, string | true>
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  switch (args.command) {
    case 'ensure-schema':
      await ensureSchema()
      break
    case 'list-workflows':
      listWorkflows()
      break
    case 'list-runs':
      await listRuns(args)
      break
    case 'start':
      await startRun(args)
      break
    case 'sweep':
      await sweep(args)
      break
    case 'timeline':
      await timeline(args)
      break
    case 'help':
      printHelp()
      break
  }
}

async function ensureSchema() {
  await workflowExecutionStore.ensureSchema()
  printJson({ ok: true, message: 'Workflow schema ready.' })
}

function listWorkflows() {
  const registrations = createAppWorkflowRegistrations()

  printJson({
    workflows: Object.entries(registrations).map(
      ([workflowId, registration]) => ({
        workflowId,
        scheduleCount: registration.schedules?.length ?? 0,
        schedules: (registration.schedules ?? []).map((schedule) => ({
          id: schedule.id,
          schedule: schedule.schedule,
          overlapPolicy: schedule.overlapPolicy ?? 'skip',
          enabled: schedule.enabled !== false,
        })),
      }),
    ),
  })
}

async function listRuns(args: ParsedArgs) {
  const workflowId = getOptionalStringFlag(args, 'workflow-id')
  const status = getOptionalStatusFlag(args, 'status')
  const limit = getIntegerFlag(args, 'limit', 20)
  const rows = await workflowExecutionStore.listRuns({
    workflowId,
    status,
    limit,
  })

  printJson({
    runs: rows.map((run) => ({
      ...run,
      createdAtIso: new Date(run.createdAt).toISOString(),
      updatedAtIso: new Date(run.updatedAt).toISOString(),
      wakeAtIso:
        run.wakeAt === undefined
          ? undefined
          : new Date(run.wakeAt).toISOString(),
    })),
  })
}

async function startRun(args: ParsedArgs) {
  const workflowId = requirePositional(args, 0, 'workflowId')
  const now = getNow(args)
  const runId =
    getOptionalStringFlag(args, 'run-id') ??
    `manual:${workflowId}:${new Date(now).toISOString()}`
  const input = getJsonFlag(args, 'input', {})
  const includeEvents = getBooleanFlag(args, 'events', false)
  const maxEvents = getOptionalIntegerFlag(args, 'max-events')

  const result = await workflowRuntime.startRun({
    workflowId,
    runId,
    input,
    now,
    includeEvents,
    maxEvents,
    leaseOwner: getOptionalStringFlag(args, 'lease-owner'),
  })

  printJson({
    ...result,
    run: result.run ? formatRun(result.run) : undefined,
  })
}

async function sweep(args: ParsedArgs) {
  const now = getNow(args)
  const materialize = !getBooleanFlag(args, 'skip-materialize', false)
  const includeEvents = getBooleanFlag(args, 'events', false)

  const materialized = materialize
    ? await materializeWorkflowSchedules(workflowRuntime, { now })
    : []
  const result = await workflowRuntime.sweep({
    now,
    includeEvents,
    maxScheduledRuns: getIntegerFlag(args, 'max-scheduled-runs', 25),
    maxTimers: getIntegerFlag(args, 'max-timers', 25),
    maxDurationMs: getOptionalIntegerFlag(args, 'max-duration-ms'),
    leaseOwner: getOptionalStringFlag(args, 'lease-owner'),
    maxEvents: getOptionalIntegerFlag(args, 'max-events'),
  })

  printJson({
    now,
    nowIso: new Date(now).toISOString(),
    materialized,
    scheduled: result.scheduled.map(formatRuntimeRunResult),
    timers: result.timers.map(formatRuntimeRunResult),
    summary: result.summary,
    deadlineReached: result.deadlineReached,
    remainingMayExist: result.remainingMayExist,
  })
}

async function timeline(args: ParsedArgs) {
  const runId = requirePositional(args, 0, 'runId')
  const includeEvents = getBooleanFlag(args, 'events', true)
  const result = await workflowExecutionStore.getRunTimeline(runId)

  if (!result) {
    printJson({ found: false, runId })
    process.exitCode = 1
    return
  }

  printJson({
    found: true,
    run: formatRun(result.run),
    events: includeEvents
      ? result.events
      : result.events.map((event) => ({
          eventIndex: event.eventIndex,
          eventType: event.eventType,
          stepId: event.stepId,
          createdAt: event.createdAt,
          createdAtIso: new Date(event.createdAt).toISOString(),
        })),
  })
}

function parseArgs(argv: Array<string>): ParsedArgs {
  const first = argv[0]
  const command = first && isCommandName(first) ? first : 'help'
  const tokens = command === 'help' ? argv : argv.slice(1)
  const positional: Array<string> = []
  const flags = new Map<string, string | true>()

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (!token) continue

    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }

    const name = token.slice(2)
    const next = tokens[index + 1]
    if (!next || next.startsWith('--')) {
      flags.set(name, true)
      continue
    }

    flags.set(name, next)
    index++
  }

  return { command, positional, flags }
}

function isCommandName(value: string): value is CommandName {
  switch (value) {
    case 'ensure-schema':
    case 'list-workflows':
    case 'list-runs':
    case 'start':
    case 'sweep':
    case 'timeline':
    case 'help':
      return true
    default:
      return false
  }
}

function requirePositional(
  args: ParsedArgs,
  index: number,
  label: string,
): string {
  const value = args.positional[index]
  if (!value) fail(`Missing required ${label}.`)
  return value
}

function getOptionalStringFlag(
  args: ParsedArgs,
  name: string,
): string | undefined {
  const value = args.flags.get(name)
  if (value === undefined || value === true) return undefined
  return value
}

function getBooleanFlag(
  args: ParsedArgs,
  name: string,
  fallback: boolean,
): boolean {
  const value = args.flags.get(name)
  if (value === undefined) return fallback
  if (value === true) return true
  if (value === 'true') return true
  if (value === 'false') return false
  fail(`--${name} must be true or false.`)
}

function getIntegerFlag(
  args: ParsedArgs,
  name: string,
  fallback: number,
): number {
  return getOptionalIntegerFlag(args, name) ?? fallback
}

function getOptionalIntegerFlag(
  args: ParsedArgs,
  name: string,
): number | undefined {
  const value = args.flags.get(name)
  if (value === undefined || value === true) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) fail(`--${name} must be an integer.`)
  return parsed
}

function getOptionalStatusFlag(
  args: ParsedArgs,
  name: string,
): WorkflowExecutionStatus | undefined {
  const value = getOptionalStringFlag(args, name)
  if (!value) return undefined
  return parseWorkflowExecutionStatus(value)
}

function parseWorkflowExecutionStatus(value: string): WorkflowExecutionStatus {
  switch (value) {
    case 'queued':
    case 'running':
    case 'paused':
    case 'finished':
    case 'errored':
    case 'aborted':
      return value
    default:
      fail(
        `Invalid status "${value}". Use queued, running, paused, finished, errored, or aborted.`,
      )
  }
}

function getJsonFlag(
  args: ParsedArgs,
  name: string,
  fallback: unknown,
): unknown {
  const value = getOptionalStringFlag(args, name)
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch (error) {
    fail(`--${name} must be valid JSON: ${getErrorMessage(error)}`)
  }
}

function getNow(args: ParsedArgs): number {
  const now = getOptionalIntegerFlag(args, 'now')
  if (now !== undefined) return now
  const iso = getOptionalStringFlag(args, 'now-iso')
  if (!iso) return Date.now()

  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) fail(`--now-iso must be a valid date string.`)
  return parsed
}

function formatRuntimeRunResult(
  result: Awaited<
    ReturnType<typeof workflowRuntime.sweep>
  >['scheduled'][number],
) {
  return {
    ...result,
    run: result.run ? formatRun(result.run) : undefined,
  }
}

function formatRun(run: {
  runId: string
  workflowId: string
  workflowVersion?: string
  status: string
  input: unknown
  output?: unknown
  error?: unknown
  waitingFor?: unknown
  pendingApproval?: unknown
  wakeAt?: number
  createdAt: number
  updatedAt: number
}) {
  return {
    ...run,
    createdAtIso: new Date(run.createdAt).toISOString(),
    updatedAtIso: new Date(run.updatedAt).toISOString(),
    wakeAtIso:
      run.wakeAt === undefined ? undefined : new Date(run.wakeAt).toISOString(),
  }
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}

function printHelp() {
  console.log(`Usage:
  pnpm workflow ensure-schema
  pnpm workflow list-workflows
  pnpm workflow list-runs [--workflow-id <id>] [--status <status>] [--limit <n>]
  pnpm workflow start <workflowId> --input '<json>' [--run-id <id>] [--events]
  pnpm workflow sweep [--now <ms>] [--events] [--max-scheduled-runs <n>] [--max-timers <n>]
  pnpm workflow timeline <runId> [--events false]

Examples:
  pnpm workflow list-workflows
  pnpm workflow ensure-schema
  pnpm workflow start intent-process-workflow --input '{"batchSize":1,"source":"admin"}'
  pnpm workflow sweep --events false
  pnpm workflow timeline intent-process-workflow:intent-process-every-15m:1779796800000
`)
}

function fail(message: string): never {
  console.error(message)
  console.error('')
  printHelp()
  process.exit(1)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error) => {
  console.error(getErrorMessage(error))
  process.exit(1)
})
