# Worker deployment boundaries

The browser still uses one TanStack Start app and its existing route tree. One
Vite build produces five independent Cloudflare Worker uploads:

| Output          | Worker                   | Owns                                                                                   |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `dist/server`   | `tanstack-com`           | Pages, docs, assets, auth, Start server functions, site cron tasks                     |
| `dist/og`       | `tanstack-og`            | OG and README image generation, including Takumi WASM                                  |
| `dist/chat`     | `tanstack-chat`          | Chat HTTP handlers, model execution, Durable Objects, chat workflow and sync recovery  |
| `dist/starter`  | `tanstack-starter`       | Project generation, embedded templates, starter API and GitHub deployment              |
| `dist/recovery` | `tanstack-chat-recovery` | Preserved namespaces created by the failed deployment, with their real implementations |

Public URLs stay the same. The Start API routes forward the original Request
through service bindings, preserving cookies, origin, query parameters, bodies
and streamed responses. Each backend retains its existing authentication,
authorization, same-origin and rate-limit checks. Auxiliary Workers have no
public routes or workers.dev endpoints.

Implementation files stay with their features. Thin backend HTTP adapters live
under `src/chat/server/http` and `src/application-starter/api/http`. Their route
tables put specific paths before parameters and splats. `worker-boundaries.test.ts`
checks that their paths and methods match the public Start API routes.

The chat app, shared project workbenches, charts builder and icon browser use
Start's `createClientOnlyFn` around their lazy component imports. `ClientOnly`
alone does not remove a dependency from the server upload.

The production build checks both eager chat imports and every uploaded site
module, including lazy chunks. It fails if the extracted heavy implementations
return to the site upload. Six small provider templates remain with the site's
existing example deployment API.

## Development

`pnpm dev:cloudflare` starts the app and its auxiliary Workers together, using
local service bindings. The existing root `.env.local` is loaded by `with-env`.
The child configs declare their required secrets so Wrangler also reads them
from the inherited process environment. Hyperdrive is disabled in development,
as in the existing site config, and the local database URL is inherited from
`with-env`.

For a production build preview with local credentials, use:

```sh
pnpm build:cloudflare
pnpm with-env vite preview
```

## Deployment

```sh
pnpm build:cloudflare
pnpm deploy:cloudflare:workers
```

The deployment command publishes OG, starter, recovery, chat, then the site. It
validates every destination, account and resource binding before uploading,
checks required secrets, and preserves remote variables and secrets. The broader
local and CI commands still run the existing database preparation. CDN purging
is a separate explicit command.

Cloudflare Builds supplies `WRANGLER_CI_OVERRIDE_NAME` and
`WRANGLER_CI_MATCH_TAG` for its connected Worker. Wrangler overrides even an
explicit `--name` with that CI name. The script removes both variables from
sibling commands and retains them only for `tanstack-com`. A tagged deployment
also requires the matching `CLOUDFLARE_ACCOUNT_ID`, checked before any upload.

After uploading the site, the script checks the homepage and Query, Router and
Start documentation. A failed upload or page check restores the previous site
version and fails the build. Supporting Worker upload failures stop before the
site changes.

Provision declared secrets before deployment. Never put secret values in
Wrangler configs or Git. Routine deployments reject migrations and namespace
transfer declarations. Database schema preparation remains a separate step
before those uploads.

The active three chat namespaces and workflow belong to `tanstack-chat`. The
October 16 recovery transferred the three extra site namespaces left by the
failed deployment to `tanstack-chat-recovery`, preserving all namespace IDs.
The recovery Worker has no public endpoint or cron. It keeps real Durable Object
implementations and the existing cross-script chat bindings, including the
workflow binding. Do not delete it or replace its exports with empty classes.

The receiving Worker was prepared with `expecting-transfer`, the site committed
`transferred` declarations, then both sides removed their completed transfer
records. This was a supervised one-time operation, not a build side effect.
Subsequent deployments use live SQLite exports. Do not add `new_sqlite_classes`
for these existing namespaces.

The chat Worker owns workspace-sync recovery; the site keeps its other cron
work. The site no longer exports chat classes or owns Cloudflare workflow
bindings. Disposable Cloudflare tests verified namespace data and workflow continuity
through transfers, including requests between stages.

A rollback after transferring namespaces must retain the new namespace owner
and cross-script bindings, or explicitly transfer those namespaces back. Simply
deploying the old monolithic config is not a complete rollback plan.
