# Share TanStack login with Source

TanStack.com is the authorization server for Source browser login and MCP clients. Source owns its accounts and repository permissions, and links them to the stable TanStack user ID. An email match never links an existing Source account. A verified GitHub ID shared by both products can connect a TanStack login to the existing Source GitHub account. Conflicting Source account links require a person to resolve them.

## Enable the integration

1. Apply `drizzle/migrations/0044_shared_oauth.sql` with the normal database migration command. It adds resource and refresh-grant fields, and widens OAuth client IDs to text. Existing OAuth records keep their null resource and their current behavior. Do not use `db:push` against production.
2. Generate a random 32-byte secret and configure the same `TANSTACK_SOURCE_INTROSPECTION_SECRET` in TanStack.com and the Source Worker. Keep it out of browser configuration and source control. Only the Source server can introspect Source grants.
3. Deploy TanStack.com before enabling the Source integration. Source also needs its D1 migration `0045_tanstack_identity.sql`.
4. Sign into the existing Source account, then connect TanStack in Settings > Connected accounts. New people choose Continue with TanStack and pick a Source username. No existing account or organization membership moves.
5. Add `https://source.tanstack.com/mcp` to an OAuth-capable MCP client. Discovery points to TanStack.com. Consent identifies the app and its Source permissions.

The shared OAuth SQL was first deployed as 0043_shared_oauth. The combined
history numbers it 0044 while preserving its exact SQL and applied timestamp,
so existing production databases recognize it as already applied.

## Grant boundaries

- `https://tanstack.com/oauth/userinfo`, scope `identity`: returns the stable account ID, name, email and suggested username. The preregistered public client `tanstack-source` has exactly one redirect, `https://source.tanstack.com/auth/tanstack/callback`. PKCE and browser state bind the login. This is OAuth identity lookup, not OpenID Connect.
- `https://source.tanstack.com/mcp`, scope `source`: lets the client act as the linked Source person at `/mcp`. It grants no extra repository permissions, and never works at Source REST, git or browser-session endpoints. The consent page links to Source account setup before approval.
- Existing null-resource `api` grants continue to work. New grants for `https://tanstack.com/mcp` work on the existing TanStack API, with scope `api`.

Codes are single-use and bound to the client, redirect, PKCE challenge and resource. Access tokens expire in one hour. Resource-bound refresh tokens rotate, expire 30 days after the original grant, and revoke the whole grant on replay. Revocation is available through `/oauth/revoke` and TanStack connected apps. Source introspects each request, so revocation takes effect on the next request.

Existing personal API keys, legacy OAuth access tokens and refresh tokens stay valid. Source personal, agent and job tokens keep their existing policy and storage paths.

## Validate without production data

Run the pure tests with:

```sh
pnpm exec vitest run --config vitest.chat.config.ts harness-tests/core/shared-oauth.test.ts
```

The database tests require an isolated local PostgreSQL database named `shared_oauth_test` on `127.0.0.1`. They create, truncate and drop only their fixture tables. Never point them at a real application database.

```sh
OAUTH_TEST_DATABASE_URL=postgres://oauth_test@127.0.0.1:55439/shared_oauth_test pnpm exec vitest run --config vitest.chat.config.ts harness-tests/core/shared-oauth-db.test.ts
```

The implementation follows [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), RFC 9728 resource metadata, RFC 8414 discovery, RFC 8707 resource indicators and RFC 9207 issuer responses. Dynamic registration supports existing MCP clients. Client ID metadata documents are not advertised.

## Show the current TanStack account on Source

`GET /oauth/session-hint` uses the existing TanStack browser session and allows credentialed CORS only from `https://source.tanstack.com`. It returns a display name and avatar URL, never an access token, session cookie or account ID. Signed-out requests return no account. Responses are private and never cached.

Source fetches the hint in the browser and shows the avatar with **Continue as [name] on TanStack**. If the hint is unavailable, Source shows **Continue with TanStack**. GitHub remains a separate sign-in choice. Both TanStack buttons begin the same PKCE OAuth flow. The hint grants no access and is not used to link accounts.

The authenticated `/oauth/userinfo` response includes `github_id`, taken from the GitHub account attached to the authenticated TanStack user. Source uses this verified provider ID in browser sign-in and MCP authentication to find the same Source person, including when the emails differ. This field is never taken from the session hint or browser input.

Source resolves the MCP caller from an existing TanStack identity link or an unambiguous verified GitHub identity. Authentication reads do not create links or accounts. Conflicting Source links are refused. If a TanStack account has more than one GitHub identity, no automatic GitHub match is offered.
