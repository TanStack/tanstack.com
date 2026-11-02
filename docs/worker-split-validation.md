# Worker split validation

The site Worker now excludes OG image generation, the chat HTTP backend and
Durable Objects, project starter templates, the chat app UI and the icon catalog.
One Start app and browser route tree remain.

## Cold payload comparison

Eighty interleaved requests compared the original and reduced site uploads with
an identical minimal handler. Neither handler imported the uploaded app modules,
used credentials, or accessed storage. Every request returned 200 from DFW.

|                                                  | Original payload | Reduced payload |
| ------------------------------------------------ | ---------------: | --------------: |
| Upload                                           |    26,260.77 KiB |   10,935.11 KiB |
| Gzip upload                                      |     8,459.71 KiB |    3,158.83 KiB |
| First observed instance samples                  |               12 |              13 |
| Median first-instance response after connection  |      1,048.05 ms |        471.6 ms |
| Median reused-instance response after connection |         67.65 ms |         65.2 ms |

The upload shrank about 58%. Median first-instance latency fell about 55%, while
reused-instance latency stayed similar. This supports removing uploaded bytes
as a fix for the cold preparation delay found in the earlier investigation.

These are payload preparation measurements, not full documentation page TTFB.
The handler's first observed request does not establish that every Cloudflare
platform cache was cold. The measurements still include network round-trip
time. Raw records and cleanup results are in `worker-split-measurements.json`.

## Runtime and state checks

The actual built app ran locally with all four Workers and native service
bindings, a synthetic session secret, and an unused local database address.

- OG image generation returned a valid 1200 × 630 PNG.
- README image generation returned a valid 1800 × 450 PNG.
- Unknown libraries returned 404 and invalid README themes returned 400.
- Unauthenticated chat bootstrap returned 401, and MCP metadata returned 200.
- The icon browser rendered, filtered icons, and had no browser errors.
- Visiting chat without a session redirected to `/chat-access` without browser errors.
- All three chat Durable Object namespaces reported SQLite storage locally.
- Starter HTTP routing reached its existing database-backed rate limiter. Its
  database-dependent checks could not complete with the synthetic local address.

Disposable Cloudflare Workers exercised the same staged transfer as the
production deployment script: prepare the target, commit at the source, activate
the target's local bindings and existing workflow, then remove source tombstones.
The stored marker survived. A workflow created between transfer stages retained
its ID and completed successfully after reassignment. Four disposable Workers
and their test workflow were deleted afterward.

The production build and full `pnpm test` suite pass: all TypeScript configurations,
lint, 568 unit tests, 2,270 chat tests and 20 desktop tests. Five existing tests
are skipped.

The tests cover API path and method parity, route precedence, decoded parameters,
trailing slashes, HEAD requests, cookies, request bodies, streamed responses,
first-rollout ordering, ordinary deployments and preflight failure behavior.

## Production rollout and response measurements

Deployed to production on October 15, 2026. Initial split deployment version:
`57c7a11c-699b-4116-9cfa-2d3a9ceb9736`.

The three Durable Object namespace IDs and the existing workflow ID match the
pre-deployment snapshot exactly. Their owner is now `tanstack-chat`.

Production smoke checks passed for OG and README rendering, MCP metadata,
unauthenticated chat protection, starter feature discovery and in-memory project
generation. The generated project had 16 files including `package.json`, and no
repository or saved project was created. Docs rendered without browser errors
and navigated through the client router without another document request. No
chat APIs or chat app bundles loaded while visiting docs.

Three sequential samples of the same public Query overview page, each with 24
fresh curl connections from DFW, all returned 200:

| Sample                       | Median TTFB | p95 TTFB, nearest rank |    Maximum | Median cfWorker |
| ---------------------------- | ----------: | ---------------------: | ---------: | --------------: |
| Before deployment            |    245.9 ms |             1,120.2 ms | 1,969.7 ms |           91 ms |
| Immediately after deployment |    305.5 ms |             1,293.4 ms | 1,511.8 ms |          100 ms |
| Follow-up after deployment   |    248.5 ms |             1,352.0 ms | 1,354.3 ms |           84 ms |

The settled median is effectively unchanged. These small samples have different
cold/warm mixtures and do not establish an improvement in production cold-TTFB
percentiles. Long responses remain. The controlled payload result above is not
a 55% end-to-end docs speedup.

Documentation responses now explicitly use `private, no-store`. The prior
production version returned `public, max-age=0, must-revalidate`. No full-page
cache was enabled, and this rollout did not purge the CDN or run database schema
migrations.

The user approved credential provisioning and the authenticated check. The
saved session was already expired before deployment and returned the same 401
response afterward. A successful signed-in check still needs a fresh session
from `pnpm auth:login` in the primary repository.

Automatic approval review rejected the earlier temporary public documentation
probes with a binding to the live cache. Those probes were not deployed; the
measurements above were made against the actual production site.

The branch was subsequently rebased onto `b416acbc` to retain six newer main
commits, including the header branding and Hotkeys page updates. The response
samples above describe the initial split deployment.

## Production retry, October 16

Final site version: `664695d7-25ec-4005-8499-997d98e99c81`. The upload is
10,938.30 KiB raw and 3,161.44 KiB gzip. Cloudflare reported 30 ms startup,
compared with 250 ms for the prepared unified fallback. These startup figures
are deployment measurements, not documentation request TTFB.

The active chat namespace IDs and workflow ID are unchanged. The extra three
namespaces created under the site during the failed rollout moved to
`tanstack-chat-recovery`, keeping their IDs and real implementations. No
namespace was deleted or replaced. The site owns no chat namespaces.

The final deployment exercised the normal production script with Cloudflare's
Worker name, match tag and account variables supplied. Sibling commands did not
inherit the site identity. An earlier replay omitted the account variable;
Wrangler rejected that upload, the previous site version was restored, and the
prepared unified fallback returned 200. The final preflight now rejects that
incomplete context before contacting Cloudflare.

The homepage and Query, Router and Start documentation returned 200 after the
final deployment. Browser navigation from Query overview to Installation used
one document request, with no browser errors or chat API/bundle requests. OG and
README PNGs, MCP metadata, starter discovery and in-memory generation passed.
Protected endpoints returned the expected unauthenticated 401 responses. All
50 sampled homepage/docs responses during the first rollout returned 200.

Twenty-four subsequent Query overview requests from SLC returned 200 with
`private, no-store`. Median TTFB was 96.25 ms and p95 was 685.3 ms. There is no
matched production baseline from SLC, so this sample does not establish a
production speedup. Raw checks and state snapshots are in
`worker-split-production-validation.json`.

Actual Cloudflare Builds and signed-in account, isolation, CSRF, logout and
WorkspaceSync checks passed earlier on the isolated staging fleet and Neon
database. The saved production session was already expired, so successful
signed-in production flows were not retested. No production schema migration or
CDN purge was performed for this retry.

The final full `pnpm test` run passed all TypeScript checks, lint with zero errors,
576 unit tests, 2,270 chat tests and 20 desktop tests. Five existing tests remain
skipped. The deployment tests include missing CI account context and automatic
rollback, in addition to sibling identity scoping and preflight rejection.
