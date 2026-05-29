# Intent Sync Workflow POC

TanStack.com dogfoods TanStack Workflow for the Intent registry background
sync. The app owns workflow definitions and domain idempotency. The Workflow
runtime, Netlify adapter, and Postgres store own scheduling, replay, timers,
leases, and status visibility.

## Runtime Shape

The user-land workflow code lives in
`src/utils/intent-workflows.server.ts`.

- `intent-discover-workflow`
  - Step: `discover-intent-packages`
  - Operation: npm/GitHub package discovery and version enqueueing
  - Schedule: registered in the runtime as `intent-discover-every-6h`

- `intent-process-workflow`
  - Step: `select-pending-versions`
  - Per-version steps: `process-version:${version.id}`
  - Operation: tarball skill extraction and synced/failed marking
  - Schedule: registered in the runtime as `intent-process-every-15m`

Runtime registration is composed in `src/utils/workflow-registrations.server.ts`.
The site-wide runtime lives in `src/utils/workflow-runtime.server.ts`:

```ts
export const workflowRuntime = createAppWorkflowRuntime()
```

That runtime uses:

- `@tanstack/workflow-runtime` for workflow registration, schedules, leases,
  timers, and sweeps
- `@tanstack/workflow-store-drizzle-postgres` for durable Postgres persistence
- `@tanstack/workflow-netlify` for the Netlify scheduled sweep handler

## Netlify Wake-Up

Netlify does not run a long-lived worker. It only wakes the runtime.

`netlify/functions/workflow-sweep-background.ts` runs every 5 minutes:

```ts
export default createNetlifyWorkflowSweepHandler({ runtime: workflowRuntime })
export const config = createNetlifyWorkflowSweepConfig({
  schedule: '*/5 * * * *',
})
```

Each sweep materializes due schedule buckets and starts deterministic workflow
runs from the durable store. The default scheduled run ID shape is:

```txt
${workflowId}:${scheduleId}:${bucketTimestamp}
```

Examples:

- `intent-discover-workflow:intent-discover-every-6h:1779796800000`
- `intent-process-workflow:intent-process-every-15m:1779796800000`

The scheduled function is deliberately stateless. If it is delivered late or
twice, the runtime/store should claim each bucket once.

## Durable Store

Workflow persistence is generic and shared by every workflow in the app. The
Intent sync does not get custom workflow runtime tables.

The runtime store tables are:

- `workflow_runs`
- `workflow_run_states`
- `workflow_event_locks`
- `workflow_events`
- `workflow_timers`
- `workflow_signal_deliveries`
- `workflow_schedules`
- `workflow_schedule_buckets`

The app schema mirrors the upstream store schema in `src/db/schema.ts`. The SQL
migration is `drizzle/migrations/0000_workflow_run_store.sql`.

Note: `drizzle/migrations` is ignored in this repo, so that migration must be
force-added if this branch is staged.

## Intent Queue

The Intent domain queue is unchanged:

- `intent_package_versions.sync_status = 'pending'` means discovered but not
  indexed.
- `sync_status = 'synced'` means skills were extracted and stored.
- `sync_status = 'failed'` means the row is still retryable by later process
  runs.

Workflow records orchestration progress and replay events. Intent tables remain
the business-state source of truth.

## Admin Visibility

The existing Intent admin page lists recent workflow runs by calling the
workflow store's `listRuns` API for the two Intent workflow IDs. This is minimal
visibility for scheduled sync status without exposing a generic workflow admin
surface yet.

## Manual Testing

Use the repo-local workflow CLI to test workflow behavior without Netlify cron:

```bash
pnpm workflow list-workflows
pnpm workflow ensure-schema
pnpm workflow list-runs --workflow-id intent-process-workflow
```

Start one workflow run directly:

```bash
pnpm workflow start intent-process-workflow \
  --input '{"batchSize":1,"source":"admin"}' \
  --events
```

Exercise the same model as the Netlify scheduled function:

```bash
pnpm workflow sweep --events false
```

Inspect a run:

```bash
pnpm workflow timeline <run-id> --events false
```

For automated unit tests, instantiate `createAppWorkflowRuntime` with
`inMemoryWorkflowExecutionStore()` and pass only the workflow registrations
under test. That keeps Workflow user-land tests independent of Postgres,
Netlify, npm, and GitHub.

## Current Gap

The published workflow adapter packages currently reference internal workflow
dependencies with `workspace:*`. TanStack.com uses `.pnpmfile.cjs` to rewrite
those package manifests to published versions during install. That file should
be removed once the Workflow packages are republished with normal dependency
ranges.
