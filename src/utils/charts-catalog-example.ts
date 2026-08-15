import {
  createExampleWorkspace,
  normalizeExamplePath,
  type ExampleDefinition,
} from './example-workspace'

const catalogSourceRoot = 'benchmarks/conformance/'
const generatedEntryPath = '/__catalog.tsx'
const generatedDocumentPath = '/index.html'
const revisionPattern = /^[a-f0-9]{40}$/
const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export type ChartsCatalogExampleVersions = {
  charts: string
  react: string
  reactDom: string
  dependencies: Record<string, string>
}

export type ChartsCatalogExampleDefinition = ExampleDefinition & {
  initialFile: string
}

export function createChartsCatalogExampleDefinition({
  chartHeight = 480,
  caseId,
  title,
  description,
  renderRevision = 0,
  revision,
  entryPath,
  files,
  versions,
}: {
  chartHeight?: number
  caseId: string
  title: string
  description?: string
  renderRevision?: number
  revision: string
  entryPath: string
  files: Record<string, string>
  versions: ChartsCatalogExampleVersions
}): ChartsCatalogExampleDefinition {
  if (!revisionPattern.test(revision)) {
    throw new Error('Invalid Charts catalog revision')
  }

  const initialFile = normalizeCatalogSourcePath(entryPath)
  const isPublicExample = initialFile.endsWith('/example.tsx')
  const expectedInitialFile = isPublicExample
    ? `/cases/${caseId}/example.tsx`
    : `/cases/${caseId}/tanstack.ts`

  if (initialFile !== expectedInitialFile) {
    throw new Error(
      `Charts catalog entry must be ${expectedInitialFile}: ${entryPath}`,
    )
  }

  const workspaceFiles: Record<string, string> = {}

  for (const [path, source] of Object.entries(files)) {
    const workspacePath = normalizeCatalogSourcePath(path)
    if (workspaceFiles[workspacePath] !== undefined) {
      throw new Error(`Duplicate Charts catalog source path: ${workspacePath}`)
    }
    workspaceFiles[workspacePath] = source
  }

  if (workspaceFiles[initialFile] === undefined) {
    throw new Error(`Charts catalog entry source not found: ${initialFile}`)
  }

  workspaceFiles[generatedEntryPath] = createCatalogEntry(
    initialFile,
    chartHeight,
    renderRevision,
    isPublicExample,
  )
  workspaceFiles[generatedDocumentPath] = createCatalogDocument(chartHeight)

  return {
    id: caseId,
    title,
    ...(description === undefined ? {} : { description }),
    initialFile,
    hiddenFiles: [generatedEntryPath, generatedDocumentPath],
    workspace: createExampleWorkspace({
      entry: generatedEntryPath,
      files: workspaceFiles,
      imports: createCatalogImports(revision, versions),
    }),
  }
}

function normalizeCatalogSourcePath(path: string) {
  const withoutLeadingSlash = path.startsWith('/') ? path.slice(1) : path
  const sourcePath = withoutLeadingSlash.startsWith(catalogSourceRoot)
    ? withoutLeadingSlash.slice(catalogSourceRoot.length)
    : withoutLeadingSlash
  const workspacePath = normalizeExamplePath(sourcePath)

  if (
    workspacePath !== `/${sourcePath}` ||
    workspacePath === generatedEntryPath ||
    workspacePath === generatedDocumentPath
  ) {
    throw new Error(`Invalid Charts catalog source path: ${path}`)
  }

  return workspacePath
}

function createCatalogImports(
  revision: string,
  versions: ChartsCatalogExampleVersions,
) {
  const imports: Record<string, string> = {}

  for (const [specifier, version] of Object.entries(versions.dependencies).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    addPackageImports(imports, specifier, version)
  }

  addPackageImports(imports, '@tanstack/charts', versions.charts)
  addPackageImports(imports, 'react', versions.react)
  addPackageImports(imports, 'react-dom', versions.reactDom)

  const chartsUrl = packageUrl('@tanstack/charts', versions.charts)
  imports['@tanstack/charts/react'] = `${chartsUrl}/react?external=react`
  imports['@tanstack/charts/react/core'] =
    `${chartsUrl}/react/core?external=react`
  imports['@tanstack/charts/react/tooltip'] =
    `${chartsUrl}/react/tooltip?external=react,react-dom`
  imports['react/jsx-runtime'] =
    `${packageUrl('react', versions.react)}/jsx-runtime`
  imports['react/jsx-dev-runtime'] =
    `${packageUrl('react', versions.react)}/jsx-dev-runtime`
  imports['react-dom/client'] =
    `${packageUrl('react-dom', versions.reactDom)}/client`

  const dataUrl = `https://esm.sh/gh/TanStack/charts@${revision}/packages/charts-demo-data/src/`
  imports['@charts-poc/demo-data/'] = dataUrl
  imports['@tanstack/charts-data/'] = dataUrl

  return imports
}

function addPackageImports(
  imports: Record<string, string>,
  specifier: string,
  version: string,
) {
  const url = packageUrl(specifier, version)
  imports[specifier] = url
  imports[`${specifier}/`] = `${url}/`
}

function packageUrl(specifier: string, version: string) {
  if (
    !specifier ||
    specifier.endsWith('/') ||
    !exactVersionPattern.test(version)
  ) {
    throw new Error(
      `Invalid pinned package dependency: ${specifier}@${version}`,
    )
  }
  return `https://esm.sh/${specifier}@${version}`
}

function createCatalogEntry(
  initialFile: string,
  chartHeight: number,
  renderRevision: number,
  isPublicExample: boolean,
) {
  if (!isPublicExample) {
    return createLegacyCatalogEntry(initialFile, chartHeight, renderRevision)
  }

  return `import { createRoot } from 'react-dom/client'
import type { ComponentType } from 'react'
import Example from ${JSON.stringify(initialFile)}

const root = document.querySelector<HTMLElement>('#root')
if (!root) throw new Error('Charts catalog root not found')

const height = ${chartHeight}
let width = Math.max(1, Math.floor(root.getBoundingClientRect().width))
const CatalogExample = Example as ComponentType<{
  width?: number
  height?: number
  revision?: number
}>
const reactRoot = createRoot(root)
const render = () => reactRoot.render(
  <CatalogExample width={width} height={height} revision={${renderRevision}} />
)
render()
const observer = new ResizeObserver(() => {
  const nextWidth = Math.max(1, Math.floor(root.getBoundingClientRect().width))
  if (nextWidth === width) return
  width = nextWidth
  render()
})

observer.observe(root)
window.addEventListener('pagehide', () => {
  observer.disconnect()
  reactRoot.unmount()
}, { once: true })
`
}

function createLegacyCatalogEntry(
  initialFile: string,
  chartHeight: number,
  renderRevision: number,
) {
  return `import { mount } from ${JSON.stringify(initialFile)}

const root = document.querySelector<HTMLElement>('#root')
if (!root) throw new Error('Charts catalog root not found')

const height = ${chartHeight}
let width = Math.max(1, Math.floor(root.getBoundingClientRect().width))
const input = () => ({
  width,
  height,
  revision: ${renderRevision},
  interactive: true,
})
const handle = mount(root, input())
const observer = new ResizeObserver(() => {
  const nextWidth = Math.max(1, Math.floor(root.getBoundingClientRect().width))
  if (nextWidth === width) return
  width = nextWidth
  handle.update(input())
})

observer.observe(root)
window.addEventListener('pagehide', () => {
  observer.disconnect()
  handle.destroy()
}, { once: true })
`
}

function createCatalogDocument(chartHeight: number) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; min-width: 0; }
      body {
        background: var(--notebook-background);
        color: var(--notebook-foreground);
      }
      #root { width: 100%; height: ${chartHeight}px; min-width: 0; }
    </style>
  </head>
  <body><div id="root"></div></body>
</html>`
}
