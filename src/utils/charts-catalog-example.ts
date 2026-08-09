import {
  createExampleWorkspace,
  normalizeExamplePath,
  type ExampleDefinition,
} from './example-workspace'

const catalogSourceRoot = 'benchmarks/conformance/'
const generatedEntryPath = '/__catalog.ts'
const generatedDocumentPath = '/index.html'
const revisionPattern = /^[a-f0-9]{40}$/
const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export type ChartsCatalogExampleVersions = {
  charts: string
  reactCharts: string
  react: string
  reactDom: string
  dependencies: Record<string, string>
}

export type ChartsCatalogExampleDefinition = ExampleDefinition & {
  initialFile: string
}

export function createChartsCatalogExampleDefinition({
  caseId,
  title,
  description,
  revision,
  entryPath,
  files,
  versions,
}: {
  caseId: string
  title: string
  description?: string
  revision: string
  entryPath: string
  files: Record<string, string>
  versions: ChartsCatalogExampleVersions
}): ChartsCatalogExampleDefinition {
  if (!revisionPattern.test(revision)) {
    throw new Error('Invalid Charts catalog revision')
  }

  const initialFile = normalizeCatalogSourcePath(entryPath)
  const expectedInitialFile = `/cases/${caseId}/tanstack.ts`

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

  workspaceFiles[generatedEntryPath] = createCatalogEntry(initialFile)
  workspaceFiles[generatedDocumentPath] = catalogDocument

  return {
    id: caseId,
    title,
    ...(description === undefined ? {} : { description }),
    initialFile,
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

  const reactChartsUrl = packageUrl(
    '@tanstack/react-charts',
    versions.reactCharts,
  )
  imports['@tanstack/react-charts'] = `${reactChartsUrl}?external=react`
  imports['@tanstack/react-charts/core'] =
    `${reactChartsUrl}/core?external=react`
  imports['@tanstack/react-charts/tooltip'] =
    `${reactChartsUrl}/tooltip?external=react`
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

function createCatalogEntry(initialFile: string) {
  return `import { mount } from ${JSON.stringify(initialFile)}

const root = document.querySelector<HTMLElement>('#root')
if (!root) throw new Error('Charts catalog root not found')

const height = 480
let width = Math.max(1, Math.floor(root.getBoundingClientRect().width))
const input = () => ({
  width,
  height,
  revision: 0,
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

const catalogDocument = `<!doctype html>
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
      #root { width: 100%; height: 480px; min-width: 0; }
    </style>
  </head>
  <body><div id="root"></div></body>
</html>`
