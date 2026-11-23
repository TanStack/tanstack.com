# Maintainer Sandbox Guide

This guide covers the runnable examples on TanStack.com. For other Markdown features, see [docs-info.md](./docs-info.md).

## Choose a runtime

| Example | Runtime | Configuration |
| --- | --- | --- |
| Code fences grouped in a docs page | Browser esbuild compiler and sandboxed iframe | Fence metadata, optional `/package.json` |
| Repository example without a `runtime` setting | Same browser compiler, with an explicit entry file | `src/utils/client-example-config.ts` |
| Repository example with `runtime.type: 'webcontainer'` | WebContainer running install and dev-server commands in the browser | Repository files and `src/utils/client-example-config.ts` |

StackBlitz and CodeSandbox tabs open separate services. Their behavior is not defined by this guide.

## Runnable Markdown syntax

Give adjacent code fences the same `group`, give every file a path, and mark exactly one file with both `env` and `entry`:

````md
```tsx group=counter env=react file=/src/App.tsx entry
import { useState } from 'react'
import './styles.css'

export default function App() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

```css group=counter file=/src/styles.css collapsed
button { padding: 1rem; }
```

```json group=counter file=/package.json collapsed
{
  "dependencies": {
    "react": "19.2.3",
    "react-dom": "19.2.3"
  }
}
```
````

| Metadata | Rule |
| --- | --- |
| `group=counter` | Required on every fence. 1 to 64 ASCII letters, digits, underscores, or hyphens, starting with a letter or digit. |
| `file=/src/App.tsx` | Required, unique within the group, and an absolute normalized file path. No backslashes, `..`, repeated slashes, or trailing slash. |
| `entry` | Required on exactly one file. That file does not have to come first. |
| `env=react` | Required on the entry file only. See the environment table below. |
| `collapsed` | Optional on support files. Places their source under “Support files” in the static view. The file still belongs to the workspace. |

Values can be unquoted, single quoted, or double quoted. `entry` and `collapsed` also accept `=true`, but not `=false`. Do not repeat metadata keys or collapse the entry file. `/__tanstack-example-entry.ts` is reserved for the generated mounting code.

Blank lines between fences are fine. Prose, a different group, or an ordinary code block ends the group. Reusing a group name later creates a separate example. Grouping also works inside lists, blockquotes, callouts, and component blocks.

Invalid group metadata leaves the affected code as static code blocks. A valid group can still fail at compile time or runtime, so check the running example too. Source remains available before the interactive workbench loads, and readers can use Run to activate it.

### Entry exports and environments

Every Markdown entry needs a default export. The environment supplies mounting code and creates `#root` if needed.

| `env` | Default export |
| --- | --- |
| `client` | A DOM Node, value, or function. A function receives the output element and may return a value or a promise. Nodes are appended, objects render as JSON, other values render as text. `null` and `undefined` render nothing. |
| `react` | A React component, mounted with React DOM `createRoot`. |
| `charts` | A chart definition, passed to `mountChart` with height `320`. |
| `charts-react` | A React component, mounted the same way as `react`. |
| `charts-octane` | An Octane component, rendered with Octane `createRoot`. |

Repository workspaces are created without an environment wrapper. Their configured entry must mount the app itself, for example with `createRoot(document.getElementById('root')!)`. A default export alone does not mount a repository example.

## Browser compiler syntax and files

The browser compiler bundles local files as an ES module targeting ES2022. It strips TypeScript types, transforms React JSX with the automatic runtime, and does not type-check.

- `.js`, `.jsx`, `.ts`, and `.tsx` use their corresponding JavaScript or TypeScript loaders.
- `.tsrx` files use the Octane compiler in client mode, with development mode and HMR disabled.
- `.css` files can be imported from source. Compiled CSS is injected into the preview.
- `.json` files can be imported as modules.
- AVIF, GIF, JPEG, PNG, SVG, WebP, WOFF, and WOFF2 imports become data URLs. Binary workspace files are base64 encoded in `binaryFiles`.

Local imports can use relative or absolute workspace paths. Extensionless imports try `.tsx`, `.tsrx`, `.ts`, `.jsx`, `.js`, `.css`, and `.json`, then matching `index` files. Use explicit extensions for assets.

The file extension chooses the compiler loader, not the Markdown fence language. Keep both accurate so highlighting matches execution.

There is no Vite server in this runtime. Vite plugins, framework build plugins, Tailwind compilation, server functions, `.vue` and `.svelte` compilation, and Vite helpers such as `import.meta.glob` are not provided. The compiler does not load project `vite.config` or `tsconfig` settings, inject `.env` values, or run package scripts. Plain CSS and browser JavaScript work without those build steps.

### Packages

Docs fence groups and embedded repository examples use dynamic package resolution:

1. Bare imports such as `react` or `@tanstack/react-query` are resolved through esm.sh.
2. `/package.json` supplies versions from `dependencies` and `devDependencies`, with `dependencies` taking precedence. An undeclared imported package requests `latest`.
3. Metadata resolves those requests to exact versions for that run. Peer dependency metadata is read from esm.sh and UNPKG so shared framework packages can use the same instance. Declared peer packages can be resolved even when your source does not import them directly.

Use ordinary npm package names and subpaths in source, and put versions in `/package.json`. Pin versions when an example depends on a particular API. Version ranges and tags are accepted, but `workspace:`, `file:`, Git URLs, and npm alias versions are not supported by this resolver. Adding an npm dependency does not make Node APIs or native addons available in an iframe.

Full HTTPS ESM imports are also supported. Remote modules and fetch requests must allow CORS. Package resolution needs access to esm.sh and UNPKG, and a package must work as browser ESM. There is no fixed package allowlist for dynamic docs examples, but there is a limit of 100 external import specifiers, plus a limit on resolved package groups as declared peers are added. Metadata requests time out after 10 seconds and responses are limited to 512 KiB.

`@tanstack/charts-data/` has a special mapping to the Charts demo-data source. Append the module path to that prefix.

Other workbench callers default to legacy package resolution unless they select `packageResolution="dynamic"`. Legacy mode starts with the curated `builderImports` map in [builder-environment.ts](./src/utils/builder-environment.ts), then applies versions for imported packages declared in `/package.json`. Do not assume that curated list restricts dynamic docs examples.

### Workspace configuration

Programmatic workspaces use this shape, defined in [example-workspace.ts](./src/utils/example-workspace.ts):

```ts
{
  version: 1,
  entry: '/src/main.ts',
  environment: 'client', // Optional, omit when the entry mounts itself
  files: {
    '/src/main.ts': 'export default "Hello"',
  },
  // Optional base64 binary file contents
  binaryFiles: {},
  // Optional local aliases or browser import-map targets
  imports: {
    '~/': '/src/',
  },
}
```

Exact import mappings win over prefix mappings. Prefix keys end in `/`, and the longest matching prefix wins. Local targets beginning with `/` resolve to workspace files. URL targets remain in the browser import map. Explicit mappings override generated package mappings, and must cover any imported subpaths. When an explicitly mapped package is used as a shared peer, map both its root and its trailing-slash prefix.

Markdown fence metadata does not expose `imports`, `binaryFiles`, or a WebContainer runtime setting. Put package versions in a grouped `/package.json` fence, use relative source imports, or configure a repository example when you need a project runtime.

### HTML, assets, and browser limits

A workspace can include `/index.html`. The preview uses it as the document, removes its module script when that script's path matches the configured entry, and injects the compiled entry. Without it, the preview supplies a basic document with `#root`.

Local `src` and `href` references in authored HTML are rewritten to data URLs for supported assets, looking in `/public` first, then the workspace root. This is not a static file server. `fetch('/data.json')` does not read a workspace file, and Vite-style asset query imports such as `?raw` and `?url` are not implemented by the local resolver. Import local JSON or assets directly instead.

Browser previews run in an iframe with `sandbox="allow-scripts"`:

- DOM, Canvas, SVG, WebGL, timers, and browser fetch are available, subject to browser and CORS rules.
- Node.js APIs, a server filesystem, server secrets, and the parent page's DOM are unavailable.
- Browser storage is not persistent. The runtime supplies in-memory `localStorage` and `sessionStorage` when the sandbox origin blocks them. Each new run discards that state.
- The sandbox does not grant forms, popups, downloads, or top-level navigation permissions.
- Each run replaces the iframe, discarding listeners, timers, and mounted app state.
- `console.log`, `info`, `warn`, `error`, and `debug` are forwarded to the Console panel, along with runtime error reporting.

The preview follows the site's light or dark theme through a root class. Use `--builder-background`, `--builder-foreground`, and `--builder-error` for theme-aware colors.

## Embed a repository example in docs

Use a standalone comment with exactly these attributes:

```md
<!-- ::client-example library=ai framework=react slug=basic-chat -->
```

Attribute values must be lowercase letters and digits separated by single hyphens. Extra attributes are rejected. The embed fetches `examples/<framework>/<slug>` from the library repository and selected version's branch.

Embeds currently require `version=latest` and a matching configuration in [client-example-config.ts](./src/utils/client-example-config.ts). React AI examples are the exception to the explicit list: any valid kebab-case slug selects the TanStack Start WebContainer runtime, but the corresponding repository directory must still exist. An unsupported configuration renders no embed.

To enable another repository example, add its library, framework, slug, and entry path to that configuration. Set `autoStart` when it should run automatically, and add `runtime` only when it needs WebContainer. The configured entry must exist in the fetched files. For browser-compiled projects, it is the execution entry; for WebContainer projects, the install and start commands control execution.

## WebContainer projects

WebContainer mounts project files, installs dependencies, and runs a dev server in the browser. Unlike the browser compiler, it uses the project's package scripts and build configuration.

```ts
runtime: {
  type: 'webcontainer',
  install: { command: 'pnpm', args: ['install'] },
  start: { command: 'pnpm', args: ['run', 'dev'] },
}
```

Commands are passed as a command and argument array, not a shell command string. The runtime waits for the dev server's `server-ready` event to show its URL. Files such as `package.json`, Vite configuration, and any required source must be included in the example directory, so the copied project can install and run on its own.

The fetch path rewrites `workspace:*` versions for packages beginning with `@tanstack/ai` to `latest`. This is not general monorepo dependency resolution, other workspace references still need a project that can resolve them.

### TanStack Start compatibility

Start examples use `compatibility: 'tanstack-start-async-context'`. This mode requires:

- An ESM Vite config at `/vite.config.ts`, `/vite.config.mts`, `/vite.config.js`, or `/vite.config.mjs`.
- A start command using `npm run` or `pnpm run`.
- No authored files at `/.tanstack/vite.config.mjs` or `/.tanstack/async-context-plugin.mjs`, those paths are reserved.

The runtime generates a wrapper around the authored Vite config, adds its async-context compatibility plugin, bundles the relevant TanStack server packages, selects Nitro's `self` dev runner, and installs matching Rolldown WASI and Oxc runtime dependencies. Keep this setting on Start projects that need it, rather than copying the generated files into examples.

### WebContainer limits

- Requires a secure browser context, cross-origin isolation, SharedArrayBuffer, WebAssembly, and service workers. The site adds the runtime headers to configured example pages and docs pages containing a matching WebContainer embed.
- Only one WebContainer example session can be active at once. Starting another supersedes the previous session.
- This is a browser-hosted runtime. Do not assume packages requiring native binaries, OS services, or external infrastructure work just because they run locally in Node. The Start compatibility path handles specific dependencies, not every native package.
- The runtime does not provision API keys, databases, or external services. An example depending on them must account for that setup. Do not put private credentials in public example files.
- The preview iframe allows scripts, forms, and its own origin. It still does not grant every browser permission.

## Implementation references

- [Markdown grouping and metadata validation](./src/utils/markdown/live-example.ts)
- [Environment mounting and curated legacy imports](./src/utils/builder-environment.ts)
- [Browser compilation and file loaders](./src/utils/example-esbuild.client.ts)
- [Dynamic and legacy package resolution](./src/utils/example-imports.ts)
- [Preview HTML, assets, storage, and console bridge](./src/utils/example-sandbox.client.ts)
- [Repository embed configuration](./src/utils/client-example-config.ts)
- [WebContainer lifecycle and browser support checks](./src/utils/example-webcontainer.client.ts)
- [TanStack Start compatibility](./src/utils/example-webcontainer-start.ts)
