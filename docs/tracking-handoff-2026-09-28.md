# Tracking handoff audit, September 28, 2026

## Step 1: GA4 page views

The reported navigation regression did not reproduce on the live site. Chrome DevTools showed one `page_view` in `dataLayer` and a corresponding GA collection request returning HTTP 204 for each of these visits, including navigation without a full reload:

- `/`
- `/blog`
- `/query/latest`
- `/query/latest/docs/framework/react/overview`
- `/query/latest/docs/framework/react/installation`
- `/query/latest/docs/framework/react/quick-start`

No GA4 application change is warranted by these results. HTTP 204 confirms that the collection endpoint accepted the request, not that GA4 processed it into a report. GA4 DebugView and the post-deploy BigQuery ratio have not been verified.

Commit `b7c3ba5223ca6987d7b78ca2b6160c596688bfc6`, committed September 24 at 19:40:55 UTC, changed page-view counting intentionally:

- It added an idempotent bootstrap guard to prevent repeated GA configuration and script loading.
- It set `send_page_view: false`, replacing automatic initial views with the existing React page-view tracker.
- It changed that tracker from skipping its first effect to sending an initial view and suppressing consecutive identical paths.
- It documented that GA4 Enhanced Measurement browser-history page changes must be disabled when manual navigation tracking is enabled.

Before that change, config-generated initial views and manual navigation views could overlap with duplicate bootstrap execution or GA4 browser-history tracking. Removing those duplicates could reduce reported volume. Repository history does not prove how many duplicates occurred, the GA4 stream's historical settings, or the exact production deployment time. The September 25 drop therefore remains a reporting investigation, not a reproduced navigation failure. Jonny should compare event counts and stream settings around the deployment before treating the old 6 to 7 views per user as a required baseline.

Relevant files: `src/routes/__root.tsx`, `src/utils/analytics.ts`, `src/utils/analytics/providers/google.ts`, `.agents/analytics.md`.

## Step 5: Partner parameter security review

### Where values originate

The site's partner click handlers take `partner_id` and `partner_tier` from the source-controlled catalog in `src/utils/partners.tsx`. Placements come from component props supplied by application code or string literals. Destinations are the fixed values `external`, `internal_detail`, and `internal_resource`. Destination hosts come from configured partner/resource URLs. `page_type` is calculated from `window.location.pathname` using a fixed set of return values in `src/utils/analytics.ts`.

The `/partners/$partner` route does accept a path parameter, but resolves it through `findPartnerForPage` and `getPartnerById`, which perform an in-memory lookup in that catalog. Unknown IDs produce a not-found response. The click event uses the matched catalog object's ID, not the raw URL parameter. Directory search filters do not supply the reported click fields.

Reviewed click callers include `PartnersGrid`, `PartnerRail`, `LibraryLayout`, `StartHostingPartners`, `IslandInfo3D`, the partner directory, the generic partner detail route, and the Render, Railway, and Netlify detail routes. None reads these click fields directly from query strings, forms, or request bodies.

### Server and database path

GA4 events do reach TanStack's server. The GA configuration uses `transport_url` with the same-origin `/_a` prefix. `proxyAnalyticsRequest` in `src/server.ts` receives `/_a/g/collect` and forwards its query string and body to the fixed upstream `https://www.google-analytics.com/g/collect`.

That proxy does not interpolate event fields into SQL, execute them, or write them to a TanStack database. Its response returns before the application route handler runs. The surrounding `runWithDatabaseContext` establishes lazy request context, but does not itself execute a query. No server-side partner-click persistence or database consumer was found. Request diagnostics record the request pathname and status, not partner event parameters.

The collection proxy currently does not validate partner fields against a runtime allowlist. TypeScript types constrain application call sites, but do not validate a direct HTTP request from a scanner. A scanner can submit forged analytics payloads to the public proxy or directly to Google's public collection endpoint. Strings such as `sleep(15)` in GA4 are therefore consistent with analytics pollution; their presence alone does not establish SQL execution or identify the scanner's entry point.

The reviewed path has no SQL sink requiring parameterization. This is a scoped review of partner event data flow, not a full application penetration test. Runtime allowlists can improve the quality of events sent by the app; filtering suspect events in reporting is still necessary because a client-side check cannot authenticate public analytics collection requests.

## Step 6: Privacy review

The current policy in `src/routes/privacy.tsx`, effective September 28, already names Scarf, page views, external link clicks, downloads, and copy/paste collection. It also describes sharing with analytics service providers. This covers the general activity involved in outbound partner tracking.

Per the final scope, no per-partner Scarf pixels are installed. The policy now also lists hover intent among the actions sent to Scarf. The existing namethathost.com description should not be treated as a description of Scarf's processing.

This is a review of the policy's wording against the implementation, not a determination of legal compliance. The existing copy/paste feature can transmit user-provided text, so a general statement that all tracking is non-personal data would not match the implementation.

## Verification still needed

- Jonny's GA4 DebugView and BigQuery checks, including comparison of stream settings and the deployment window around September 25.
- Production verification of the new Scarf pixel IDs and placements after deployment.
- The actual production deployment timestamp in UTC and the final pixel-name-to-ID list for Jonny.

## Implementation scope

Scarf page pixels cover the home page, all 18 publicly listed libraries, and Application Starter, Builder, NPM Stats, and Intent Registry. Existing Ranger tracking remains. Hidden MCP and Workflow have no new pixels. The shared library route covers landing pages and docs; resolved navigation and a fresh cache-busting UUID prevent cross-library attribution and cached Back visits.

The existing site-events endpoint also receives `external_link_hover_intent` after 350 ms over an external HTTP(S) link. Moving within a link does not duplicate the event. Leaving, changing pages, backgrounding, or removing the link cancels it. The payload contains the page path and destination origin/path, with destination query strings and fragments omitted.

Partner click pixels were excluded by Tanner's scope correction. None is installed in this change. The 13 accidentally created dashboard pixels are awaiting explicit permanent-deletion confirmation, required by automatic approval review.

## New page pixels

| Pixel name                       | ID                                   |
| -------------------------------- | ------------------------------------ |
| Home Page                        | b7a8c111-2305-4d95-a02a-d84c5bfb82ae |
| Docs – DB                        | 893a4852-11b6-4138-8206-7f06a11591e4 |
| Docs – Pacer                     | 4f87da04-9555-4078-bea5-097562fda71a |
| tanstack.com/charts              | aa0a3a1f-ffb1-4a50-b57f-c904dfc003d6 |
| tanstack.com/hotkeys             | 1bd669b3-a148-4551-967f-1b9d2c971a2c |
| tanstack.com/markdown            | bcf17c55-0fa4-4bcb-be21-823711b0b7fd |
| tanstack.com/highlight           | 755a8d7a-458b-421d-aef3-dc85437ac0bd |
| tanstack.com/ai                  | c627cc8f-28a1-4b5d-bd13-9142a7fb4172 |
| tanstack.com/intent              | 9a861dfa-93fb-4472-b462-2cdadbe3a717 |
| tanstack.com/config              | 6e4c7302-6e7d-45ec-b963-9ac66c70c6b2 |
| tanstack.com/devtools            | 9383bf22-a41e-477f-8dc2-fca9d2a201b7 |
| tanstack.com/cli                 | a1a4961c-5b37-43eb-a6fc-7e4825fbe83b |
| tanstack.com/application-starter | ed471ec3-aa08-430f-8481-258b3a1f94dc |
| tanstack.com/builder             | aa4dcee9-86a2-49b4-9981-40c97cc1f55b |
| tanstack.com/stats/npm           | e729f879-e127-48e1-be19-c68f6786c9e8 |
| tanstack.com/intent/registry     | 811c34af-38bd-4f06-9762-3f58dea0650a |

DB and Pacer retain the names from the handoff, but their pixels cover landing pages as well as docs.

## Local validation

- Full `pnpm test`: passed, 525 tests passed and 3 skipped; TypeScript passed; lint reported one existing warning in `src/utils/repo-path.ts`.
- Added a catalog check requiring a pixel for every public library and preventing duplicate library pixel IDs. Targeted test passed.
- Browser: home renders only the Home Page pixel; Query landing and docs render only Query; navigating Back creates a fresh URL; DB and Pacer each render their own pixel; NPM Stats, Intent Registry, Builder, and Application Starter each use their product pixel.
- Hover tracking passed 13 targeted event/timer scenarios, including child movement, leave-before-delay, navigation, backgrounding, removed links, and cleanup.
