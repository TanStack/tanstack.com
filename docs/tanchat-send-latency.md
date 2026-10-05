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
