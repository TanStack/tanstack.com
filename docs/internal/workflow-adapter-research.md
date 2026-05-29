# Workflow Adapter Research: Intent Sync POC

This note captures what the TanStack.com Intent sync POC needs from the
Workflow library after the runtime/store/host packages landed.

## What Got Better

The main abstraction we wanted now exists upstream:

- `@tanstack/workflow-core` owns deterministic workflow replay primitives.
- `@tanstack/workflow-runtime` owns workflow registration, schedule
  materialization, run lifecycle, leases, timers, signals, approvals, and
  bounded sweeps.
- `@tanstack/workflow-store-drizzle-postgres` owns durable Postgres
  persistence.
- `@tanstack/workflow-netlify` owns the Netlify scheduled sweep handler.
- `@tanstack/workflow-vercel` owns the Vercel cron sweep handler.

That moves host/runtime machinery out of TanStack.com. The app now only needs:

```ts
export const intentProcessWorkflow = createWorkflow({
  id: 'intent-process-workflow',
  input,
}).handler(async (ctx) => {
  const versions = await ctx.step('select-pending-versions', () =>
    selectPendingIntentVersions({ limit: ctx.input.batchSize }),
  )

  for (const version of versions) {
    await ctx.step(`process-version:${version.id}`, () =>
      processIntentVersion(version.id),
    )
  }
})
```

and one registration provider:

```ts
export function createIntentWorkflowRegistrations() {
  return {
    'intent-process-workflow': {
      load: async () => intentProcessWorkflow,
      schedules: [{ schedule: every.minutes(15) }],
    },
  }
}
```

## Domain Boundary

The Intent registry already has durable business state:

- `pending`
- `synced`
- `failed`

Workflow should not replace those domain statuses. Workflow should make
orchestration durable and observable:

- which scheduled bucket ran
- which workflow steps replayed
- which step failed
- which run is paused, finished, errored, or claimable

This is why the process workflow uses one step to select work and one stable
step per package version. Partial failures are local to the version step and do
not abort the entire batch.

## Serverless Runtime Model

Netlify and Vercel adapters should treat cron as a wake-up signal:

1. materialize due schedule buckets
2. claim due scheduled runs
3. claim due timers
4. run bounded workflow slices
5. return before the host timeout

The app should not own:

- cron parsing
- deterministic bucket IDs
- run ID construction
- timer sweeping
- lease ownership
- duplicate scheduled delivery handling
- event collection defaults

## Remaining Library Gaps

Package publication currently leaks monorepo internals. The published
`@tanstack/workflow-runtime`, `@tanstack/workflow-netlify`, and
`@tanstack/workflow-store-drizzle-postgres` manifests still contain
`workspace:*` dependencies. External apps need normal dependency ranges in
published packages.

The Drizzle/Postgres store ships `ensureSchema()`, but production apps often
want generated or exported migration SQL. Copying SQL from package internals is
easy to get wrong. The store package should expose a stable migration artifact
or a Drizzle schema helper.

The runtime store supports `claimStaleRuns`, but the sweep path should clearly
document whether stale running runs are reclaimed by `runtime.sweep()` today or
whether hosts need a separate stale-run pass.

Admin visibility APIs are enough for a POC (`listRuns`, `getRunTimeline`), but
a future adapter story should include a small generic status panel pattern so
every app does not redraw the same table.
