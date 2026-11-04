# Scarf server request tracking

The Cloudflare Worker sends `server_request` events to our existing Scarf
`site-events` collection after serving a successful GET of HTML, Markdown,
or an `llms.txt` / `llms-full.txt` document. This includes crawlers that never
execute JavaScript. The original visitor IP is forwarded in `X-Scarf-IP`,
and the original user agent is preserved for Scarf's bot classification.

Delivery runs through the existing Worker `waitUntil` helper, with a five-second
timeout and no retries. Failures do not delay or fail the page response. Logs
never include the visitor IP or the outgoing request.

## Counting

Filter the Scarf event collection by `event=server_request` and `source=worker`
for server traffic. `page`, `format`, and `status` describe the response.
Existing browser `page_view` events and per-product pixels are unchanged.

`traffic_type` uses Cloudflare's request metadata when available:
`verified_bot`, `suspected_bot` (score 1–29), `likely_human` (score 30–99),
or `unknown` (missing or uncomputed signals). Availability depends on the
Cloudflare plan. These are classifications, not proof of a human or a company.

These are separate measurements, not disjoint sets of visitors. A browser's
initial page request produces a server event and can also produce a browser
event and pixel. Do not sum these counts as users or visits. This implementation
does not depend on Scarf deduplicating across event types or pixels, and does
not claim to deduplicate people by IP. SPA navigations may produce browser
events without a server document request.

Scarf recognizes known bot user agents. Confirm that the organization's bot
exclusion setting is off if bot events should be retained, and verify with
Scarf whether the dashboard supports a bot-only view. No absence of JavaScript
or browser headers is treated as proof of a bot.

## Coverage and rollout

Only production builds serving `tanstack.com` with a Cloudflare client IP are
eligible. DNT and GPC opt-outs are skipped. Query strings, cookies, request
bodies, and authorization headers are not forwarded. Account, auth, admin,
chat, builder project, API, and internal analytics paths are excluded.
Assets, redirects, and failed responses are excluded too.

This measures content responses reaching the Worker. Cloudflare requests
blocked or served before this entry point will not appear. It is not a
replacement for Cloudflare's total request count or a historical log import.

After deployment, verify `server_request` events in Scarf using normal site
traffic, including an HTML page and Markdown docs. Check the original user
agent is retained, bot filtering is configured as intended, and browser
page-view/pixel counts have not gained a second emission. Live dashboard
verification is required to confirm ingestion and filtering.

References: [Scarf Gateway](https://docs.scarf.sh/gateway/),
[bot filtering](https://docs.scarf.sh/user_best_practices/#excluding-all-known-bot-traffic).
