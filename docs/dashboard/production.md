# Deploying the dashboard server

No hosted infrastructure is provisioned by this example. Use a separate PostgreSQL
database and provision `DASHBOARD_DATABASE_URL` through your hosting provider's
secret store. Never reuse the site's production database or commit credentials.

## Database access and limits

Apply `schema.sql` and seed as the owner. `server/runtime-role.sql` creates a
runtime login with SELECT access, a 20-connection ceiling, a 15-second default
statement timeout, a 30-second idle transaction timeout, and read-only transactions.
Run it once and provision its password through your provider or `psql`'s
`\password dashboard_reader`. Use TLS and your provider's certificate settings.
The connection limit is an initial deployment budget, not a universal tuning value.

Each dashboard request opens one connection, runs a repeatable-read transaction,
and closes it in `finally`. CSV export uses one connection and a cursor fetching
500 rows at a time. This bounds connections per request, not globally across
Workers. Use a provider pooler and tune database role limits, platform concurrency,
and request rate limits together. A single-process JavaScript semaphore would not
protect a distributed deployment. The sample data is public; adding private data
requires authentication and authorization at both RPC and export boundaries.

Database failures produce a retryable user message without exposing SQL or driver
errors. Structured `dashboard.database` logs record total duration, statement count,
and success without filters, IDs, credentials, or query text. Monitor failures,
latency percentiles, connection saturation, and exported response volume.
Superseded browser requests consume AbortSignal; SQL has its own timeout. Browser
cancellation does not promise immediate PostgreSQL cancellation.

## Downloads

Server exports submit a native POST form to the CSV endpoint. Download content is
streamed by the browser, with no client-side Blob accumulation. JSON POST remains
supported for API clients. The route validates both formats, rejects malformed
input and cross-origin browser submissions, and returns an actionable 503 if the
initial transaction cannot start. Responses use attachment and no-store headers.
If a stream fails after response headers, the browser reports a failed or interrupted
download; an HTTP status cannot be changed at that point. Export statements use a
60-second timeout. Larger jobs need a queue and object storage with expiring links.
Client mode still creates a Blob because its entire dataset is already local.

## Benchmarks

`benchmark-results.json` records the measured one-million-row PostgreSQL 17 run.
It uses 112 copies of the same week with distinct IDs, not a production-like mix
of dates, distributions, or tenants. There is one connection, one warm-up request,
and three timed requests per case. Timings include all SQL for a complete dashboard
response, not network or browser render time. These are local measurements, not
service-level guarantees or concurrent-load results.

The measured search path was the slowest, around 2.4 to 2.6 seconds. It searches
multiple fields including formatted numeric values. Before scaling that workflow,
define the intended search fields and choose appropriate full-text or trigram
indexes. Deep offset pagination, exact counts, and percentile aggregation also
need workload-specific evaluation. Keyset paging changes the UI contract and is
not silently substituted for page numbers.

To reproduce, initialize a disposable PostgreSQL database, seed its 8,936 rows,
then run `DASHBOARD_BENCHMARK_DATABASE_URL=... pnpm dashboard:benchmark`. The script
requires the initial fixture row count and expands it to 1,000,832 rows. It never
reads the site's database binding. Destroy only that disposable database afterward.
