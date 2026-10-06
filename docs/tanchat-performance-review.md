# TanChat final regression review

Comparison against main at d653e768, October 1, 2026. The candidate is the draft PR checkout. No deployment or merge was performed.

## Client bundle comparison

Both production builds succeeded. Both used the same installed dependency tree and content collection, so this isolates source changes rather than comparing independent clean installs. The script reads each production route manifest and sums unique root and route preload assets plus CSS. Gzip sizes are compressed per file. These are preload sizes, not a browser network trace or Core Web Vitals measurement.

| Route               | Main gzip bytes | Candidate gzip bytes |        Change |
| ------------------- | --------------: | -------------------: | ------------: |
| Root assets         |         439,391 |              444,852 | +5,461, 1.24% |
| Home                |         457,429 |              462,923 | +5,494, 1.20% |
| Documentation route |         441,939 |              447,402 | +5,463, 1.24% |
| Chat workspace      |     Not present |              999,337 |     New route |

The first candidate loaded about 25 KB more compressed assets on ordinary site routes. Eager Zod validation in chat route definitions and shared OAuth completion was responsible for most of that increase. Chat navigation now uses the site's existing Valibot dependency, and popup completion loads its schema on demand. Origin, channel, expiration, cleanup, and server session verification checks remain intact.

Total emitted client JavaScript increases from 18,361,230 to 19,832,029 bytes. This is all emitted chunks, including lazy chat features, not the amount fetched by every visitor. Chat itself still has a substantial initial preload budget and should receive a separate route-level performance pass.

Reproduce after building both directories:

```sh
node scripts/chat/compare-route-bundles.mjs /path/to/main /path/to/candidate
```

## Review findings and fixes

- Removed the obsolete local Start route augmentation. Its generic parameter declarations conflicted with the framework declaration and broke route search and loader inference across the site. The framework owns this type contract now.
- Added explicit input types to nine generic navigation callbacks, with validation retained at the boundary.
- Regenerated the route tree to include the existing shared-project route.
- Removed tests for three retired Builder UI components. Kept the tests for retained activity parsing, reduction, sanitization, and durable compaction utilities.
- Updated shared-auth runtime fixtures with OAuth account columns and explicit invite grants. Tests still reject revoked chat access before host routing, and separately reject access to another conversation.
- Updated popup tests to wait for lazy schema loading before checking in-flight verification cancellation.

## Limits

The existing browser inspection timed out, and a fresh localhost navigation reported connection refused, so this review does not certify rendered parity, real OAuth login, touch gestures, production cold starts, or Core Web Vitals. The live localhost checkout is separate from the PR checkout used for these checks. A small shared bundle increase remains, so this is not a claim of zero performance impact.

## Validation

- Production build passed.
- All five TypeScript configurations passed, without dependency downgrades or type suppression.
- Lint passed with zero errors and 103 warnings.
- Site unit tests: 537 passed, four skipped.
- TanChat harness: all 2,221 tests passed in 226 files.
- Electron source tests: all 20 passed.
- Disposable PostgreSQL migration and foreign-key cascade checks passed.
- PostgreSQL runtime: all 245 tests passed in 28 files after the fixture corrections. The earlier run affected by local disk exhaustion was discarded.

The existing PR includes a separate PostgreSQL runtime CI job. CI and live account/browser checks still need to be reviewed before merge.
