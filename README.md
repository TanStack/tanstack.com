# Welcome to TanStack.com!

This site is built with TanStack Router!

- [TanStack Router Docs](https://tanstack.com/router)

It's deployed automagically with Netlify!

- [Netlify](https://netlify.com/)

## Development

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Environment Variables

The application requires several environment variables to function properly. Create a `.env` file in the root directory with the following variables:

### Required Variables

| Variable         | Description                             | Example                                                 | Required |
| ---------------- | --------------------------------------- | ------------------------------------------------------- | -------- |
| `CONVEX_URL`     | Convex backend URL                      | `https://your-deployment.convex.cloud`                  | ✅       |
| `KEY_ENCRYPTION` | 256-bit encryption key for LLM API keys | Generate with `node scripts/generate-encryption-key.js` | ✅       |

### Optional Variables

#### Core Application

| Variable          | Description              | Example                               | Required |
| ----------------- | ------------------------ | ------------------------------------- | -------- |
| `CONVEX_SITE_URL` | Convex site URL for auth | `https://your-deployment.convex.site` | ❌       |
| `SITE_URL`        | Application site URL     | `https://tanstack.com`                | ❌       |

#### Authentication (OAuth)

| Variable                     | Description                    | Example                                    | Required |
| ---------------------------- | ------------------------------ | ------------------------------------------ | -------- |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub OAuth app client ID     | `Ov23liABC123...`                          | ❌       |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth app client secret | `1234567890abcdef...`                      | ❌       |
| `GOOGLE_OAUTH_CLIENT_ID`     | Google OAuth app client ID     | `123456789-abc.apps.googleusercontent.com` | ❌       |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth app client secret | `GOCSPX-abc123...`                         | ❌       |

#### External APIs

| Variable            | Description                        | Example         | Required |
| ------------------- | ---------------------------------- | --------------- | -------- |
| `GITHUB_AUTH_TOKEN` | GitHub API token for fetching docs | `ghp_abc123...` | ❌\*     |
| `AIRTABLE_API_KEY`  | Airtable API key                   | `keyABC123...`  | ❌       |
| `NETLIFY_TOKEN`     | Netlify API token for deployments  | `abc123...`     | ❌       |

#### Client-side Variables (Vite)

| Variable               | Description                       | Example                                | Required |
| ---------------------- | --------------------------------- | -------------------------------------- | -------- |
| `VITE_CONVEX_SITE_URL` | Client-accessible Convex site URL | `https://your-deployment.convex.site`  | ❌       |
| `VITE_CONVEX_URL`      | Client-accessible Convex URL      | `https://your-deployment.convex.cloud` | ❌       |

\*Defaults to `'USE_A_REAL_KEY_IN_PRODUCTION'` for development

### Generating the Encryption Key

To generate a secure encryption key for `KEY_ENCRYPTION`:

```sh
node scripts/generate-encryption-key.js
```

This will output a 256-bit hex key that you can add to your `.env` file.

### LLM API Keys

**Note**: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are **not** set as environment variables. Instead, users manage their own API keys through the application's account settings at `/account`. These keys are:

- Stored encrypted in the Convex database
- Scoped to individual users
- Used dynamically by the Forge feature for AI-powered code generation

### Example .env File

```env
# Required
CONVEX_URL=https://your-deployment.convex.cloud
KEY_ENCRYPTION=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Optional - Authentication
GITHUB_OAUTH_CLIENT_ID=Ov23liABC123...
GITHUB_OAUTH_CLIENT_SECRET=1234567890abcdef...

# Optional - External APIs
GITHUB_AUTH_TOKEN=ghp_abc123...
```

## Editing and previewing the docs of TanStack projects locally

The documentations for all TanStack projects except for `React Charts` are hosted on [https://tanstack.com](https://tanstack.com), powered by this TanStack Router app.
In production, the markdown doc pages are fetched from the GitHub repos of the projects, but in development they are read from the local file system.

Follow these steps if you want to edit the doc pages of a project (in these steps we'll assume it's [`TanStack/form`](https://github.com/tanstack/form)) and preview them locally :

1. Create a new directory called `tanstack`.

```sh
mkdir tanstack
```

2. Enter the directory and clone this repo and the repo of the project there.

```sh
cd tanstack
git clone git@github.com:TanStack/tanstack.com.git
git clone git@github.com:TanStack/form.git
```

> [!NOTE]
> Your `tanstack` directory should look like this:
>
> ```
> tanstack/
>    |
>    +-- form/
>    |
>    +-- tanstack.com/
> ```

> [!WARNING]
> Make sure the name of the directory in your local file system matches the name of the project's repo. For example, `tanstack/form` must be cloned into `form` (this is the default) instead of `some-other-name`, because that way, the doc pages won't be found.

3. Enter the `tanstack/tanstack.com` directory, install the dependencies and run the app in dev mode:

```sh
cd tanstack.com
pnpm i
# The app will run on https://localhost:3000 by default
pnpm dev
```

4. Now you can visit http://localhost:3000/form/latest/docs/overview in the browser and see the changes you make in `tanstack/form/docs`.

> [!NOTE]
> The updated pages need to be manually reloaded in the browser.

> [!WARNING]
> You will need to update the `docs/config.json` file (in the project's repo) if you add a new doc page!
