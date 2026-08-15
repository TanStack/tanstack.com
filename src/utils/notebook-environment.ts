import type { ExampleEnvironment } from './example-workspace'

export const notebookImports = {
  '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.13.0',
  '@tanstack/charts/': 'https://esm.sh/@tanstack/charts@0.13.0/',
  '@tanstack/charts/react':
    'https://esm.sh/@tanstack/charts@0.13.0/react?external=react,react-dom',
  '@tanstack/charts/react/canvas':
    'https://esm.sh/@tanstack/charts@0.13.0/react/canvas?external=react,react-dom',
  '@tanstack/charts/react/core':
    'https://esm.sh/@tanstack/charts@0.13.0/react/core?external=react,react-dom',
  '@tanstack/charts/react/tooltip':
    'https://esm.sh/@tanstack/charts@0.13.0/react/tooltip?external=react,react-dom',
  '@tanstack/charts/octane':
    'https://esm.sh/@tanstack/charts@0.13.0/octane?external=octane',
  '@tanstack/charts/octane/canvas':
    'https://esm.sh/@tanstack/charts@0.13.0/octane/canvas?external=octane',
  '@tanstack/charts/octane/core':
    'https://esm.sh/@tanstack/charts@0.13.0/octane/core?external=octane',
  '@tanstack/charts-data/':
    'https://esm.sh/gh/TanStack/charts@b8690671d677244848cff0eebd3d5dd0d5825b18/packages/charts-demo-data/src/',
  '@tanstack/highlight': 'https://esm.sh/@tanstack/highlight@0.0.10',
  '@tanstack/highlight/': 'https://esm.sh/@tanstack/highlight@0.0.10/',
  '@tanstack/markdown': 'https://esm.sh/@tanstack/markdown@0.0.13',
  '@tanstack/markdown/react':
    'https://esm.sh/@tanstack/markdown@0.0.13/react?external=react',
  '@tanstack/markdown/': 'https://esm.sh/@tanstack/markdown@0.0.13/',
  '@tanstack/pacer': 'https://esm.sh/@tanstack/pacer@0.21.1',
  '@tanstack/react-pacer':
    'https://esm.sh/@tanstack/react-pacer@0.22.1?external=react',
  '@tanstack/react-query':
    'https://esm.sh/@tanstack/react-query@5.100.11?external=react',
  '@tanstack/react-router':
    'https://esm.sh/@tanstack/react-router@1.170.16?external=react,react-dom',
  '@tanstack/react-table':
    'https://esm.sh/@tanstack/react-table@9.0.0?external=react,react-dom',
  'd3-array': 'https://esm.sh/d3-array@3.2.4',
  'd3-geo': 'https://esm.sh/d3-geo@3.1.1',
  'd3-scale': 'https://esm.sh/d3-scale@4.0.2',
  'd3-shape': 'https://esm.sh/d3-shape@3.2.0',
  octane: 'https://esm.sh/octane@0.1.13',
  'octane/': 'https://esm.sh/octane@0.1.13/',
  'octane/compiler': 'https://esm.sh/octane@0.1.13/compiler',
  react: 'https://esm.sh/react@19.2.3',
  'react/jsx-dev-runtime': 'https://esm.sh/react@19.2.3/jsx-dev-runtime',
  'react/jsx-runtime': 'https://esm.sh/react@19.2.3/jsx-runtime',
  'react/': 'https://esm.sh/react@19.2.3/',
  'react-dom': 'https://esm.sh/react-dom@19.2.3',
  'react-dom/client': 'https://esm.sh/react-dom@19.2.3/client',
  'react-dom/': 'https://esm.sh/react-dom@19.2.3/',
} as const

const chartsEnvironmentImports = {
  '@tanstack/charts': notebookImports['@tanstack/charts'],
  '@tanstack/charts/': notebookImports['@tanstack/charts/'],
  'd3-geo': notebookImports['d3-geo'],
  'd3-scale': notebookImports['d3-scale'],
  'd3-shape': notebookImports['d3-shape'],
}

const clientEnvironmentImports = { ...notebookImports }

function defineExampleEnvironmentProfile({
  createEntrySource,
  entryPath = '/__tanstack-example-entry.ts',
  imports,
  outputSelector,
}: {
  createEntrySource: (entry: string, outputSource: string) => string
  entryPath?: string
  imports: Record<string, string>
  outputSelector: `#${string}`
}) {
  return {
    entryPath,
    imports,
    outputSelector,
    createEntrySource(entry: string) {
      return createEntrySource(entry, createExampleOutputSource(outputSelector))
    },
  }
}

function createExampleOutputSource(outputSelector: `#${string}`) {
  const outputId = /^#([A-Za-z][\w-]*)$/.exec(outputSelector)?.[1]
  if (!outputId) {
    throw new Error('Example output selector must be a simple id selector')
  }

  return `let output = document.querySelector<HTMLElement>(${JSON.stringify(outputSelector)})
if (!output) {
  output = document.createElement('div')
  output.id = ${JSON.stringify(outputId)}
  document.body.append(output)
}`
}

export const exampleEnvironmentProfiles = {
  client: defineExampleEnvironmentProfile({
    imports: clientEnvironmentImports,
    outputSelector: '#root',
    createEntrySource(entry, outputSource) {
      return `import value from ${JSON.stringify(entry)}

${outputSource}

function appendValue(value: unknown) {
  if (value === undefined || value === null) return
  if (value instanceof Node) {
    output.append(value)
    return
  }

  const pre = document.createElement('pre')
  pre.textContent = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
  output.append(pre)
}

const result = typeof value === 'function' ? await value(output) : value
appendValue(result)
`
    },
  }),
  react: defineExampleEnvironmentProfile({
    imports: clientEnvironmentImports,
    outputSelector: '#root',
    createEntrySource(entry, outputSource) {
      return `import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import App from ${JSON.stringify(entry)}

${outputSource}

const root = createRoot(output)
root.render(createElement(App))
window.addEventListener('pagehide', () => root.unmount(), { once: true })
`
    },
  }),
  charts: defineExampleEnvironmentProfile({
    imports: chartsEnvironmentImports,
    outputSelector: '#root',
    createEntrySource(entry, outputSource) {
      return `import { mountChart } from '@tanstack/charts'
import definition from ${JSON.stringify(entry)}

${outputSource}

const chart = mountChart(output, {
  definition,
  height: 320,
  ariaLabel: 'Chart example',
})

window.addEventListener('pagehide', () => chart.destroy(), { once: true })
`
    },
  }),
  'charts-react': defineExampleEnvironmentProfile({
    imports: {
      ...chartsEnvironmentImports,
      '@tanstack/charts/react': notebookImports['@tanstack/charts/react'],
      '@tanstack/charts/react/canvas':
        notebookImports['@tanstack/charts/react/canvas'],
      '@tanstack/charts/react/core':
        notebookImports['@tanstack/charts/react/core'],
      '@tanstack/charts/react/tooltip':
        notebookImports['@tanstack/charts/react/tooltip'],
      react: notebookImports.react,
      'react/': notebookImports['react/'],
      'react/jsx-dev-runtime': notebookImports['react/jsx-dev-runtime'],
      'react/jsx-runtime': notebookImports['react/jsx-runtime'],
      'react-dom': notebookImports['react-dom'],
      'react-dom/': notebookImports['react-dom/'],
      'react-dom/client': notebookImports['react-dom/client'],
    },
    outputSelector: '#root',
    createEntrySource(entry, outputSource) {
      return `import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import App from ${JSON.stringify(entry)}

${outputSource}

const root = createRoot(output)
root.render(createElement(App))
window.addEventListener('pagehide', () => root.unmount(), { once: true })
`
    },
  }),
  'charts-octane': defineExampleEnvironmentProfile({
    imports: {
      ...chartsEnvironmentImports,
      '@tanstack/charts/octane': notebookImports['@tanstack/charts/octane'],
      '@tanstack/charts/octane/canvas':
        notebookImports['@tanstack/charts/octane/canvas'],
      '@tanstack/charts/octane/core':
        notebookImports['@tanstack/charts/octane/core'],
      octane: notebookImports.octane,
      'octane/': notebookImports['octane/'],
    },
    outputSelector: '#root',
    createEntrySource(entry, outputSource) {
      return `import { createRoot } from 'octane'
import App from ${JSON.stringify(entry)}

${outputSource}

const root = createRoot(output)
root.render(App)
window.addEventListener('pagehide', () => root.unmount(), { once: true })
`
    },
  }),
}

export function getExampleEnvironmentProfile(environment: ExampleEnvironment) {
  return exampleEnvironmentProfiles[environment]
}

function describeImport(
  specifier: keyof typeof notebookImports,
  description: string,
) {
  return { specifier, description }
}

export const notebookImportAliases = [
  describeImport('react', 'React 19.2.3'),
  describeImport('react-dom/client', 'React DOM root API'),
  describeImport('@tanstack/charts', 'TanStack Charts core'),
  describeImport('@tanstack/charts/react', 'TanStack Charts React bindings'),
  describeImport('@tanstack/charts/octane', 'TanStack Charts Octane bindings'),
  describeImport('octane', 'Octane 0.1.13 runtime'),
  describeImport(
    '@tanstack/charts-data/',
    'TanStack Charts demo data; append a module path',
  ),
  describeImport('@tanstack/highlight', 'TanStack Highlight'),
  describeImport(
    '@tanstack/highlight/',
    'TanStack Highlight subpaths; append core, languages/<name>, theme, themes/<name>, or markdown',
  ),
  describeImport('@tanstack/markdown', 'TanStack Markdown'),
  describeImport(
    '@tanstack/markdown/',
    'TanStack Markdown subpaths; append html, parser, or extensions/<name>',
  ),
  describeImport(
    '@tanstack/markdown/react',
    'TanStack Markdown React renderer using the notebook React instance',
  ),
  describeImport('@tanstack/pacer', 'TanStack Pacer'),
  describeImport('@tanstack/react-pacer', 'TanStack Pacer React bindings'),
  describeImport('@tanstack/react-query', 'TanStack Query'),
  describeImport('@tanstack/react-router', 'TanStack Router'),
  describeImport('@tanstack/react-table', 'TanStack Table'),
  describeImport('d3-array', 'D3 array utilities'),
  describeImport('d3-geo', 'D3 geographic projections'),
  describeImport('d3-scale', 'D3 scales'),
  describeImport('d3-shape', 'D3 shape generators'),
]

export const notebookModuleRules = [
  'Write one client-side TSX ECMAScript module. esbuild removes TypeScript types and transforms JSX; it does not type-check.',
  'Use static imports from the aliases below or full HTTPS ESM URLs. Remote modules and fetch requests must allow CORS.',
  'Export a default DOM Node, value, or function. A default function receives the output element and may render into it or return a value.',
]

export const notebookEnvironmentRules = [
  'The module runs in a fresh sandboxed iframe with browser APIs, DOM, Canvas, SVG, WebGL, fetch, timers, and ResizeObserver.',
  'Node.js APIs, filesystem access, process, server secrets, and parent-page DOM access are unavailable.',
  'Each run replaces the iframe, so listeners, timers, React roots, and other runtime state are discarded automatically.',
  'console.log, info, warn, error, and debug are mirrored to the optional Console panel.',
]

export const notebookThemeRules = [
  'The iframe root has either a light or dark class and follows the TanStack site theme after every run.',
  'Use --notebook-background and --notebook-foreground for theme-aware colors. Use --notebook-error for errors.',
]

export const notebookTips = [
  'Render inside the provided output element. Do not replace document.body.',
  'Make the result responsive to its container. ResizeObserver is available for charts, canvas, and WebGL scenes.',
  'Use one file for small modules. Use a workspace when separate components, styles, data, assets, or a custom document make the example clearer.',
  'Use console output for diagnostics that should remain available without opening browser developer tools.',
]

export const exampleWorkspaceRules = [
  'A workspace is JSON with version 1, an absolute entry path, a files object keyed by canonical absolute paths, an optional environment, and an optional imports object.',
  'The entry module executes in the browser. esbuild-wasm transforms TypeScript and JSX; octane/compiler transforms .tsrx files first. Neither path type-checks source.',
  'Relative imports resolve inside files. CSS and JSON imports are bundled. Browser-safe image and font imports become data URLs.',
  'Bare dependencies in /package.json resolve through esm.sh. Explicit workspace imports override both package.json and the built-in aliases.',
  'Add /index.html only when the example needs a custom document. Environment bootstraps reuse #root or append it to the body. The runtime injects its import map, compiled CSS, module, console bridge, and theme bridge.',
]

export const liveDocsRules = [
  'A runnable documentation example is a consecutive group of fenced code blocks with the same group identifier.',
  "Every fence must include an explicit canonical absolute file path. Exactly one fence has the entry flag, and that fence carries the group's only env declaration.",
  "Supported environments are client, react, charts, charts-react, and charts-octane. Their hidden bootstrap mounts the entry module's default export.",
  'Add the collapsed flag to support files that should remain under a disclosure until the reader opens them.',
  'The static highlighted fences are rendered on the server. The workbench hydrates near the viewport and runs once visible and idle; selecting Run starts it immediately.',
]

export const notebookStarterSource = `import { useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [count, setCount] = useState<number>(0)

  return (
    <button onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export default function render(output: HTMLElement) {
  createRoot(output).render(<App />)
}`

export function generateNotebookLlmsTxt() {
  const lines = [
    '# TanStack Notebook',
    '',
    '> Author, run, edit, and share browser-only JavaScript, TypeScript, JSX, and TSX projects at https://tanstack.com/notebook.',
    '',
    '## One-file compatibility mode',
    '',
    'Existing `#code=` notebook links use this contract:',
    '',
    ...notebookModuleRules.map((rule) => `- ${rule}`),
    '',
    '### Starter TSX module',
    '',
    '```tsx',
    notebookStarterSource,
    '```',
    '',
    '## Import aliases',
    '',
    ...notebookImportAliases.map(
      ({ specifier, description }) => `- \`${specifier}\`: ${description}.`,
    ),
    '',
    'Full HTTPS ESM URLs are also supported.',
    '',
    '## Browser environment',
    '',
    ...notebookEnvironmentRules.map((rule) => `- ${rule}`),
    '',
    '## Multi-file workspace contract',
    '',
    ...exampleWorkspaceRules.map((rule) => `- ${rule}`),
    '',
    '```json',
    JSON.stringify(
      {
        version: 1,
        entry: '/src/main.tsx',
        files: {
          '/src/main.tsx': "import { App } from './App'\n// mount App",
          '/src/App.tsx': 'export function App() { return <h1>Hello</h1> }',
        },
        imports: {
          react: 'https://esm.sh/react@19.2.3',
        },
      },
      null,
      2,
    ),
    '```',
    '',
    '## Live documentation fences',
    '',
    ...liveDocsRules.map((rule) => `- ${rule}`),
    '',
    '````md',
    '```tsx group=counter env=charts-react file=/src/App.tsx entry',
    'export default function App() { return <button>Count</button> }',
    '```',
    '',
    '```ts group=counter file=/src/data.ts collapsed',
    '// imported source',
    '```',
    '````',
    '',
    '## Theme',
    '',
    ...notebookThemeRules.map((rule) => `- ${rule}`),
    '',
    '## Sharing protocol',
    '',
    'Saved notebooks use stable `https://tanstack.com/notebook/<uuid>` URLs. Reads are public and unlisted. Creating, updating, deleting, and forking a saved notebook requires a TanStack login.',
    '',
    'Create one with `POST https://tanstack.com/api/notebook/records` and `{ "project": <project>, "forkedFromId"?: <uuid> }`. Owners list theirs with `GET /api/notebook/records`; public metadata is available from `GET /api/notebook/records/<uuid>`. Owners update with `PATCH` and `{ "project": <project>, "expectedUpdatedAt": <record.updatedAt> }`; stale updates return `409`. Owners delete with `DELETE`.',
    '',
    'Every save stores the project as an immutable SHA-256 snapshot. Read that canonical project JSON at `GET https://tanstack.com/api/notebook/projects/<sha256>` using the `projectHash` returned in the notebook record.',
    '',
    'The original one-file notebook URL remains supported for legacy links:',
    '',
    '`https://tanstack.com/notebook?title=<title>&description=<description>#code=<source>`',
    '',
    'To produce `<source>`, UTF-8 encode the TSX module, gzip the bytes, encode them as base64url, and omit `=` padding.',
    '',
    'Small multi-file projects use `https://tanstack.com/notebook#project=<project>`. The decoded JSON and the large-project POST body are exactly `{ "version": 1, "title": string, "description": string, "workspace": <workspace> }`. Encode and decode it with the same UTF-8, gzip, and unpadded base64url process.',
    '',
    'URL fragments are not sent to the HTTP server. Agents given a `#code` or `#project` URL must decode the fragment locally.',
    '',
    'Legacy large projects use `https://tanstack.com/notebook/p/<sha256>`. Read their canonical JSON without executing it at `GET https://tanstack.com/api/notebook/projects/<sha256>`. Reads are public and unlisted. Writes are immutable, authenticated, same-origin, and rate-limited through `POST https://tanstack.com/api/notebook/projects`.',
    '',
    'Git remains canonical for documentation and catalog examples. Saved notebook revisions and legacy project URLs are immutable snapshots.',
    '',
    '## Tips',
    '',
    ...notebookTips.map((tip) => `- ${tip}`),
    '',
  ]

  return lines.join('\n')
}
