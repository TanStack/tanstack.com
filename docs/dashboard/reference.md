# Reuse the dashboard

Generate a separate TanStack Start application into a new directory:

```sh
pnpm dashboard:extract /tmp/my-dashboard
cd /tmp/my-dashboard
pnpm install
```

The extractor refuses to overwrite an existing directory. It copies only the
dashboard, its two shared presentation components, dataset, local database tools,
routes, and documentation, then generates a minimal React/Query/Router shell.
It does not copy site authentication, analytics, content builds, environment files,
Redact configuration, or database credentials. The generated README has startup
commands. Client mode needs no database. Server mode needs the separate seed and
`DASHBOARD_DATABASE_URL` binding.

## Replace the taxi data

1. Replace the schemas in `model.ts` and `request.ts`. Keep durable record IDs;
   IDs must not depend on sorting or pagination. Define allowed filter/sort fields
   and bounded page sizes at the request boundary.
2. Change `server/schema.sql`, the seed, and `server/queries.ts` together. Bind
   values as SQL parameters and allowlist dynamic identifiers. Keep totals, facets,
   charts, selection counts, and the page in the same read-only transaction.
3. Update `grid.ts` accessors and aggregations, `Charts.tsx`, and `csv.ts`. Preserve
   raw numeric values for sorting and calculations; format only for presentation.
4. Replace the versioned snapshot and client calculations if retaining client mode.
   Update the dataset version in `query-options.ts` and the snapshot attribution.
5. Update query-contract and SQL parity tests with independent expected totals.
   Run the browser suite for every component kit you ship.

## Boundaries

- Router owns shareable filters, sort, grouping, page, and detail ID.
- Query owns remote results, freshness, cancellation, and loading/error states.
- Table owns local column layout, expansion, and client selection.
- The server owns full-dataset filtering, ordering, aggregation, and server selection.
- `DashboardUI` owns component-kit presentation, without changing data semantics.

The example retains `/examples/dashboard` and `/api/dashboard-export` so its URLs,
source code, and regression suite remain comparable. To rename the route, update
both route files and the `getRouteApi` call in `Dashboard.client.tsx`. The generated
`host.server.ts` uses process environment variables; replace only that adapter for
a platform with per-request environment bindings. The SQL and browser components
do not need to know which platform provides the binding.
