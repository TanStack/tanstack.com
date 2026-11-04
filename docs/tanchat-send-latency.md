# TanChat send latency, October 4, 2026

## What changed

Ordinary messages no longer load the entire MCP connection inventory or skill catalog before calling the model. The model can discover tools and skills when it needs them. Explicit tool selections still load their inventory, and selected skill and plugin versions remain pinned.

Independent admission checks run together and settle before their database context is released. Bot lifecycle, workspace context, memory preferences, and thread source use fewer database statements. Each authorization snapshot still checks its exact scope against current database state. Post-preparation checks, reset epochs, receipt matching, and runtime tool authorization remain in place.

Usage receipts, reservations, and counters publish in one statement under the existing transaction and locks. Duplicate sends, concurrent cap enforcement, scheduled usage, funded reservations, and admin policy retain their existing behavior.

Automatic Kody memory and account guidance remain enabled and overlap with account preferences and thread source reads. Their latency is not represented by the no-credential benchmark below.

Native PostgreSQL clients allow five connections, matching the existing Workers limit, so independent reads can actually overlap. Copy activation now explicitly waits for its activity publication before checking it. That ordering cannot depend on all queries sharing one socket.

## Controlled measurements

The baseline is commit 1bbafeec, the changes merged through PR 1339. Both versions run the actual conversation admission and preparation code against disposable PostgreSQL. The provider is synthetic. Each version runs three messages, the first includes cold client setup.

| Database connection                              | Baseline, milliseconds | Candidate, milliseconds |
| ------------------------------------------------ | ---------------------- | ----------------------- |
| Delayed TCP proxy, nominal 80 ms round trip      | 5406, 5140, 5148       | 2610, 2210, 2207        |
| Delayed proxy, five connections in both versions | 5358, 4984, 4980       | 2610, 2210, 2207        |
| Same-machine PostgreSQL, no proxy delay          | Not measured           | 60, 16, 13              |

Warm preparation in the delayed fixture fell from about 5.14 seconds to 2.21 seconds, about 57 percent. The proxy delays chunks, so protocol startup can incur more than one nominal round trip. The native baseline uses one connection and the candidate uses five. Workers already allowed five. With both versions using five connections, warm preparation fell from 4.98 seconds to 2.21 seconds, about 56 percent. Neither comparison predicts the production improvement.

These numbers measure the beginning of durable admission to provider dispatch. They exclude HTTP authentication, browser rendering, real model time to first token, and real Kody network reads. They do not establish instant live responses.

## Remaining production work

The production configuration now binds HYPERDRIVE to the cache-disabled tanstack-com pool, 6ec1513b87bb47e9897e5502727b0388, created after user approval on October 4. The host already supports HYPERDRIVE.connectionString and otherwise uses DATABASE_URL. A new pool must target this site's database, not the existing unrelated dashboard demo pool.

Cloudflare confirmed query caching is disabled and the origin connection limit is twenty. Local development omits the production binding and continues using its optional DATABASE_URL. The binding takes effect on the live site when this configuration is deployed. Local startup was verified with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID explicitly empty, and the temporary test server was stopped. No deployment was performed during pool provisioning.

Hyperdrive pools connections to reduce TCP, TLS, and authentication setup. It does not remove every SQL round trip or relocate existing Durable Objects. Region placement needs a measurement against the actual database and conversation objects before changing hints.

Sources: [Hyperdrive connection pooling](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/) and [Durable Object location](https://developers.cloudflare.com/durable-objects/reference/data-location/).

## Verification

The runtime suite exercises real PostgreSQL, including access revocation, reset races, retries, copy activation, quota concurrency, funded usage, response preference persistence, and skill discovery through the actual SDK loop. The lazy MCP test also uses the SDK loop with a synthetic transport.

The local Assistant page rendered from the QA checkout on localhost:3000. No real provider messages were sent during this pass. Full pnpm test passed: all five TypeScript configurations, lint with zero errors and 105 existing warnings, 537 site tests, 2,274 chat tests, and 20 desktop tests. Five optional tests were skipped. The complete PostgreSQL runtime suite passed 268 tests in 35 files. The final metadata scope suite passed 10 tests, including four additional thread-scope rejection cases.

## Follow-up phase diagnosis, October 5

A warm live Assistant reply was observed 5.284 seconds after sending, with a 1.35-second recorded model call. Browser automation and observation are included in that 5.284-second result. The difference is not a database measurement.

Live Worker tracing on the next short reply measured 1,398 ms of wall time and 59 ms of CPU time for the Conversation.begin RPC. The existing publisher also coupled transcript delivery to sidebar activity publication: after both initial flushes started, another transcript flush could not begin until the sidebar flush completed. The two outboxes now have independent, coalesced publishers. Their durable ordering, retry alarms, producer receipts, and copy activation checks remain unchanged. A runtime regression holds sidebar publication open and verifies that later transcript updates still publish.

The HTTP send path now overlaps workflow ownership, lifecycle metadata, and run context reads after resolving the authenticated conversation identity. All three reads settle before the request database context is released. Authorization, lifecycle rejection, workflow ownership rejection, and post-preparation checks remain in place.

Structured chat_send_timing, chat_admission_timing, and chat_run_timing logs record cumulative milliseconds within each operation. They separate HTTP authentication and metadata, admission guards and preparation, model credentials and selection, usage reservation, enrichment, context preparation, first visible text, its durable save, and response completion. They do not log message text, credentials, or account identity. Admission and run logs use the message receipt ID for correlation. The first-text save is not a measurement of browser paint or stream delivery.

## Measured database round trips, October 5

The first instrumented live run measured 301 ms of HTTP authentication and metadata, 694 ms inside admission, and 1,319 ms from run start to model context. The two admission guards accounted for 555 ms. Usage reservation took 916 ms after credentials, and enrichment took another 171 ms. First text arrived 2,895 ms after model context, consistent with the recorded 3.01-second model call. The browser observed the reply after 5.935 seconds, including browser control and observation overhead.

Reservation now executes the existing protocol inside one PostgreSQL function call. It keeps the same receipt and day advisory lock keys, fresh receipt and role checks, allowance ordering, and atomic receipts, counters, and funded reservations. The function is SECURITY INVOKER and VOLATILE, so queries inside it obtain fresh snapshots after waiting for locks. A real database regression revokes admin access while reservation waits on the day lock and verifies rejection without a receipt.

Ordinary admission guards now read membership, ownership, bot lifecycle, and thread lifecycle together. Both checks before and after preparation remain fresh. Retry readiness still receives a separate lifecycle check after its asynchronous readiness wait.

[PostgreSQL function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html) explains the fresh snapshot behavior. These changes reduce application overhead without changing the model or its response quality. They do not promise near-zero provider latency.
