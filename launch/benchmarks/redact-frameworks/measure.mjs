import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

// Run inside an isolated directory with the pinned dependencies installed.
const root = resolve(process.argv[2])
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const leanOptions = {
  Start: {
    features: { activity: false, fragmentRefs: false, portal: false },
  },
  Vite: { preset: 'nano' },
}
const counter = `'use client'
import { useEffect, useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  const [name, setName] = useState('friend')
  useEffect(() => {
    document.documentElement.dataset.ready = 'true'
    document.documentElement.dataset.runtime = Reflect.get(globalThis, Symbol.for('@tanstack/redact.ReactSharedInternals')) ? 'redact' : 'react'
  }, [])
  return <main>
    <h1>Hello, {name}.</h1>
    <label>Your name <input value={name} onChange={event => setName(event.target.value)} /></label>
    <button type="button" onClick={() => setCount(value => value + 1)}>Count: {count}</button>
  </main>
}
`
const css = `body { margin: 0; font: 18px system-ui, sans-serif; color: #202020; background: #faf9f6; }
main { max-width: 32rem; margin: 4rem auto; padding: 1.5rem; }
label { display: grid; gap: .5rem; }
input, button { font: inherit; padding: .6rem; }
button { margin-top: 1.5rem; cursor: pointer; }
`
const packageJSON = JSON.parse(
  await readFile(join(root, 'package.json'), 'utf8'),
)
const packageVersions = {}
for (const name of Object.keys(packageJSON.dependencies)) {
  packageVersions[name] = JSON.parse(
    await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8'),
  ).version
}
const report = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  zlib: process.versions.zlib,
  packageVersions,
  lockSha256: hash(await readFile(join(root, 'package-lock.json'))),
  redactTarballSha256: hash(await readFile(join(root, 'redact.tgz'))),
  counterSha256: hash(counter),
  cssSha256: hash(css),
  leanOptions,
  method:
    'Same single-route counter and controlled input in all four frameworks. Production client builds with default optimization settings. Start bundles its server dependencies through Vite in every variant so React imports inside dependencies are transformed too. Sum of gzipSync bytes for every emitted client .js and .css file, compressed separately. Includes lazy chunks and framework polyfills. Excludes server output, HTML, inline scripts, maps, and images. Each React/default pair changes only its Redact integration. The extra Start and Vite builds disable unused features with the recorded leanOptions. KB means 1,000 bytes. These are starter apps, not a promise for every app or a browser speed measurement.',
  results: [],
}

async function write(app, file, text) {
  const path = join(app, file)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text)
}

async function run(app, renderer, executable, args) {
  const log = createWriteStream(join(app, `${renderer}.log`))
  const child = spawn(
    process.execPath,
    [join(root, 'node_modules', executable), ...args],
    {
      cwd: app,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        RENDERER: renderer,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  await new Promise((accept, reject) => {
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? accept()
        : reject(
            new Error(`${app}/${renderer} exited ${code}; see ${renderer}.log`),
          ),
    )
  })
  log.end()
}

async function files(directory, prefix = '') {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      result.push(...(await files(path, `${prefix}${entry.name}/`)))
    else if (/\.(js|css)$/.test(entry.name)) {
      const bytes = await readFile(path)
      result.push({
        path: `${prefix}${entry.name}`,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        sha256: hash(bytes),
      })
    }
  }
  return result
}

for (const framework of ['Start', 'Vite', 'Vinext', 'Next.js']) {
  const id = framework === 'Next.js' ? 'next' : framework.toLowerCase()
  const app = join(root, id)
  await write(app, 'package.json', '{"private":true,"type":"module"}\n')
  await write(app, 'Counter.jsx', counter)
  await write(app, 'style.css', css)
  if (framework === 'Start') {
    await write(
      app,
      'vite.config.mjs',
      `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'
export default defineConfig({
  ssr: { noExternal: true },
  plugins: [tanstackStart(), react(), ...(process.env.RENDERER !== 'react' ? [redact(process.env.RENDERER === 'redact-lean' ? ${JSON.stringify(leanOptions.Start)} : {})] : [])],
})
`,
    )
    await write(
      app,
      'src/router.tsx',
      `import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
export function getRouter() { return createRouter({ routeTree }) }
`,
    )
    await write(
      app,
      'src/routes/__root.tsx',
      `import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import '../../style.css'
export const Route = createRootRoute({
  head: () => ({ meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'Bundle comparison' }] }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
})
`,
    )
    await write(
      app,
      'src/routes/index.tsx',
      `import { createFileRoute } from '@tanstack/react-router'
import Counter from '../../Counter.jsx'
export const Route = createFileRoute('/')({ component: Counter })
`,
    )
  } else if (framework === 'Vite') {
    await write(
      app,
      'vite.config.mjs',
      `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'
export default defineConfig({ plugins: [react(), ...(process.env.RENDERER !== 'react' ? [redact(process.env.RENDERER === 'redact-lean' ? ${JSON.stringify(leanOptions.Vite)} : {})] : [])] })
`,
    )
    await write(
      app,
      'index.html',
      '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bundle comparison</title></head><body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>\n',
    )
    await write(
      app,
      'main.jsx',
      `import { createRoot } from 'react-dom/client'
import Counter from './Counter.jsx'
import './style.css'
createRoot(document.getElementById('root')).render(<Counter />)
`,
    )
  } else {
    await write(
      app,
      'app/layout.jsx',
      `import '../style.css'
export const metadata = { title: 'Bundle comparison' }
export default function Layout({ children }) { return <html lang="en"><body>{children}</body></html> }
`,
    )
    await write(
      app,
      'app/page.jsx',
      `import Counter from '../Counter.jsx'
export default function Page() { return <Counter /> }
`,
    )
    if (framework === 'Vinext') {
      await write(
        app,
        'vite.config.mjs',
        `import { defineConfig } from 'vite'
import vinext from 'vinext'
import { redact } from '@tanstack/redact/vinext'
export default defineConfig({ plugins: [vinext(), redact({ renderer: process.env.RENDERER })] })
`,
      )
    } else {
      await write(
        app,
        'next.config.mjs',
        `import { withRedact } from '@tanstack/redact/next'
const config = { agentRules: false, distDir: '.next-' + process.env.RENDERER, turbopack: { root: ${JSON.stringify(root)} } }
export default process.env.RENDERER === 'redact' ? withRedact(config) : config
`,
      )
    }
  }

  for (const renderer of [
    'react',
    'redact',
    ...(framework in leanOptions ? ['redact-lean'] : []),
  ]) {
    console.log(`Building ${framework} + ${renderer}`)
    await run(
      app,
      renderer,
      framework === 'Next.js' ? 'next/dist/bin/next' : 'vite/bin/vite.js',
      framework === 'Next.js' ? ['build', '--turbopack'] : ['build'],
    )
    const output =
      framework === 'Next.js'
        ? `.next-${renderer}/static`
        : framework === 'Vite'
          ? 'dist'
          : 'dist/client'
    const emitted = await files(join(app, output))
    assert(emitted.length > 0, `${framework}/${renderer}: no output`)
    const result = {
      framework,
      renderer,
      gzipBytes: emitted.reduce((sum, file) => sum + file.gzipBytes, 0),
      files: emitted,
    }
    report.results.push(result)
    await writeFile(
      join(root, `${id}-${renderer}.json`),
      JSON.stringify(result, null, 2) + '\n',
    )
    console.log(
      `${framework} + ${renderer}: ${result.gzipBytes} gzip bytes across ${emitted.length} files`,
    )
    // Preserve every complete build for browser verification after measurement.
    if (framework !== 'Next.js') {
      const { rename } = await import('node:fs/promises')
      await rename(join(app, 'dist'), join(app, `dist-${renderer}`))
    }
  }
}
for (const framework of Object.keys(leanOptions)) {
  const variants = report.results.filter((item) => item.framework === framework)
  assert(
    variants.find((item) => item.renderer === 'redact-lean').gzipBytes <
      variants.find((item) => item.renderer === 'redact').gzipBytes,
    `${framework}: feature selection did not reduce output`,
  )
}
await writeFile(
  join(root, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(`Saved ${join(root, 'results.json')}`)
