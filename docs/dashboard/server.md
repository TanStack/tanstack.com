# Server-powered dashboard

`/examples/dashboard` defaults to `source=server`. The component kit is independent:
Custom, Material UI, and shadcn / Base UI use the same query contract and layout.
Choose Client in Data source to compare the local implementation.

## Run locally

The example uses a separate PostgreSQL connection. It never uses the site's
`DATABASE_URL`, which points at production during normal development.

```sh
pnpm dashboard:db
```

This starts PGlite's PostgreSQL socket server on `127.0.0.1:5441`, backed by the
ignored `.dashboard-db` directory. It is a local development tool, not the
production database. The application uses the installed `postgres` client in
both environments and runs the same SQL. See [PGlite Socket](https://pglite.dev/docs/pglite-socket).

In another terminal:

```sh
DASHBOARD_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5441/postgres pnpm dashboard:seed
```

Add the following local binding to `.dev.vars`, then restart Vite:

```dotenv
DASHBOARD_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5441/postgres"
```

The seed runs the example's idempotent schema SQL and imports the checked-in TLC
snapshot in a transaction. Repeating it does not duplicate rows. The schema has
indexes for pickup order, day/zone filtering, zone lookups, and borough lookups.
For deployment, provision a PostgreSQL database, run the same seed against its
explicit URL, and configure `DASHBOARD_DATABASE_URL` as a Worker secret. Runtime
access needs SELECT permissions only. No hosted database has been provisioned
or seeded by this spike.

## Ownership

[Table patterns](./table.md) records the KevinVandy / MRT audit and the grid
behavior shared by all component kits.

[Query patterns](./query.md) records the TkDodo guidance applied to cache keys,
prefetching, freshness, loading, errors, and tests.

- `request.ts`: validated URL and request contract, allowed columns, numeric
  ranges, bounded page sizes, sorting, and grouping.
- `server/queries.ts`: parameterized PostgreSQL queries for every chart,
  summary, matching count, facet, group, detail record, and table page.
- `server/database.ts`: one read-only, repeatable-read transaction per response,
  with a statement timeout. Charts and rows see the same database snapshot.
- `functions.ts`: TanStack Start RPC boundary. The database code stays on the server.
- `Dashboard.client.tsx`: Query cache, cancellation signal, previous results,
  debounced filter input, and URL state. Presentation changes do not reset the page.
- `TripTable.tsx`: Table v9 manual filtering, sorting, grouping, and pagination
  in server mode. Visibility, pinning, resizing, and density remain local.
- `server/export.ts`: CSV response streamed from a PostgreSQL cursor in batches
  of 500 rows, with backpressure and connection cleanup.

The server returns at most 250 table rows per request, plus aggregates and the
small zone lookup. It never imports or sends the full JSON snapshot during a
normal dashboard request. Charts are aggregated in SQL, including median duration.
Table text and column filters also apply to charts. As before, the timeline
ignores its own day selection and zone ranking ignores its own zone selection,
so users can choose another day or zone without clearing the filter first.

Every sort adds trip ID as a deterministic tie-breaker. Out-of-range pages are
clamped by the server and corrected in the URL. Query keeps the previous response
visible while loading; selection and export actions are disabled while that
response no longer matches the current request. Filter input is debounced by
200 ms. The AbortSignal cancels superseded browser requests; SQL still has its
own statement timeout rather than claiming immediate database cancellation.

Server grouping returns paginated group aggregates. Clicking a group drills
into its trips by adding its column filter to the URL. It does not download all
group children or group only the visible page. Client mode also supports its
existing expandable local groups and continuous virtual scrolling. Server mode
uses bounded pages with virtualization inside each page.

## Selection and exports

Explicit selection stores trip IDs and survives paging, sorting, grouping,
and component-kit changes. Select all stores an all-matching flag with excluded
IDs, so it does not fetch every matching ID. The server calculates the selected
count and fare total over the complete matching set. Changing filter scope clears
selection, preventing an old all-matching selection from applying to a new search.

CSV exports contain all matching or selected records, regardless of the loaded
page. Filters, sort, and selection are included in the export request. Server
memory is bounded by the cursor batch. A native form POST lets the browser stream
the download without assembling a JavaScript Blob. Very large exports still need
a background job. See [production setup](./production.md).

## Verification and limits

`tests/dashboard-server.test.ts` runs the SQL against an in-memory PostgreSQL
engine and compares chart totals, distributions, median, and zone rankings with
the existing client calculations. It also verifies sorting before pagination,
late pages, grouping totals, all-matching exclusions, exports across unloaded
pages, detail records outside the filter, and literal handling of SQL-like search
text. The optional client uses the same URL filter contract.

The browser checks cover server filtering, linked search, pagination, selection,
grouping, and group drill-down. A live Worker export returned 412 selected records
plus the CSV header from a view containing only 50 loaded rows.

This verifies the architecture on the 8,936-record snapshot, not million-row
performance. Offset pagination, exact counts, percentile aggregation, and substring
search should be measured with the target dataset. Keyset pagination, appropriate
search indexes, and pre-aggregated summaries may be warranted at larger scale.
The local PGlite socket server serializes transactions; use real PostgreSQL for
concurrency and deployment benchmarks. SQL and state ownership follow
[TanStack Table's client/server guide](https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side).

Final checks: `pnpm test` passed with 506 tests and one skip, including TypeScript
and lint. `pnpm build` passed. The generated client JavaScript contains none of
the dashboard SQL, database connection binding, or local PGlite server code.

[Standalone extraction](./reference.md), [production setup](./production.md), and
[measured benchmark results](./benchmark-results.json) cover the reference example
and its deployment boundaries. Run `pnpm dashboard:test:browser` for all six
component-kit/data-mode combinations, plus failure and offline recovery.

[Neon and R2 rollout](./hosting.md) records the prepared bucket, optional dedicated
Hyperdrive binding, bounded response cache, and remaining hosted-database setup.
