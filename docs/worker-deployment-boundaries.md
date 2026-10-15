# Worker deployment boundaries

The browser still uses one TanStack Start app and its existing route tree. One
Vite build produces four independent Cloudflare Worker uploads:

| Output         | Worker             | Owns                                                                                  |
| -------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `dist/server`  | `tanstack-com`     | Pages, docs, assets, auth, Start server functions, site cron tasks                    |
| `dist/og`      | `tanstack-og`      | OG and README image generation, including Takumi WASM                                 |
| `dist/chat`    | `tanstack-chat`    | Chat HTTP handlers, model execution, Durable Objects, chat workflow and sync recovery |
| `dist/starter` | `tanstack-starter` | Project generation, embedded templates, starter API and GitHub deployment             |

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

The deployment command publishes OG, starter, chat, then the site. It preserves
existing remote variables and secrets. It does not run database migrations or
purge the CDN. The existing broader deployment commands still perform their
existing database preparation and cache purge steps.

Provision the child Workers' declared secrets before routing production
requests to them. Never put secret values in Wrangler configs or Git.

The first rollout prepares the chat Worker's three SQLite namespaces with
`expecting-transfer` declarations and bindings to the existing source namespaces.
The site then commits the transfers with `transferred` declarations. The chat
Worker activates its own bindings and takes ownership of the existing workflow.
Finally, the site removes the completed transfer declarations. The deployment
script detects this first rollout through the existing workflow's owner and
performs the stages in order. It checks required child secrets before starting.

Subsequent deployments publish the chat Worker before the site. The chat config
uses explicit SQLite exports, so local development also gets SQLite storage.
Never use `new_sqlite_classes` or create fresh production namespaces for the
existing conversations.

The chat Worker owns workspace-sync recovery; the site keeps its other cron
work. The site no longer exports chat classes or owns Cloudflare workflow
bindings. A disposable Cloudflare test verifies namespace and workflow
continuity through this same rollout, including requests between stages.

A rollback after transferring namespaces must retain the new namespace owner
and cross-script bindings, or explicitly transfer those namespaces back. Simply
deploying the old monolithic config is not a complete rollback plan.
