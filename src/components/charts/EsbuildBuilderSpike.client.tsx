import { ExampleWorkbench } from '~/components/examples/ExampleWorkbench.client'
import {
  createExampleWorkspace,
  type ExampleDefinition,
} from '~/utils/example-workspace'

const multiFileProject = createExampleWorkspace({
  entry: '/src/main.tsx',
  files: {
    '/src/main.tsx': `import { createRoot } from 'react-dom/client'
import { scaleLinear } from 'd3-scale'
import { Metric } from './Metric'
import values from './values.json'
import mark from './mark.svg'
import './styles.css'

type Datum = { label: string; value: number }

const data: Array<Datum> = values
const scale = scaleLinear().domain([0, 100]).range([0, 100])

function App() {
  console.info('multi-file npm case ready', { rows: data.length })

  return (
    <main className="spike-card" data-spike-result="multi-file-npm">
      <h1><img src={mark} alt="" /> Multi-file npm</h1>
      {data.map((datum) => (
        <Metric key={datum.label} label={datum.label} percent={scale(datum.value)} />
      ))}
    </main>
  )
}

createRoot(document.querySelector('#root')!).render(<App />)`,
    '/src/Metric.tsx': `type MetricProps = {
  label: string
  percent: number
}

export function Metric({ label, percent }: MetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <div><i style={{ width: percent + '%' }} /></div>
      <strong>{percent}%</strong>
    </div>
  )
}`,
    '/src/values.json': JSON.stringify(
      [
        { label: 'Compile', value: 84 },
        { label: 'Render', value: 63 },
        { label: 'Share', value: 92 },
      ],
      null,
      2,
    ),
    '/src/mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#14b8a6"/><path d="m7 12 3 3 7-7" fill="none" stroke="white" stroke-width="2"/></svg>`,
    '/src/styles.css': `.spike-card { font: 14px/1.4 system-ui; padding: 24px; color: light-dark(#171717, #f9fafb); }
.spike-card h1 { display: flex; align-items: center; gap: 8px; margin: 0 0 20px; font-size: 22px; }
.spike-card h1 img { width: 24px; height: 24px; }
.metric { display: grid; grid-template-columns: 64px 1fr 44px; gap: 12px; align-items: center; margin: 10px 0; }
.metric div { height: 8px; overflow: hidden; border-radius: 999px; background: #374151; }
.metric i { display: block; height: 100%; border-radius: inherit; background: #14b8a6; }
.metric strong { text-align: right; }`,
    '/package.json': JSON.stringify(
      {
        dependencies: {
          'd3-scale': '4.0.2',
          react: '19.2.3',
          'react-dom': '19.2.3',
        },
      },
      null,
      2,
    ),
  },
})

const spikeCases: Record<string, ExampleDefinition> = {
  'multi-file-npm': {
    id: 'multi-file-npm',
    title: 'Multi-file npm',
    description:
      'TypeScript, JSX, relative files, JSON, CSS, SVG, and npm imports.',
    workspace: multiFileProject,
  },
  'https-esm': {
    id: 'https-esm',
    title: 'HTTPS ESM import',
    description: 'A direct HTTPS ESM import from esm.sh.',
    workspace: createExampleWorkspace({
      entry: '/main.tsx',
      files: {
        '/main.tsx': `import { createRoot } from 'react-dom/client'
import { scaleLinear } from 'https://esm.sh/d3-scale@4.0.2'

const scale = scaleLinear().domain([0, 10]).range([0, 100])

createRoot(document.querySelector('#root')!).render(
  <main data-spike-result="https-esm" style={{ padding: 24, fontFamily: 'system-ui' }}>
    HTTPS ESM import result: {scale(7)}
  </main>,
)`,
      },
    }),
  },
  'revision-esm': {
    id: 'revision-esm',
    title: 'Pinned revision import',
    description: 'A TanStack Charts source module pinned to a Git commit.',
    workspace: createExampleWorkspace({
      entry: '/main.tsx',
      files: {
        '/main.tsx': `import { createRoot } from 'react-dom/client'
import { alphabet } from 'https://esm.sh/gh/TanStack/charts@b8690671d677244848cff0eebd3d5dd0d5825b18/packages/charts-demo-data/src/alphabet.js'

createRoot(document.querySelector('#root')!).render(
  <main data-spike-result="revision-esm" style={{ padding: 24, fontFamily: 'system-ui' }}>
    Exact revision rows: {alphabet.length}
  </main>,
)`,
      },
    }),
  },
  'custom-document': {
    id: 'custom-document',
    title: 'Custom document',
    description: 'A project-supplied index.html document.',
    workspace: createExampleWorkspace({
      entry: '/src/main.tsx',
      files: {
        '/src/main.tsx': `import { createRoot } from 'react-dom/client'

function App() {
  return <p data-spike-result="custom-document">Custom document root mounted.</p>
}

createRoot(document.querySelector('#custom-root')!).render(<App />)`,
        '/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body { margin: 0; background: light-dark(rgb(236 254 255), rgb(8 47 73)); color: light-dark(#134e4a, #ccfbf1); font-family: system-ui; } aside { padding: 16px 24px 0; }</style>
  </head>
  <body>
    <aside>Custom document</aside>
    <div id="custom-root"></div>
  </body>
</html>`,
      },
    }),
  },
}

export function EsbuildBuilderSpike() {
  const requestedCase = new URLSearchParams(window.location.search).get('case')
  const definition =
    (requestedCase ? spikeCases[requestedCase] : undefined) ??
    spikeCases['multi-file-npm']

  if (!definition) return null

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 p-4 text-text-primary">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{definition.title}</h1>
          {definition.description ? (
            <p className="text-sm text-text-muted">{definition.description}</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="esbuild fixtures">
          {Object.entries(spikeCases).map(([id, item]) => (
            <a
              key={id}
              href={`/builder/esbuild?case=${id}`}
              aria-current={id === definition.id ? 'page' : undefined}
              className="rounded border border-border-default px-2 py-1 font-mono text-xs aria-[current=page]:bg-background-subtle"
            >
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <ExampleWorkbench
        key={definition.id}
        allowSharing
        definition={definition}
        packageResolution="dynamic"
      />
    </main>
  )
}
