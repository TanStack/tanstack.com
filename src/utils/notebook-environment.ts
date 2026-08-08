export const notebookImports = {
  '@tanstack/charts': 'https://esm.sh/@tanstack/charts@0.6.5',
  '@tanstack/charts/': 'https://esm.sh/@tanstack/charts@0.6.5/',
  '@tanstack/charts-data/':
    'https://esm.sh/gh/TanStack/charts@b8690671d677244848cff0eebd3d5dd0d5825b18/packages/charts-demo-data/src/',
  '@tanstack/highlight': 'https://esm.sh/@tanstack/highlight@0.0.9',
  '@tanstack/highlight/': 'https://esm.sh/@tanstack/highlight@0.0.9/',
  '@tanstack/markdown': 'https://esm.sh/@tanstack/markdown@0.0.11',
  '@tanstack/pacer': 'https://esm.sh/@tanstack/pacer@0.21.1',
  '@tanstack/react-charts':
    'https://esm.sh/@tanstack/react-charts@0.6.5?external=react',
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
  react: 'https://esm.sh/react@19.2.3',
  'react/jsx-runtime': 'https://esm.sh/react@19.2.3/jsx-runtime',
  'react/': 'https://esm.sh/react@19.2.3/',
  'react-dom': 'https://esm.sh/react-dom@19.2.3',
  'react-dom/client': 'https://esm.sh/react-dom@19.2.3/client',
  'react-dom/': 'https://esm.sh/react-dom@19.2.3/',
} as const

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
  describeImport('@tanstack/react-charts', 'TanStack Charts React bindings'),
  describeImport(
    '@tanstack/charts-data/',
    'TanStack Charts demo data; append a module path',
  ),
  describeImport('@tanstack/highlight', 'TanStack Highlight'),
  describeImport('@tanstack/markdown', 'TanStack Markdown'),
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
  'Keep data and code in the single module when possible. Shared URLs carry the entire source in the fragment.',
  'Use console output for diagnostics that should remain available without opening browser developer tools.',
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
    '> Author and share one-file client-side TypeScript and JSX modules at https://tanstack.com/notebook.',
    '',
    '## Module contract',
    '',
    ...notebookModuleRules.map((rule) => `- ${rule}`),
    '',
    '## Starter TSX module',
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
    '## Theme',
    '',
    ...notebookThemeRules.map((rule) => `- ${rule}`),
    '',
    '## Sharing protocol',
    '',
    'A notebook URL has this form:',
    '',
    '`https://tanstack.com/notebook?title=<title>&description=<description>#code=<source>`',
    '',
    'To produce `<source>`, UTF-8 encode the TSX module, gzip the bytes, encode them as base64url, and omit `=` padding. To read a shared notebook, reverse those steps. URL fragments are not sent to the HTTP server, so agents must decode `#code` from the supplied URL locally.',
    '',
    'The editor debounces source changes into the current URL. `?view=code` only controls whether the code panel is visible.',
    '',
    '## Tips',
    '',
    ...notebookTips.map((tip) => `- ${tip}`),
    '',
  ]

  return lines.join('\n')
}
