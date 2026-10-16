# Worker split staging

This branch is a staging experiment. Production deployment commands are disabled.

The split site is `https://tanstack-perf-stage-site.thetanstack.workers.dev`.
The unified comparison is `https://tanstack-perf-stage-baseline.thetanstack.workers.dev`.

Both use only `tanstack-perf-stage-*` resources. No production secrets, database,
Hyperdrive, AI binding, custom domain, cron, or namespace transfer is configured.
Session and encryption keys were generated for staging. Signed-in chat and
project persistence are outside this public docs comparison.

Build with `pnpm build:staging`, deploy with `pnpm deploy:staging`.
The deployment preflight checks every destination and resource binding before
uploading anything. It removes `WRANGLER_CI_OVERRIDE_NAME` and
`WRANGLER_CI_MATCH_TAG` from child Wrangler processes and supplies each name
explicitly. The installed Wrangler overrides even `--name` when that CI name
variable is present.

The remote deployment is exercised with those CI variables set to staging
values. The production-name override case is tested offline. This reproduces
the relevant environment behavior, it is not a connected Cloudflare Builds job.

`python3 scripts/measure-worker-staging.py` sends 80 alternating requests using
fresh curl connections. Both sites share a staging-only GitHub content cache.
The unified copy comes from main at `5cd9f45a`, with identical staging telemetry
suppression and request counters added. The candidate includes the earlier
docs optimizations as well as the split, so this compares the whole candidate,
not the split alone.

A request counter of one means the first observed docs request in an instance.
It does not prove every Cloudflare cache is cold. Worker JavaScript timers also
do not measure platform preparation or CPU accurately. Report these limitations
alongside timing results.

## Results

All 80 requests returned 200 from DFW. Median TTFB in milliseconds:

| Requests | Unified | Split |
| --- | ---: | ---: |
| First observed in an instance | 1,531 (12 samples) | 791 (11 samples) |
| Reused instance | 213 (28 samples) | 202 (29 samples) |
| All requests | 227 | 236 |

First observed requests were 48% faster in this sample. Overall p95 fell from
1,978 ms to 1,186 ms. The overall median did not improve. This supports a cold
response benefit, not a claim that every docs request is faster. The sample is
small, from one location, with no database or signed-in users. Both Workers
reported `db_used=false`. Platform preparation and first SSR work remain mixed
in the first observed measurement.

Measured versions: unified `5872b2b2-db2f-4720-a66f-ec23e5ab0562`,
split `f8a399c6-47b8-4fca-971e-ac002904f1eb`. A final deployment additionally
turns off browser Sentry reporting, it does not change the docs server flow.

Rollback was exercised on the staging site and chat Workers, then the latest
versions were restored. Docs returned 200 and unauthenticated chat returned
401 after rollback. All six staging namespace IDs remained unchanged. This
checks code rollback with stable ownership, not reversing a state transfer.

The browser check reached Installation using SPA navigation, with no page
errors or chat requests. OG and starter features returned 200. The full test
suite passed: 570 unit, 2,270 chat, and 20 desktop tests, plus type checks and
lint. Four unit and one desktop test were skipped.

The unified comparison can be rebuilt from the pinned main commit with
`node scripts/build-worker-staging-baseline.mjs`. Its staging-only changes are
recorded in `baseline.patch`.
