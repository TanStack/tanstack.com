<div align="center">

# TanStack.com

The home of the TanStack ecosystem. Built with [TanStack Router](https://tanstack.com/router) and deployed on [Cloudflare Workers](https://workers.cloudflare.com/).

<a href="https://twitter.com/tan_stack"><img src="https://img.shields.io/twitter/follow/tan_stack.svg?style=social" alt="Follow @TanStack"/></a>

### [Become a Sponsor!](https://github.com/sponsors/tannerlinsley/)

</div>

## Development

### Quick Start

From your terminal:

```sh
pnpm install
pnpm dev
```

Requires Node.js 22.12 or newer and pnpm 11. This starts the site at http://localhost:3000 and rebuilds on file changes. No environment file, Cloudflare account, database, or sibling repository is required. Internet access is needed to download dependencies and read remote documentation.

### Optional services

Add only the credentials you need to `.env.local`, then restart `pnpm dev`. Environment files are read from this checkout, never from another checkout. Missing credentials disable the relevant local service, they do not prevent the site from starting.

| Service                        | Optional configuration                                                         | Without it                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Public docs                    | Sibling repositories or `TANSTACK_LOCAL_REPOS_DIR`                             | Reads public docs from GitHub. Local files take precedence. `TANSTACK_DOCS_USE_REMOTE=true` skips local files.                                 |
| GitHub data                    | `GITHUB_AUTH_TOKEN`                                                            | Public REST and raw-file requests remain anonymous, with GitHub's rate limits. Private sponsor data is omitted.                                |
| Database features              | `DATABASE_URL`, with the repository migrations applied                         | Showcase and Intent registry lists, plus the feedback leaderboard, are empty. Accounts and writes are unavailable.                             |
| GitHub sign-in                 | Database plus `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`        | GitHub sign-in is hidden.                                                                                                                      |
| Google sign-in                 | Database plus `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`        | Google sign-in is hidden.                                                                                                                      |
| Persistent sessions            | `SESSION_SECRET`                                                               | Development generates a random worker-local secret. Restarting or reloading the worker signs you out. Production requires a configured secret. |
| Shopify                        | `SHOPIFY_PRIVATE_STOREFRONT_TOKEN`                                             | The shop shows an unconfigured state with a link to the live shop.                                                                             |
| Workers AI                     | `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` to use your own account   | Remote bindings are disabled. The included chat model is unavailable. Local R2, Durable Objects, and Workflows still use the local emulator.   |
| TanChat and connected accounts | Database, sign-in, chat access, and `ENCRYPTION_KEY` of at least 32 characters | Private chat and encrypted connected-account storage are unavailable. Provider API keys can be added in chat settings once chat is configured. |
| AI Gateway                     | `AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_ID`, `AI_GATEWAY_TOKEN`                   | Configured providers connect directly.                                                                                                         |
| Kody                           | `KODY_ORIGIN` and `ENCRYPTION_KEY`, then connect an account                    | Kody actions require a connected account.                                                                                                      |
| Notifications                  | `DISCORD_WEBHOOK_URL` and/or `RESEND_API_KEY`                                  | The corresponding notification transport is disabled.                                                                                          |
| Server error reporting         | `SENTRY_DSN`                                                                   | Local error reporting is disabled. Browser reporting and analytics only run in production.                                                     |
| Kapa docs assistant            | `VITE_KAPA_INTEGRATION_ID` and optional `VITE_KAPA_SOURCE_GROUP_IDS`           | The hosted docs assistant is unavailable.                                                                                                      |
| WebContainer runtime           | `VITE_WEBCONTAINER_API_KEY` where required by the runtime                      | Other Builder runtimes remain available.                                                                                                       |

For a database you own, set `DATABASE_URL` and run `pnpm db:migrate`. OAuth apps must permit the local callback URL, `http://localhost:3000/api/auth/callback/github` or `/google`. Use a persistent session secret when testing saved sessions or encrypted site API keys.

Cloudflare's included model makes real remote requests and can incur usage charges once a Cloudflare API token is supplied. Local storage stays in `.wrangler/state`. Production bindings and deployment configuration remain in `wrangler.jsonc`.

### Local Setup

The documentation for all TanStack projects (except `React Charts`) is hosted on [tanstack.com](https://tanstack.com). Doc pages are fetched from GitHub. In development, a local copy takes precedence when available. You only need the additional repositories if you're editing their docs.

Create a `tanstack` parent directory and clone this repo alongside the projects:

```sh
mkdir tanstack && cd tanstack
git clone git@github.com:TanStack/tanstack.com.git
git clone git@github.com:TanStack/query.git
git clone git@github.com:TanStack/router.git
git clone git@github.com:TanStack/table.git
```

Your directory structure should look like this:

```
tanstack/
   ├── tanstack.com/
   ├── query/
   ├── router/
   └── table/
```

> [!WARNING]
> Directory names must match repo names exactly (e.g., `query` not `tanstack-query`). The app finds docs by looking for sibling directories by name.

### Editing Docs

To edit docs for a project, make changes in its `docs/` folder (e.g., `../form/docs/`) and visit http://localhost:3000/form/latest/docs/overview to preview.

> [!NOTE]
> Updated pages need to be manually reloaded in the browser.

> [!WARNING]
> Update the project's `docs/config.json` if you add a new doc page!

## Get Involved

- We welcome issues and pull requests!
- Participate in [GitHub Discussions](https://github.com/TanStack/tanstack.com/discussions)
- Chat with the community on [Discord](https://discord.com/invite/WrRKjPJ)

## Explore the TanStack Ecosystem

- <a href="https://github.com/tanstack/config"><b>TanStack Config</b></a> – Tooling for JS/TS packages
- <a href="https://github.com/tanstack/db"><b>TanStack DB</b></a> – Reactive sync client store
- <a href="https://github.com/tanstack/devtools"><b>TanStack DevTools</b></a> – Unified devtools panel
- <a href="https://github.com/tanstack/form"><b>TanStack Form</b></a> – Type‑safe form state
- <a href="https://github.com/tanstack/pacer"><b>TanStack Pacer</b></a> – Debouncing, throttling, batching
- <a href="https://github.com/tanstack/query"><b>TanStack Query</b></a> – Async state & caching
- <a href="https://github.com/tanstack/ranger"><b>TanStack Ranger</b></a> – Range & slider primitives
- <a href="https://github.com/tanstack/router"><b>TanStack Router</b></a> – Type‑safe routing, caching & URL state
- <a href="https://github.com/tanstack/router"><b>TanStack Start</b></a> – Full‑stack SSR & streaming
- <a href="https://github.com/tanstack/store"><b>TanStack Store</b></a> – Reactive data store
- <a href="https://github.com/tanstack/table"><b>TanStack Table</b></a> – Headless datagrids
- <a href="https://github.com/tanstack/virtual"><b>TanStack Virtual</b></a> – Virtualized rendering

… and more at <a href="https://tanstack.com"><b>TanStack.com »</b></a>

<!-- Use the force, Luke -->

### TanChat alpha access

TanChat is invite-only, independent of Builder access. Signing in to TanStack does not unlock it. Admins and TanStack maintainers with a linked GitHub account have automatic access and unlimited invites. Maintainer identity comes from the verified GitHub account ID and the site's maintainer catalog, not an editable profile name.

Other users unlock TanChat by redeeming a single-use invite and receive three invites to share. Issuing a link consumes one invite, even if the link expires unused. Links expire after seven days. Account settings links to `/chat-access`, where users can create and copy invites. The main site menu links to TanChat, and accounts without access see the invite page.

Migration `0039_tanchat_invites` adds grants and hashed invite tokens. Server functions and chat HTTP endpoints enforce access independently of the UI. Quota checks lock the issuer account, and redemption locks the invite while granting access and consuming it in one transaction. Invite grants are stored in whichever database you configure. Local development without a database has no invite or account state.
