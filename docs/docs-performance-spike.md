# Docs response performance investigation

## Current implementation

Complete-page caching is out of the request path. `wrangler.jsonc` still has Workers Cache disabled. HTML docs responses use `Cache-Control: private, no-store` and `Cloudflare-CDN-Cache-Control: no-store`. The earlier Cache API experiment is archived in `docs-html-cache-experiment.ts.txt`, which the application does not import. Production deployment and follow-up measurements are recorded in the final section below. No CDN purge was performed. An isolated temporary Worker was deployed for measurement on October 15, with no production routes, database binding, application secrets, or scheduled jobs. It used the existing docs R2 bucket. The temporary Worker was deleted after capture; the R2 bucket was retained.

The retained changes are manifest reuse across browser navigation, final page header ownership, and background refresh of expired positive GitHub source content. Explicit source invalidation still refreshes synchronously. Document and sidebar purge tags remain available, but do not enable HTML caching.

## Production observations, October 14, 2026

Three requests to `/router/latest/docs/routing/routing-concepts`, before deploying any of these changes:

| Ray ID               | Client TTFB | Cloudflare cfEdge | Cloudflare cfWorker |
| -------------------- | ----------: | ----------------: | ------------------: |
| a4a8f328c97c6b56-DFW |      3104ms |              79ms |              2817ms |
| a4a8f33c8aaa6de9-DFW |      3380ms |            2467ms |               780ms |
| a4a8f352784b1b62-DFW |       320ms |              44ms |               151ms |

The live Worker tail captured the last two. Worker wall/CPU times were 787/323ms and 158/92ms. Existing application request-end logs reported 460ms and 28ms, with zero outbound HTTP fetches counted. Those counts do not include R2 bindings or database sockets, and request-end logs do not cover the entire streamed response. The first request was not captured by the tail.

The slow requests cannot all be attributed to the same application phase. One has substantial Worker time; another has substantial Cloudflare-reported edge time. The measurements do not establish why either was slow.

Docs source reads use R2 plus the content cache, falling back to GitHub. Postgres is initialized lazily, so entering the database request context does not itself issue a query.

## New diagnostics

Only docs-path requests receive these diagnostics:

- `Server-Timing`: application time through response creation, Start handler, database configuration lookup, content edge-cache reads/writes, R2 reads/body reads, origin fetch work, artifact construction and persistence where executed.
- `db_used`: whether the database accessor was used by response-header creation. This is an access indicator, not a SQL query count or duration.
- Structured `docs_timing` logs: headers ready, first body byte, body completion, cancellation or stream failure. Logs include the Cloudflare ray ID, phase offsets/durations, and database access indicator at that stage.
- Sentry child spans for the measured operations, under the existing request tracing integration.

Timings overlap and can be nested, so do not add their durations to calculate total latency. Header timings are a snapshot; work completed during streaming appears in later body-phase logs. Origin time includes the whole content-origin operation, including response-body consumption. These diagnostics do not measure Worker startup before the entrypoint or network transit to the visitor.

Sentry tracing is configured at 100% with request and server-function middleware. Receipt of these new child spans in the production Sentry project has not been verified. Cloudflare Worker tail access was verified.

## Deployed preview measurements, October 15

The temporary Worker ran the production build with complete HTML caching disabled. Twelve sequential requests across two runs all returned 200 and `private, no-store`, with no database access recorded. Requests reached DFW from the same machine. The instance ID and per-instance docs request counter distinguish first docs requests from reused instances.

| Instance state     | Requests |   Client TTFB | Median TTFB | Platform CPU | Platform wall time |
| ------------------ | -------: | ------------: | ----------: | -----------: | -----------------: |
| First docs request |        7 | 1,714–3,244ms |     1,992ms |    163–469ms |          411–955ms |
| Reused instance    |        5 |     242–287ms |       273ms |      51–88ms |           79–108ms |

Individual samples and ray IDs are in `docs-performance-measurements.json`. This is a small preview sample, not a production percentile or a multi-region benchmark. First docs request is an observed counter, not a direct platform cold-start event.

Fresh-instance work is strongly associated with the slow responses. The page does not require Postgres to render. This does not yet isolate which functions are expensive, nor explain all the gap between platform invocation timing and client TTFB. The Worker upload was approximately 8.4MB compressed and reported 345ms startup time on the first build, which makes module initialization worth profiling, but is not proof of the full cause.

The content-phase spans showed initial parallel cache reads taking much longer on first docs requests. Their intervals are not a standalone benchmark of the cache service.

### Clock limitation

Cloudflare freezes `performance.now()` and `Date.now()` between I/O events in deployed Workers. The application phase timings can therefore miss CPU-only work, especially rendering after the last I/O. Do not treat `app_headers`, first-body-byte or body-complete clock values as complete real elapsed durations. Compare them with Cloudflare's platform CPU/wall counters and client TTFB. See https://developers.cloudflare.com/workers/runtime-apis/performance/.

The CPU-profile API returned HTTP 404, “No recent executions were found for this Worker,” twice, even with successful traffic and Worker tail events. A function-level CPU profile was not obtained. Sentry delivery remains unverified.

### Validation

Production build, all TypeScript configurations and repository lint passed. Unit tests: 556 passed, 4 skipped. Chat tests: 2,269 passed. Desktop tests: 20 passed, 1 skipped. The initial unit command was blocked by the sandbox's IPC restriction; rerunning the remaining suites with IPC permission passed. The later instance marker passed its targeted tests and production build.

## Next measurement

Profile CPU for cold and reused instances to identify module initialization versus first-render work. Keep HTML caching disabled. If deploying the instrumentation to production, correlate `cf-ray` with `docs_timing` logs. Compare Cloudflare timing, headers-ready, first-body-byte and body-complete timing first. Then inspect the nested content phases and `databaseUsed`. If database access appears, instrument the specific query path rather than attributing all request time to Postgres. Compare multiple regions and cold/warm Worker runs.

The local runtime uses development content sources and Vite compilation. Its timing is useful for verifying instrumentation, not for predicting production latency.

## First-request CPU investigation, October 15

Profiled the production build locally with the workerd inspector, then used `wrangler check startup` for module initialization. No additional remote Worker was created.

An initially empty local content store produced a 2,275ms first request, dominated by GitHub/tree retrieval and manifest construction. That is a content-cache miss, not a clean cold-instance comparison. After populating storage and restarting the Worker, the first request was 143ms and the repeated request 20ms, with no origin fetches in the first request's timing header.

Startup profiling found initialization of Zod schemas, chat/Kody dependencies, database schema definitions, and garbage collection. A controlled build temporarily omitted the StreamObject, WorkspaceSync, Conversation and TanChatWorkflow exports from the shared entrypoint. Source exports were restored immediately after building.

| Local comparison                     | Full Worker | Chat exports omitted |
| ------------------------------------ | ----------: | -------------------: |
| Sampled active module-startup CPU    |      88.9ms |               23.9ms |
| Startup garbage collection           |      13.8ms |                1.3ms |
| First docs request with warm content |       143ms |                191ms |
| Repeated docs request                |        20ms |                 19ms |

These are single local samples, not production estimates or statistically stable benchmarks. The reduction in startup CPU did not produce an end-to-end improvement: schema initialization reappeared in the first-request CPU profile. Removing exports alone shifts work and is not a solution.

The SSR import graph and the compiled router identify this eager dependency path:

```
src/router.tsx
  -> src/routeTree.gen.ts
  -> src/routes/api/chat/mcp/contract.ts
  -> src/chat/server/reference-catalog-http.server.ts
  -> src/chat/server/discovery-integrations/index.ts
  -> src/chat/server/discovery-integrations/kody.ts
  -> src/chat/server/discovery-integrations/kody-contract.ts
  -> src/chat/server/kody-actions.ts
  -> @babel/parser and @babel/types
```

The API route imports its handler at module scope. Kody actions imports Babel at module scope. The first docs request consequently initializes unrelated chat/API/compiler code while loading the router. Other routes and the Worker exports also reach chat dependencies, so changing just one route would not necessarily remove them.

The next implementation should isolate those dependencies behind the routes/entrypoints that use them: lazy server-handler imports for unrelated API routes, and a separate chat Durable Object/workflow entrypoint if needed. Verify the generated static import graph and repeat cold-instance measurements, rather than assuming that smaller startup time means faster first responses.

This identifies concrete unnecessary application work, not the entirety of the multi-second Cloudflare delay. Network/runtime startup remains outside the local request profile. The production source and full build have been restored, HTML caching remains disabled, and no experimental export removal is retained.

Profiles from this run are saved locally at `/tmp/docs-startup-full.cpuprofile`, `/tmp/docs-startup-without-chat.cpuprofile`, `/tmp/docs-warm-content-first.cpuprofile`, and `/tmp/docs-warm-content-repeat.cpuprofile`.

## TanChat isolation implementation, October 15

Chat API handlers and MCP OAuth handlers now import their implementations when invoked. Larger inline handlers live outside the generated route tree, under `src/chat/server/routes`. The chat access check, legacy chat redirects, appearance bootstrap, CSS URL, and shared builder loading UI also load on demand. The chat admin component no longer has an extra export that prevents automatic route splitting. The main navigation link disables hover preloading for TanChat.

The four deployed Worker class names remain unchanged. Lightweight classes in `src/chat/server/entries.ts` defer their implementation imports until object construction or workflow execution. Durable Object initialization runs inside `blockConcurrencyWhile`, and explicit prototype methods preserve the RPC surface. No storage namespace, binding, or migration changes are needed. Scheduled work is imported only from the scheduled entrypoint.

The production build now checks the emitted static chunk graph for both server and browser entrypoints, including the server router loaded by docs. Only two small synchronous routing-contract modules, `core/navigation.ts` and `core/workspace-panels.ts`, remain eager, along with the server's lightweight class declarations. No chat UI, services, MCP implementation, or Babel modules appeared in that graph. The build fails if another chat implementation module becomes eager.

### Local validation

- Production build passed its new isolation check. `pnpm test` passed all TypeScript configurations, lint, 560 unit tests, 2,270 chat tests, and 20 desktop tests. Five existing tests were skipped.
- Real local workerd initialized Conversation's SQLite state and returned `{running:false,pending:false}` through RPC.
- A local test subclass verified WorkspaceSync initialization. StreamObject created a stream, read its contents, and acquired a fork through RPC.
- A contract test compares every public RPC/lifecycle method against the lazy entrypoints. A separate test checks deferred imports, initialization, arguments, and return values.
- Browser docs rendering and unauthenticated chat navigation were checked against the local production build, using a generated local session secret. No production credentials or storage were used for the chat checks.

| Local sample                           | Before isolation | After isolation |
| -------------------------------------- | ---------------: | --------------: |
| Sampled active module-startup CPU      |           88.9ms |          22.7ms |
| Startup garbage collection             |           13.8ms |     0ms sampled |
| First docs request, warm content, TTFB |            143ms |           171ms |
| Repeated docs request, TTFB            |             20ms |            36ms |

These are individual local profiles, not a controlled performance distribution. The startup sample improved by about 74%, but there is no demonstrated end-to-end TTFB improvement yet. The first-request profile no longer shows the chat/compiler initialization path; remaining work includes routing/rendering, shared partners/blog modules, and content-cache operations. Both measured docs requests reported no database use and no origin content fetch.

The Worker still contains the lazy chat chunks in its upload, about 26MB uncompressed. This change reduces what initializes for unrelated requests, not total upload size. Production cold-instance measurements are still needed. At the end of the local validation, this isolation change had not been deployed. Complete HTML caching remains disabled.

Profiles: `/tmp/docs-startup-isolated-chat.cpuprofile`, `/tmp/docs-isolated-chat-first.cpuprofile`, and `/tmp/docs-isolated-chat-repeat.cpuprofile`. Raw client timings: `/tmp/docs-isolated-chat-requests.jsonl`.

## Production deployment and measurements, October 15

Deployed the tested build to `tanstack-com` at 20:41 UTC. Previous version: `9440f136-1e14-4cea-9583-830df3dae49c`. New version: `3b554871-c23c-4825-9bb4-f9bc27dc5466`. Deployment kept existing variables and secrets. Durable Object bindings/namespaces, database schema, and cache configuration did not change. No CDN purge was needed. The deployed changes include the earlier docs manifest/content-cache/header fixes and tracing as well as TanChat isolation.

Cloudflare reported **36ms Worker startup**. The earlier isolated preview reported 345ms, which is a different deployment context, not a controlled production before/after startup benchmark.

Measured six requests immediately before deployment, then 28 afterward from the same client through DFW. Requests used separate curl processes/connections and a one-second pause. Cloudflare tail records were joined by ray ID to obtain the actual serving version, CPU, wall time, and application timing logs. Five requests during rollout reached the previous version and are excluded from new-version statistics. All 12 requests in the final run reached the new version.

| Request group                               | Samples | Median TTFB |    TTFB range | Median platform CPU | Median platform wall |
| ------------------------------------------- | ------: | ----------: | ------------: | ------------------: | -------------------: |
| Before deployment, first three requests     |       3 |     2,555ms | 1,846–2,914ms |               174ms |                451ms |
| Before deployment, last three requests      |       3 |       305ms |     258–346ms |                93ms |                122ms |
| New version, first docs request on instance |       9 |     1,393ms |   297–3,271ms |               165ms |                362ms |
| New version, reused docs instance           |      14 |       240ms |     214–440ms |                56ms |                 77ms |

The old version lacked the instance counter, so its first/last groups are observations of request order, not verified cold/warm labels. The new first-docs counter also does not prove that no other route already initialized the instance. These small samples suggest a warm-path improvement, but do not establish production percentiles or a causal percentage improvement from TanChat isolation alone.

All 23 measured new-version responses returned 200 and `private, no-store`. Every corresponding docs timing record reported `databaseUsed: false`. On the 3,271ms outlier, Cloudflare's response header reported `cfEdge=2467ms` and `cfWorker=673ms`. Much of that wait lies outside the reported Worker duration. This does not identify which edge/platform operation caused it. The multi-second first-request problem remains.

Read-only smoke checks passed: `/chat` redirected to `/chat-access` and returned 200; `/api/chat/bootstrap` returned the expected unauthenticated 401; `/auth/mcp/client-metadata` returned 200. Observed exception messages during the deployment window were network disconnects, with no module-initialization exception observed. Signed-in chat interactions were not exercised in production.

Full request measurements and phase logs are in `docs-production-performance-measurements.json`. No follow-up code change was deployed after these measurements.

## Detailed cold-request investigation

The follow-up isolated the dominant delay to pre-handler preparation of the complete uploaded Worker, including code never imported by the request. See [the investigation](./worker-cold-start-investigation.md) and [220 probe measurements](./worker-cold-start-measurements.json). No additional production deployment was performed.
