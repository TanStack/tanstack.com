# Table patterns in the dashboard

Reviewed against Kevin Van Cott's (KevinVandy) Table v9 announcements, the current
Table state guide, and Material React Table's guides and examples. MRT v3 examples
use older Table APIs, so this implementation carries their behavior into v9 rather
than copying their hook signatures. This is an audit of relevant patterns, not a
claim that every optional MRT feature is enabled.

## State and rendering

- `grid.ts` declares the features, row models, sort/filter functions, aggregates,
  and columns once. Data comes from Query or memoized client analysis. It is not
  transformed inline in the `data` option.
- Router controls filters, sorting, grouping, and pagination. Every controlled
  slice has a matching change callback; callbacks handle value and functional
  updates. Those slices are not also initialized in `initialState`.
- Column sizing, visibility, order, pinning, and expansion stay in Table. Density
  and toolbar visibility are local UI state. High-frequency resize state does not
  enter the URL or trigger a database query.
- Reset grid resets query state and local presentation, expansion, and selection.
  Previously, controlled mode left column customization and local selection behind.
- The feature registry includes client processing because this example offers
  both server and client modes. A server-only derivative can remove unused client
  row-model factories. A shared registry does not mean the server page is processed
  again on the client.

Sources: [Kevin's v9 announcement](https://tanstack.com/blog/announcing-tanstack-table-v9),
[Inside v9 Reactivity](https://tanstack.com/blog/tanstack-table-v9-reactivity),
[Table state](https://tanstack.com/table/latest/docs/framework/react/guide/table-state),
[MRT state management](https://www.material-react-table.com/docs/guides/state-management),
[MRT memoization](https://www.material-react-table.com/docs/guides/memoization).

## Remote data and selection

Server mode uses manual filtering, sorting, grouping, and pagination with the
server's row count. SQL processes the full matching dataset before paging and adds
a stable trip-ID sort tie-breaker. Text/range input is debounced, Query preserves
previous results, and errors have retry actions. See [Query patterns](./query.md).

Trip IDs, not row indexes, identify records and virtual items. Client selection
uses Table's filtered selected model. Server selection uses explicit IDs or an
all-matching descriptor with excluded IDs, and server-calculated counts and totals.
It does not mistake the selected rows loaded on one page for the full selection.
Changing filter scope clears server selection. Group rows are not selectable trips.

Exports use all filtered or selected records, independent of the visible virtual
window or page. Server CSV streaming is described in [server setup](./server.md).

Sources: [MRT Query example](https://www.material-react-table.com/docs/examples/react-query),
[pagination](https://www.material-react-table.com/docs/guides/pagination),
[row selection](https://www.material-react-table.com/docs/guides/row-selection),
[CSV export](https://www.material-react-table.com/docs/examples/export-csv).

## Grid interactions

| Capability            | Implementation                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Sorting               | Typed numeric/text accessors, multi-sort with visible priority, URL state.                                                   |
| Filtering             | Global text, per-column text/ranges, borough facets, clear/reset actions.                                                    |
| Grouping              | Client expansion with sums/means; server group pages with drill-down to records.                                             |
| Columns               | Visibility, order buttons, sticky pinning, bounded resizing, double-click reset.                                             |
| Density and scrolling | Three row heights; virtual measurements update when density changes. Client continuous scrolling is optional.                |
| Selection             | Page checkboxes, mixed state, selected totals, all-matching server selection, selection export.                              |
| Record details        | Trip-ID button opens the selected trip, also reflected in the URL.                                                           |
| Loading               | Query owns initial loading, background refresh, offline and error states. Actions using stale placeholder rows are disabled. |
| Accessibility         | Semantic tables, labeled controls, native keyboard activation, focusable scrolling, keyboard resizing, indexed virtual rows. |

The client table now reports its full pre-pagination row count and the correct
page offset for accessible row indexes, matching server mode. The header is row 1;
hidden virtual spacer rows are excluded. Home resets a resize handle without also
scrolling the page.

Sources: [MRT accessibility](https://www.material-react-table.com/docs/guides/accessibility),
[virtualization](https://www.material-react-table.com/docs/guides/virtualization),
[column resizing](https://www.material-react-table.com/docs/guides/column-resizing).

## Deliberate limits

The dataset is read-only, so editing, CRUD row actions, and optimistic updates have
no data operation to implement. Row dragging would conflict with server-defined
sort order. Eight data columns do not justify column virtualization. Range selection, row pinning, and clipboard actions remain additional
interaction features for workflows that need them.

Cells support arrow keys, Home/End, Ctrl/Cmd+Home/End, and Page Up/Down.
Navigation scrolls unmounted virtual rows into view before restoring focus. Enter
and Space activate the cell's button or checkbox, while nested inputs retain their
native keys. Page navigation buttons retain focus when data changes. Navigation
uses each row's visible cells, including pinning and grouping order. The table
retains native table semantics, with ordinary Tab navigation through controls.
Keyboard and semantic browser checks do not constitute screen-reader certification;
manual VoiceOver/NVDA testing remains a release validation step.

Avoid blanket row/body memoization, which can freeze density, selection, and
virtualization. Fine-grained v9 subscriptions should be introduced where profiling
shows a rendering bottleneck. No million-row or 60-fps performance claim is made
from the small sample dataset.

## Verification

`tests/dashboard-grid.test.ts` covers full-dataset sorting/filtering/faceting,
grouping, stable selection, composing pinned/hidden columns, CSV escaping, page
identity, and functional controlled search updates. The SQL tests separately cover
server pages, aggregates, grouping, and selection across unloaded pages.

After this audit, `pnpm test` passed with 504 tests and one skip, including
TypeScript and lint. Material UI browser checks verified reset after resizing and
selection, server pagination, and client page 2 reporting 231 total rows including
the header, with data starting at accessible row index 52.

The expanded `dashboard:test:browser` script verifies keyboard movement to unmounted
rows, page indexes, reset, grouping, filtering, CSV downloads, and page errors across
all three kits and both data modes. It also checks initial request failure/retry
and cached offline/reconnection behavior. After this work the full suite passes
506 tests with one skip.
