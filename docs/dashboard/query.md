# Query patterns in the dashboard

This audit applies the relevant advice from [TkDodo's Query series](https://tkdodo.eu/blog/practical-react-query)
and his Router integration posts to this read-only dashboard. It is not a claim
that every technique in those posts belongs in every application.

## Fetching and ownership

`query-options.ts` exports the options consumed by both the route loader and the
components. Request and result types are inferred from the validation and transport,
with no `UseQueryOptions` wrapper or caller-supplied result generic. See
[The Query Options API](https://tkdodo.eu/blog/the-query-options-api),
[Creating Query Abstractions](https://tkdodo.eu/blog/creating-query-abstractions), and
[Type-safe React Query](https://tkdodo.eu/blog/type-safe-react-query).

The route starts prefetching alongside its lazy component on entry and preload.
It uses the router's QueryClient, not a separate cache. Query owns freshness;
route preload freshness is zero. Components subscribe to the same options, so
prefetching and rendering share an in-flight request. The loader does not copy
results into loader data. See [TanStack Router and Query](https://tkdodo.eu/blog/tan-stack-router-and-query).

Both call sites validate through the same server request schema. The loader's
initial selection is empty, matching a newly mounted dashboard. Later text and
column-filter input is debounced for 200 ms before changing the query request;
paging, sorting, chart selections, and row selections are immediate. Stay loaders
skip prefetching so they cannot bypass that debounce. This is a deliberate
variation from putting all options in route context: row selection is component
state and draft filters have not settled yet. Keep initial loader and component
inputs aligned when adding request fields. See
[Reliable Query Prefetching with TanStack Router](https://tkdodo.eu/blog/reliable-query-prefetching-with-tanstack-router).

The server query key includes the dataset version, filters, sorting, grouping,
page, page size, detail ID, and row-selection descriptor. Selection IDs are sorted
so equivalent sets share a cache entry. Component kit, appearance, sizing, and
column visibility do not affect server data. The query function reads parameters
from its key and passes Query's AbortSignal to the transport. See
[Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) and
[Leveraging the Query Function Context](https://tkdodo.eu/blog/leveraging-the-query-function-context).

Server results are fresh for 30 seconds. The optional client mode fetches one
versioned, immutable snapshot with infinite stale time. Both keep Query's default
inactive-cache lifetime, focus/reconnect behavior, retries, and network mode.
Stale time controls refetching, not cache eviction. The snapshot fetch rejects
HTTP errors and validates JSON with Zod. See
[Practical React Query](https://tkdodo.eu/blog/practical-react-query) and
[React Query FAQs](https://tkdodo.eu/blog/react-query-fa-qs).

Query owns remote results. Router owns shareable search state. Table owns local
presentation state, and explicit row selection is local UI state. Server results
are never mirrored into React state. The optional client mode creates local DB
collections from the immutable snapshot for its live queries. See
[React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager),
[Thinking in React Query](https://tkdodo.eu/blog/thinking-in-react-query), and
[React Query and React Context](https://tkdodo.eu/blog/react-query-and-react-context).

## Loading, errors, and rendering

`keepPreviousData` is an observer placeholder during parameter changes, not seed
data for the next cache entry. Selection and export are disabled while displayed
results belong to an older request. A same-key background refresh keeps those
actions available. Cached results stay visible when a refresh fails, alongside
an error and retry action. With no data, the error replaces the initial loading
state. Paused requests distinguish an offline first load from cached offline
results. See [Status Checks](https://tkdodo.eu/blog/status-checks-in-react-query),
[Error Handling](https://tkdodo.eu/blog/react-query-error-handling),
[Placeholder and Initial Data](https://tkdodo.eu/blog/placeholder-and-initial-data-in-react-query),
[Seeding the Query Cache](https://tkdodo.eu/blog/seeding-the-query-cache), and
[Offline React Query](https://tkdodo.eu/blog/offline-react-query).

Query retains structural sharing and tracked result properties. Components read
the properties they use rather than spreading the entire observer result into
props. The server intentionally returns one coherent response for charts, totals,
facets, selection, and rows from a single database transaction. Splitting this into
separate queries would give up that consistency. Expensive aggregates run in SQL;
there is no extra client transformation stored in the cache. Add narrow `select`
subscriptions only if profiling identifies a consumer that benefits. See
[Data Transformations](https://tkdodo.eu/blog/react-query-data-transformations),
[Render Optimizations](https://tkdodo.eu/blog/react-query-render-optimizations),
[Selectors, Supercharged](https://tkdodo.eu/blog/react-query-selectors-supercharged), and
[Inside React Query](https://tkdodo.eu/blog/inside-react-query).

## Advice reserved for features that need it

| Topics in the series                                                                                      | Applicability here                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutations, mastering mutations, concurrent optimistic updates, automatic invalidation, mutation responses | No editable server records. If writes are added, define invalidation and concurrency behavior with those writes. CSV export is an imperative read. |
| Forms                                                                                                     | Filters are URL state, not an editable copy of a server entity.                                                                                    |
| WebSockets and subscriptions                                                                              | The versioned sample has no live event stream.                                                                                                     |
| Infinite queries and how infinite queries work                                                            | The server grid uses bounded pages and exact counts. Virtualizing a page does not require an infinite query.                                       |
| Suspense                                                                                                  | The route prefetches without blocking and the component explicitly handles pending, paused, placeholder, and error states with `useQuery`.         |
| TypeScript and API design lessons                                                                         | Infer from schemas and query functions, preserve discriminated result states, use v5 options rather than copying older version syntax.             |
| Why Query, tradeoffs, bad parts, and API design lessons                                                   | Query coordinates remote state. It does not replace SQL, local UI state, or Router state. No additional wrapper framework is needed.               |

## Verification

`tests/dashboard-query.test.ts` uses an isolated QueryClient per test and disables
retries in tests. It covers request-key dependencies, presentation-independent
keys, canonical selection sets, prefetch/consumer cache reuse, invalidation,
background failures retaining data, snapshot cancellation, and HTTP errors.
The SQL integration tests cover response correctness separately. See
[Testing React Query](https://tkdodo.eu/blog/testing-react-query).

The full check passed with 502 tests and one skip, including TypeScript and lint.
The production build passed and its client JavaScript contains no dashboard SQL
or database binding. Browser checks verified filtering updates charts and rows,
clearing a filter does not restore old selection, and server pagination works.
