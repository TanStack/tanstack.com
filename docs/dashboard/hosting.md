# Neon and R2 deployment

## Prepared in this task

- Verified access to the site's TanStack Cloudflare account.
- Created the separate Standard R2 bucket `tanstack-dashboard-demo`.
- Uploaded `green-2025-week1.v1/snapshot.json` and `green-2025-week1.v1/trips.csv`.
- Added the `DASHBOARD_DEMO` binding to the site's Wrangler configuration.
- Added a validated, bounded R2 response cache with a local edge-cache layer.
- Added `DASHBOARD_HYPERDRIVE` support for the dedicated demo database.

The staging verification below was completed before production publication.
Hosted resources use the existing TanStack accounts:

- Neon organization: `org-green-water-28502066`.
- Demo project: `patient-field-88705156` (`tanstack-dashboard-demo`).
- Database: `dashboard_demo`, PostgreSQL 17, AWS Ohio (`aws-us-east-2`).
- Compute: fixed at 0.25 CU, with five-minute idle autosuspend.
- Dataset: 8,936 reference trips, imported and verified using the runtime role.
- Runtime role: `dashboard_reader`, SELECT access only, 20-connection role limit,
  15-second statement timeout, and read-only transactions by default.
- Hyperdrive: `07bd2803c2c240ad81681a2233b88de4`, bound as
  `DASHBOARD_HYPERDRIVE`, with a soft origin connection limit of five and SQL
  caching disabled. The application owns response caching in R2.

Hyperdrive uses its default `require` TLS mode, which validates server certificates
against WebPKI. Custom `verify-full` configuration requires uploading a CA
certificate. The origin is the direct Neon endpoint, not its pooled endpoint.

The main checkout's existing owner credentials were verified, but the demo uses
its own project, database, and runtime credentials. The ignored local `.dev.vars`
contains the demo reader connection and the Hyperdrive local connection override.
Owner credentials were not saved in the Worker configuration.

The user confirmed that Neon subsidizes the organization's databases. The console
shows the existing Launch plan, but the precise subsidy terms and expiry have not
been independently verified. Compute limits do not constitute a total spending cap.

## Reproducing the database setup

Create a separate demo project/compute so demo load cannot keep the production
compute busy. Confirm that new projects are covered by the subsidy. Choose a small
compute with autosuspend enabled and a bounded autoscaling maximum. Start with the
8,936-record reference dataset; the million-row synthetic benchmark is not the
public dataset and should not be uploaded by accident.

Seed using an owner connection, apply the runtime role grants, and verify read-only
access with that role. Keep owner credentials out of the Worker. Configure a
Cloudflare Hyperdrive instance named `tanstack-dashboard-demo` using the runtime
role and the dedicated Neon origin. Add its returned ID as `DASHBOARD_HYPERDRIVE`
in Wrangler; do not reuse the site's Hyperdrive binding. Use Cloudflare's current
Neon/Hyperdrive instructions to choose the origin endpoint and TLS settings.
Hyperdrive pools connections; PostgreSQL role limits and timeouts provide additional
bounds. Evaluate connection-pool behavior against Neon's autosuspend metrics.

Local and standalone Node development can continue using `DASHBOARD_DATABASE_URL`.
Hosted Workers prefer the dedicated Hyperdrive connection string. Both query and
CSV code use the same connection resolver.

## Cache behavior and limits

The persistent cache is intentionally finite: eight day choices, eight borough
choices, the first three pages, and four page sizes. Only the default pickup sort,
no zone, no text/column filters, no grouping, no detail ID, and no row selection
qualify. There are at most 768 keys per response/data version. Invalid borough
strings cannot manufacture additional keys.

A Worker checks its local edge cache, then R2, then PostgreSQL. Successful misses
populate R2 and the local cache. Cached JSON is validated before use. Corrupt entries
are recomputed and overwritten. Cache read/write failures are logged and do not
prevent the database path from serving a response. Logs report hit/miss/error only,
without request data or credentials. Cache hits do not open a database connection.

Arbitrary searches and visitor selections bypass persistence. This avoids unbounded
object growth and keeps selection state out of common results. They currently still
compute a full response in PostgreSQL. Separating their calculation from reusable
aggregates is a future optimization, not an implemented guarantee.

Concurrent cold misses can still compute the same key. Edge entries are local to
a data center and may be evicted. Neither cache is a hard request or spending cap.
Before public rollout, configure dashboard-specific abuse controls and usage alerts;
watch cache misses, PostgreSQL active time, latency, and connections. The 15-second
query timeout and role connection limits remain in effect on uncached work.

This policy is only for this public immutable dataset. Change the dataset prefix
when changing the dataset, and the response version when changing SQL or response
semantics. Remove obsolete R2 prefixes deliberately after rollout. Do not apply this
cache unchanged to private, mutable, or tenant-specific data.

## Downloads

Unfiltered full CSV exports with the default sort read the prepared R2 object.
Filtered, selected, and differently sorted exports still run the streaming database
query. The source JSON also lives in R2; the existing static client snapshot URL
remains intact. The bucket is not publicly listed or exposed through a public domain.
The Worker serves downloads using its binding.

## Rollout checks

1. Confirm the subsidy terms and expiry before public rollout. The project, region,
   compute limits, dataset, runtime grants, and Hyperdrive binding are configured.
2. Hosted SQL checks passed for the full 8,936-row dataset and the 43-row
   Queens / January 1 / Forest Hills search. Runtime write and schema-create
   privileges were verified absent.
3. Test staging against the hosted database and R2. Verify repeated common requests
   produce cache hits without database timing logs, and selection/search stay correct.
4. Check full CSV record count and default ordering against the source fixture.
5. Set request controls and usage alerts, then deploy the site through its normal flow.

References: [Hyperdrive PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/),
[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[Worker cache locality](https://developers.cloudflare.com/workers/runtime-apis/cache/).

TLS reference: [Hyperdrive TLS](https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/).

## Hosted staging verification, September 10, 2026

Version `5fa88303-ee9e-4d47-8dba-62ba191ec7d6` was tested before receiving
production traffic. Native, Material UI, and shadcn/Base UI each passed in server
and client modes, including pagination, keyboard navigation, column resizing,
selection reset, search, grouping, CSV export, retry, and offline recovery.
The default dashboard rendered 8,936 trips. Full CSV export returned 8,936 records
and the prepared R2 object's ETag. The default response cache object was retrieved
from R2 after the requests. Preview tailing did not expose cache event logs, so
per-request database avoidance was verified by the cache tests rather than claimed
from live logs.

The release was rebased onto the current site changes before building. The full
suite passed with 524 tests and one skipped test. The production build and Worker
binding validation passed.
