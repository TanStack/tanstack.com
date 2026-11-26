# What makes the first docs request slow

The largest delay happens before the Worker fetch handler runs. It depends on the uploaded application code, even when that code is never imported or executed by the request. The remaining first-render cost is much smaller and includes real application CPU and content-cache reads.

This explains why the TanChat import split helped runtime initialization without eliminating the multi-second spikes. The code stayed in the roughly 26,260 KiB Worker upload. Lazy imports control module execution, but do not remove the platform cost associated with carrying that upload.

## A production request, broken down

Production version `3b554871-c23c-4825-9bb4-f9bc27dc5466`, ray `a4b1a6436fc13ad3-DFW`:

| Measurement                       |    Time |
| --------------------------------- | ------: |
| Client time to first byte         | 3,271ms |
| Connection/TLS setup              |    84ms |
| Reported Cloudflare edge timing   | 2,467ms |
| Reported Cloudflare Worker timing |   673ms |
| Tail invocation wall time         |   681ms |
| Tail invocation CPU               |   370ms |
| Application headers-ready clock   |   317ms |

Worker wall time includes CPU and waiting, so its CPU row must not be added again. After connection setup, roughly 2.5 seconds remain outside the recorded invocation, including network overhead. The small-worker controls below show that ordinary request/response transport accounts for tens of milliseconds in this environment, rather than the multi-second difference.

The application recorded no database access, no origin content fetch, and no R2 read on this request. Its content came from the blob Cache API path. PostgreSQL and GitHub did not cause this spike.

The application's 317ms measurement is not a second wall-clock measurement. Deployed Worker clocks advance with I/O and cannot accurately time CPU-only phases. Its two initial content reads ran in parallel. The `content_edge_read` label also includes reading the cached response body, not just `cache.match`. These spans locate work, but do not prove that the entire interval was storage-service latency. [Cloudflare timer behavior](https://developers.cloudflare.com/workers/runtime-apis/performance/)

## Controlled proof of the pre-handler cost

Created eight isolated Workers with no production routes, database, application secrets, Durable Objects, or scheduled jobs. The basic probe returns `ok`, records an instance ID and invocation counter, and performs no cache/storage/network operation on `/noop`. All comparisons below used DFW, separate curl connections, and a half-second pause between requests.

The main timing removes connection setup: `time_starttransfer - time_pretransfer`. It still includes request/response network transit. "First" means the first observed handler invocation on that instance ID, which is a useful proxy rather than proof of a platform code-cache miss.

| Upload/control                                                  | Upload KiB | First-instance samples | Median time after connection | Median invocation CPU / wall |
| --------------------------------------------------------------- | ---------: | ---------------------: | ---------------------------: | ---------------------------: |
| Minimal probe                                                   |       1.36 |                     11 |                         83ms |                      0 / 1ms |
| Probe plus entire site upload, never imported                   |  26,263.71 |                      6 |                      1,114ms |                      0 / 0ms |
| Probe plus static import of actual app, without rendering       |  26,263.71 |                      8 |                      1,419ms |                      0 / 0ms |
| Site JavaScript bytes as one inert Data module, excluding WASM  |  22,615.06 |                     13 |                        315ms |                      0 / 1ms |
| Entire site JavaScript, with empty diagnostic WASM              |  22,617.00 |                     16 |                        897ms |                      0 / 1ms |
| Similar bytes as one inert JavaScript string module             |  23,239.25 |                     20 |                        527ms |                      0 / 0ms |
| Similar string data split across 1,000 JavaScript modules       |  23,256.81 |                     14 |                        441ms |                    0 / 0.5ms |
| Actual app rebundled into one JS module, original WASM retained |  26,244.80 |                      6 |                      1,085ms |                    0 / 0.5ms |

The never-imported row uses the second run, after initial workers.dev routing failures. Other controls pool their successful runs. Non-200 platform responses remain in the raw measurements but are excluded from latency summaries. Some newly created probes returned 1042 or 1104, including probes with no application execution. These were not production responses. The later repeat runs for the single-string and empty-WASM controls returned 200 throughout.

The same large never-imported Worker had a reused-instance median of 76ms after connection, close to the minimal Worker's 67ms. The roughly one-second cold penalty disappears when the instance is reused, despite identical response code and no data access.

### What the controls establish

- The production application upload itself causes substantial work before fetch dispatch. The probe can reproduce seconds of latency while the recorded invocation takes 0–2ms.
- Byte volume matters: even inert data adds cold latency. That Data control excludes the original WASM and is not an exact byte-for-byte match of the complete upload.
- Actual application JavaScript has more cold cost than similarly sized inert string/data controls. The platform is doing more than transmitting an equal number of bytes.
- The original OG WebAssembly payload is a contributor, but the JavaScript-only control remains slow. Replacing WASM is only a diagnostic experiment, not a usable application change.
- Module count alone does not explain the result. A thousand simple string modules were not slower than one large string module in these samples. Merging the actual app also left about a second of pre-handler delay.

These are small sequential samples on different Workers, not randomized additive estimates. The differences should not be summed into an exact per-feature budget. What is directly verified is the dependence on the complete uploaded code and the timing boundary before the application's handler. The experiments cannot separate Cloudflare's internal script retrieval, decoding, compilation, or isolate preparation into individual timers.

The reported deployment startup times ranged from 1–3ms for the synthetic probes to 35ms for the imported app and 87ms for the rebundle. Those figures did not predict the observed first-request delay. Treat deployment startup validation and real cold request latency as different measurements.

## What is in that upload

Source maps identify these large chunks. Sizes are uncompressed KiB from the source-mapped build, with a few extra bytes for map references:

| Chunk                       |   KiB | Source                                                                                                |
| --------------------------- | ----: | ----------------------------------------------------------------------------------------------------- |
| Iconography browser         | 3,715 | `src/routes/ds.iconography.lazy.tsx`, generated Phosphor registry, 2,592 source modules               |
| OG renderer WASM            | 3,647 | Takumi, reached from `src/server/og/generate.server.ts`                                               |
| AI starter template         | 1,855 | `@tanstack/create/dist/generated/worker/frameworks/react/add-ons/ai.js`, generated project files/data |
| TanChat app UI              | 1,204 | `src/chat/components/App.tsx` and its component dependencies                                          |
| Chat model runtime          |   990 | `src/chat/server/run-models.ts`, provider SDKs and attachment handling                                |
| Blog collection             |   822 | generated `allPosts`, `src/utils/blog.ts`, and formatting                                             |
| Conversation implementation |   673 | `src/chat/server/conversation.ts` and related code                                                    |
| Discovery integrations      |   578 | chat discovery/integration dependencies                                                               |

Most of this code is unrelated to rendering a docs page. The previous TanChat change correctly removed its implementation from the docs runtime import path, but the lazy chunks still ship as modules in the same Worker.

## The first docs render, after the platform loads the Worker

The actual-app probe returned valid docs pages. Three requests that both created a probe instance and rendered docs used 306–346ms of invocation CPU and 559–677ms of invocation wall time. The separate pre-handler delay was still present.

On the local production build with warm content storage, the first docs response took 135ms to headers, versus 24ms on repeat. Source-mapped CPU samples located work in:

- cached JSON parsing, especially `readStoredValue` in `src/utils/github-content-cache.server.ts`;
- partner sorting through `comparePartnerIdentity` and its first `localeCompare` calls;
- loading the complete generated blog collection;
- route manifest construction and runtime module initialization;
- React rendering, TanStack Redact traversal, serialization, and Tailwind class merging.

Examples of local sampled self time were about 8.5ms in cached JSON parsing, 7.4ms in partner comparison, and 5.4ms in blog module initialization. These samples identify functions, not production timings. The profiler also captures runtime/inspector work outside the HTTP interval, so its total sampled active time is not presented as request CPU.

The standalone binding probes were much smaller than the worst pre-handler delay: three Cache API miss operations took 6–33ms of recorded wall time, and three R2 HEAD miss operations took 111–130ms. These probes are not identical to reading populated docs cache bodies and cannot replace native traces for the actual hit path.

## What would address the cause

The next optimization needs to remove bytes and code from the docs-serving Worker upload. More dynamic imports inside the same upload do not address the demonstrated platform cost.

The largest candidates are moving the client-only icon catalog out of server output, serving generated project template data as assets, and putting OG generation and TanChat behind separate Worker boundaries. Splitting TanChat also needs a deliberate Durable Object namespace plan. Those are proposed follow-up changes, not deployed fixes from this investigation.

The monolithic rebundle is not recommended: its pre-handler delay persisted and its first docs renders used more CPU, reaching 854ms in this small sample.

For Cloudflare support, the exact remaining platform question is: which operations account for the gap between HTTP arrival and fetch dispatch when an unused 26MB code upload is attached? The minimal-vs-unimported reproduction avoids framework rendering and storage entirely. Exact internal attribution to code retrieval versus compilation requires platform telemetry beyond the exposed invocation records.

## Trace access and evidence

Production native Cloudflare tracing was disabled, although logs and the separate Sentry SDK were configured. Native tracing was enabled on the isolated probes. The native telemetry query endpoint returned 403 with the available credentials, so no native binding span breakdown is claimed. The production CPU profile API succeeded but selected an idle isolate and contained no useful execution samples. That profiler targets an already-loaded isolate and cannot directly profile the preceding load delay. [Cloudflare production profiling](https://developers.cloudflare.com/workers/observability/profiling-in-production/)

`worker-cold-start-measurements.json` contains 220 probe request records, version IDs, platform CPU/wall measurements, source rankings, and local CPU attribution. `docs-production-performance-measurements.json` contains the production request above. Archived probe and measurement templates are in `worker-cold-start-probes`.

No production code or cache settings were changed during this investigation. Temporary diagnostic Workers are removed after capture; cleanup results are recorded alongside the measurements.
