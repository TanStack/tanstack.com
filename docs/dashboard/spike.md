# Taxi dashboard

Server mode is now the default. Follow [server setup](./server.md), then open `/examples/dashboard`. The current preview is
[localhost:3211](http://127.0.0.1:3211/examples/dashboard). Nothing is deployed.

The sections below record the client spike and its earlier validation.
[Server mode](./server.md) documents the current default, database setup, and query ownership.

## The experience

The overview brings together hourly trip volume, ranked pickup zones, time-of-day
and duration distributions, four summary metrics, and virtualized trip records.
Selecting a record opens details beside the table. The layout has its own navigation
and uses the site's supported `showNavbar: false` route setting.

Day and zone selections link the views. The trend ignores its own day filter, and
the zone ranking ignores its own zone filter, so alternatives remain available.
The distributions, metrics, and table apply every filter. Changing borough clears
the zone filter. A selected record remains available even outside the current
filters, with that distinction shown beside its details.

Filters, selected trip, component kit, and appearance live in Router search params.
Back and forward restore them. The custom integration uses native HTML. The lazy
Material UI integration supplies actual Select, Button, Paper, Table, TableHead,
TableBody, TableRow, and TableCell components across the same layout. Both share
the same analytical model and preserve selection. Appearance is independent.
MUI's provider and portal host stay inside the dashboard; no CssBaseline is mounted.

## Data and ownership

[NYC TLC source](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).
The static snapshot contains 8,936 green taxi trips from January 1–7, 2025.
`public/data/dashboard/manifest.json` records hashes, inclusion rules, and independent
reference totals. IDs are one-based source rows, not TLC trip identifiers. There is
no sampling or deduplication. Times retain NYC wall time. Base fares are integer
cents, excluding tips, taxes, and surcharges.

To reproduce, download the January 2025 green taxi Parquet and taxi zone CSV linked
in `scripts/dashboard/prepare.py`, install `pyarrow==25.0.1`, then run:

```sh
python scripts/dashboard/prepare.py green_tripdata_2025-01.parquet taxi_zone_lookup.csv
```

In client mode, Query owns one versioned snapshot cache with infinite stale time and a five-minute
inactive lifetime. Fetch consumes Query's AbortSignal; Zod validates at the boundary.
Client filters never change the snapshot query key. Server filters are part of the
server query key, as described in [Query patterns](./query.md). Route-owned DB collections join pickup zones
and apply the borough filter. An effect releases both collections on unmount.
The contract test verifies every trip's pickup zone exists before the inner join.

`model.ts` owns the pure aggregations. `Charts.tsx` defines charts with public APIs.
Table v9 owns rows and columns, Virtual limits rendered rows, and the existing
Resizable component handles trend height. `ui.tsx` defines the small shared component
contract; `MaterialSkin.tsx` implements it with MUI. Add metrics to the model and
reconcile against source records before adding a view.

## Verification

- `pnpm test`: 485 passed, one skipped, with clean type and lint checks.
- `pnpm build`: passed, including the lazy component integration.
- Five dashboard tests cover snapshot hashes, reference totals, joins, every
  borough/day count, empty slices, invalid URL values, collection cleanup, and
  reconciliation of the trend, hourly bins, duration bins, and linked zone selection.
- `scripts/dashboard/check-browser.mjs`: passed at 1440, 1024, and 390 pixels.
  Checks include chart selection, day/zone filters, totals, history, selected records
  across kits, actual MUI components, both appearances, resizing, and empty results.
  The snapshot was requested once across the sequence; no browser errors occurred.

Run the browser check against a local preview:

```sh
DASHBOARD_URL=http://127.0.0.1:3211/examples/dashboard node scripts/dashboard/check-browser.mjs
```

`CHROME_PATH` selects a different Chrome executable. The script writes screenshots
and `/tmp/dashboard-redesign-results.json`. The saved result is `redesign-results.json`.

## Findings and limits

The original route import cycle failed server import protection. Using `getRouteApi`
in the lazy dashboard resolved it. The implementation uses current Table v9 and
structured DB query APIs without casts.

The earlier modal probe found that MUI 9.4.0 did not restore focus to its trigger.
The redesign uses inline record details for both kits. It does not claim an upstream
modal fix; reproduce and resolve that issue before reintroducing dialogs.

The snapshot is 1,155,731 bytes raw and 166,638 bytes with gzip. `browser-results.json`
contains measurements from the original, smaller spike, not the redesigned views.
Those measurements included the site shell and development tooling, so they are not
isolated dataset memory or phone benchmarks. Production performance on a real phone
and a larger snapshot remains unmeasured. Query and DB retain separate representations;
compare the Query collection adapter before scaling the dataset.

Comparisons and a bounded builder remain future work.
The current slice establishes a useful layout and linked analytical model first.

### Material menu visibility regression

Redact 0.0.21 attached callback refs after layout effects. MUI Grow's layout
measurement therefore received a null node and threw before leaving the exited
state, keeping each menu at opacity 0. Accessibility selection alone did not
catch this because the transparent options were still in the DOM.

The version-pinned pnpm patch separates insertion effects from layout effects
and attaches callback refs between those phases. It includes the source change
and two regression tests. Insertion effects still prepare event callbacks and
styles before refs run. The browser check now requires full menu opacity before
selecting an option in each of the four Material controls.

Validation against an isolated copy of Redact's existing tests: 207 existing
passes preserved, two new regressions fixed, and three unchanged baseline
failures in mixed client/server hooks and the edge-server Vite alias test. An
isolated MUI Grow reproduction changed from opacity 0 with null-node measurement
errors to opacity 1 with no errors.

Verified in the in-app browser after restarting Vite with the patched runtime:
all four menus reached opacity 1, day and borough selections returned 921 and
230 trips respectively, appearance switched to dark, and switching to Custom
preserved the filtered count. Keyboard ArrowDown opened the day menu and Escape
removed it. The final view was restored to Material, light, and all 8,936 trips.
No browser errors were recorded. `pnpm test` passed with 485 tests and one skip,
including type and lint checks.

### shadcn / Base UI variant

`kit=shadcn` lazy-loads a third component skin. Its select composition follows
shadcn/ui's Base UI registry, with example-local styling, existing Phosphor
icons, and the upstream MIT license retained beside this document. Selects and
buttons use `@base-ui/react`; cards and tables use shadcn's native HTML pattern.
There is no separate unstyled Base UI mode in this spike.

The same URL, collections, charts, filters, and selected trip are shared across
all three kits. Verified in the in-app browser: all four dropdowns, light/dark
appearance, day and borough totals (921 and 230), switching to Material while
preserving those filters, ArrowDown opening, Escape dismissal, and focus return.
TypeScript and targeted lint checks passed. The browser regression script also
covers the new kit's selections, visibility, keyboard behavior, and state.

### Shared chart motion and data grid

All application Chart components now use `src/components/charts/Chart.tsx`.
It configures the Charts motion renderer once with a spring (stiffness 170,
damping 26, mass 1) and respects the user's reduced-motion preference. This
covers dashboard, npm stats, time-series, and Intent charts. Authored example
source strings and static SVG exports retain their own rendering code.
Dashboard marks have stable keys so filter changes interpolate existing marks.

The record grid uses Table v9 features directly, following the
[TanStack feature guides](https://tanstack.com/table/latest/docs/guide/features)
and the filtering, selection, and pinning patterns documented by Kevin Vandy's
[Material React Table](https://www.material-react-table.com/docs/guides/column-filtering).
The same controller survives switches between Custom, Material, and shadcn.

- Global search, per-column text filters, faceted borough choices, and numeric ranges.
- Numeric sorting on raw values, with Shift-click multi-column sorting.
- Column visibility, ordering, left/right pinning, and pointer or keyboard resizing.
- Grouping by borough, pickup zone, or day, with expandable rows, average duration,
  and summed miles and fares.
- Stable row selection, page selection, select-all-filtered, and selection totals.
- Filtered or selected CSV export with escaped fields and dollar amounts.
- Pagination or continuous virtualization, three densities, sticky headers,
  and a full-screen control where the browser supports the Fullscreen API.

The TLC snapshot remains read-only. Grid configuration lasts for the mounted
page and kit switches; it is not saved across a reload. Column order uses
accessible buttons rather than drag handles. There is no row pinning or editing.

Six additional tests cover sorting before pagination, combined filters and
facets, grouping totals, stable selection, column state, and CSV escaping.
Browser checks covered reset, grouping and expansion, preserved kit state,
pagination, continuous virtualization, density, and keyboard resizing. A day
change produced 80 live motion-marked SVG elements, confirming the shared
renderer animates updates. Native full-screen behavior could not be verified through the in-app browser.
The control is gated on the browser's Fullscreen API capability.

Final validation: `pnpm test` passed with 491 tests and one skip, including
TypeScript and lint checks. `pnpm build` passed. The npm stats page rendered
312 keyed chart elements with no browser errors after adopting the shared renderer.
