# Live visitors

`/admin/live` shows anonymous browser sessions on public content pages. Only users
with the `admin` capability can read presence, including through its server
function. Admin queries refresh every three seconds while the page is visible.

The dashboard opens with a company grid. Individual sessions are hidden until
a company is expanded, and each session has its own expandable tabs and activity.
Unmatched traffic stays in one collapsed row at the bottom. Columns support
sorting, and search matches companies, industries, libraries, and page paths.

The overview counts identified companies once per domain. Library breakdowns
count a company once per library, so one company can appear in several bars.
Industry breakdowns exclude unmatched traffic. The company trend records real
polling snapshots in the open dashboard tab, up to five minutes, and resets on
reload. Grid action totals count named interactions in the last five minutes,
excluding page views.

## Enable the experiment

1. Apply migration `0042_live_visitors` through the normal database migration flow.
2. Obtain TanStack's lookup-only key from Scarf and configure the site's server
   secret `SCARF_LOOKUP_KEY`. The personal bearer token in Scarf settings is not
   this key. Presence works without the key, but companies stay unknown.
3. Set `LIVE_VISITORS_ENABLED` to `true` in the site's Worker configuration and
   deploy through the normal release flow. The production configuration enables it.
4. Verify two tabs share one session, page changes and selected actions appear,
   closing one tab keeps the other active, and closing the last removes presence.
   Test a known company network and an unknown network to verify matching.

Turn collection off with `LIVE_VISITORS_ENABLED=false`. The existing minute
schedule continues deleting old records. This feature does not modify existing
Scarf or GA event delivery.

## Presence and retention

The production browser sends updates to `/_a/live` every 20 seconds, on public
page navigation, on visibility changes, and on selected actions. Each document
gets a random tab ID; a shared first-party cookie groups tabs into a session.
The cookie expires after 30 minutes without renewal. Sessions also rotate at
24 hours. Cookies blocked by the browser prevent collection.

A best-effort `pagehide` beacon closes the tab. Missing heartbeats expire presence
after 65 seconds. Background tabs can be suspended, so this is recent browser
contact, not proof that a person is looking at the page. `pageshow` handles
restoration from the browser's back/forward cache. Sequence numbers prevent a
late heartbeat or departure from overwriting newer tab state.

Each tab retains up to 40 named actions. The admin includes departures from the
last five minutes when requested and returns at most 500 recently seen tabs,
with a visible truncation notice. Sessions disappear from reads at 24 hours and
are deleted, with their tabs, on the next minute cleanup.

## Company lookup

The server calls:

`GET https://api.scarf.sh/v3/organizations/TanStack/ip-company?ip=...`

Authentication uses `X-Scarf-Lookup-Key`. The IP comes only from Cloudflare's
`cf-connecting-ip`, never the browser payload. Omitting `ip` would identify the
server instead of the visitor. The lookup runs once per new session, after the
presence write, with a three-second timeout. Later heartbeats do not call Scarf.
Matches describe the network at session arrival, not verified employment.

The response contains `company`, either null or an object with `name`, `domain`,
`industry`, `company_size`, and `linkedin_url`. There is no confidence field.
`company: null` means there is no usable cached vendor result within 365 days.
The lookup does not trigger enrichment, refreshes, or background jobs. A failed
lookup has its own status and does not remove presence. No immediate retries
are made, including for 429 responses, to avoid increasing quota pressure.

Avi confirmed the endpoint and TanStack's rate limit in Discord on October 28, 2026. The account and organization settings exposed only the personal API token
when inspected; the lookup key is issued separately during opt-in.

[Scarf API contract](https://api-docs.scarf.sh/v2.html#tag/Company-lookup/operation/lookup_ip_company)

## Data boundaries

The collector checks origin, method, body size, IDs, paths, and named actions.
DNT and GPC prevent collection in both the browser and server. Browser collection
is disabled in development, staging, and outside `tanstack.com`.

`isLivePage` allows public library content and selected public site routes.
Account, admin, auth, chat, private builder projects, shop, and internal endpoints
are excluded. Unknown paths are excluded until added to the public allowlist.
Queries, fragments, clipboard text, form values, event properties, account IDs,
emails, and user agents are not stored. Only explicitly named actions from the
existing analytics hooks are collected; there is no arbitrary click-text capture.

Visitor IPs exist only during the server-side lookup and are not written to the
presence tables or admin responses. Lookup tracing and Sentry breadcrumbs are
suppressed to keep IP query parameters out of telemetry. The lookup key stays
server-side. There is no joining sessions by IP, fingerprint, or login.

## Validation

Focused tests cover privacy signals, intake validation, public-route boundaries,
multiple tabs, departures, restoration, session rotation, and the Scarf contract.
The component was inspected in the browser with explicit test sessions, including
company grouping, an unknown company, filtering, departures, and activity details.

Production was enabled on October 29, 2026. The authenticated admin portal,
real presence writes, page-view activity, recorded departures, and live Scarf
company matches were verified after deployment. Scarf lookups can still time out
or fail; these sessions remain visible with a separate lookup status. Local
admin access requires a current dev login.
