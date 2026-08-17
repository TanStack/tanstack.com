import {
  createExampleWorkspace,
  isCanonicalExamplePath,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'
import {
  exampleEnvironmentProfiles,
  notebookImports,
} from './notebook-environment'

const maxFileBytes = 512 * 1024
const notebookAiScaffoldDirectory = '/.tanstack'
const notebookAiEntryPath = '/.tanstack/main.ts'
const notebookAiScaffoldMarkerPath = '/.tanstack/notebook-ai.json'
const notebookAiViteConfigPath = '/.tanstack/vite.config.ts'
const notebookAiDocumentPath = '/index.html'
const notebookAiPackagePath = '/package.json'
const npmPackageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const npmPackageVersionPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/i
const notebookAiScaffoldMarkerSource = '{"version":1}\n'
const notebookAiDevScript =
  'vite --config .tanstack/vite.config.ts --host 0.0.0.0'
const notebookAiDefaultDocumentSource = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TanStack Notebook</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`
const notebookAiThemeSource = `:root {
  color-scheme: light;
  --notebook-background: #fff;
  --notebook-foreground: #111;
  --notebook-error: #b91c1c;
  --ts-chart-1: #3aa3c4;
  --ts-chart-2: #d3481b;
  --ts-chart-3: #39af46;
  --ts-chart-4: #b64cc7;
  --ts-chart-5: #ffa216;
  --ts-chart-6: #3e3529;
}
:root.dark {
  color-scheme: dark;
  --notebook-background: #111;
  --notebook-foreground: #d4d4d4;
  --notebook-error: #e06e49;
  --ts-chart-1: #9cd5e2;
  --ts-chart-2: #edaa8d;
  --ts-chart-3: #a2e1a9;
  --ts-chart-4: #ca8ec5;
  --ts-chart-5: #fae884;
  --ts-chart-6: #aea691;
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    color-scheme: dark;
    --notebook-background: #111;
    --notebook-foreground: #d4d4d4;
    --notebook-error: #e06e49;
    --ts-chart-1: #9cd5e2;
    --ts-chart-2: #edaa8d;
    --ts-chart-3: #a2e1a9;
    --ts-chart-4: #ca8ec5;
    --ts-chart-5: #fae884;
    --ts-chart-6: #aea691;
  }
}
html, body { min-height: 100%; }
body {
  margin: 0;
  background: var(--notebook-background);
  color: var(--notebook-foreground);
}
`

export type NotebookAiWorkspaceState = {
  workspace: ExampleWorkspace
  runtime?: ExampleRuntime
}

export type NotebookAiFile = {
  path: string
  characters: number
}

export function listNotebookAiFiles(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
) {
  const hidden = new Set(hiddenFiles)
  const hasManagedScaffold = hasNotebookAiManagedScaffold(workspace)

  return Object.entries(workspace.files)
    .filter(
      ([path]) =>
        !hidden.has(path) &&
        !(hasManagedScaffold && isNotebookAiManagedPath(path)),
    )
    .map(([path, source]) => ({ path, characters: source.length }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

export function readNotebookAiFile(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
  path: string,
) {
  assertEditablePath(workspace, hiddenFiles, path)
  return workspace.files[path]
}

export function replaceNotebookAiFile(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
  path: string,
  source: string,
) {
  assertEditablePath(workspace, hiddenFiles, path)

  if (new TextEncoder().encode(source).byteLength > maxFileBytes) {
    throw new Error('Replacement file is too large')
  }

  return createExampleWorkspace({
    binaryFiles: workspace.binaryFiles,
    entry: workspace.entry,
    environment: workspace.environment,
    files: { ...workspace.files, [path]: source },
    imports: workspace.imports,
  })
}

export function getChangedNotebookAiFiles(
  before: ExampleWorkspace,
  after: ExampleWorkspace,
) {
  return [
    ...new Set([...Object.keys(before.files), ...Object.keys(after.files)]),
  ]
    .filter((path) => before.files[path] !== after.files[path])
    .sort()
}

export function installNotebookAiPackage(
  current: NotebookAiWorkspaceState,
  packageName: string,
  version: string,
): NotebookAiWorkspaceState {
  if (packageName.length > 214 || !npmPackageNamePattern.test(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`)
  }
  if (
    version.length > 128 ||
    !npmPackageVersionPattern.test(version) ||
    hasInvalidNumericPrerelease(version)
  ) {
    throw new Error(`Invalid package version: ${version}`)
  }

  const source = current.workspace.files[notebookAiPackagePath]
  if (source === undefined) {
    throw new Error('Package installation requires /package.json')
  }

  const manifest = parseNotebookAiPackage(source)
  const dependencies = readPackageSection(manifest, 'dependencies')
  const devDependencies = readPackageSection(manifest, 'devDependencies')
  const nextDependencies = { ...dependencies, [packageName]: version }
  const nextDevDependencies = omitKeys(
    devDependencies,
    new Set(Object.keys(nextDependencies)),
  )

  const packageSource = `${JSON.stringify(
    {
      ...manifest,
      dependencies: nextDependencies,
      ...(manifest.devDependencies !== undefined
        ? { devDependencies: nextDevDependencies }
        : {}),
    },
    null,
    2,
  )}\n`
  if (new TextEncoder().encode(packageSource).byteLength > maxFileBytes) {
    throw new Error('Package manifest is too large')
  }

  return withNotebookAiWorkspace(
    current,
    createExampleWorkspace({
      binaryFiles: current.workspace.binaryFiles,
      entry: current.workspace.entry,
      environment: current.workspace.environment,
      files: {
        ...current.workspace.files,
        [notebookAiPackagePath]: packageSource,
      },
      imports: current.workspace.imports,
    }),
  )
}

export function upgradeNotebookAiWorkspaceToWebContainer(
  current: NotebookAiWorkspaceState,
): NotebookAiWorkspaceState {
  if (current.runtime) {
    throw new Error('Notebook already uses a WebContainer runtime')
  }

  const textPaths = Object.keys(current.workspace.files)
  const binaryPaths = Object.keys(current.workspace.binaryFiles ?? {})
  const collision = [...textPaths, ...binaryPaths].find(
    isNotebookAiScaffoldCollision,
  )
  if (collision) {
    throw new Error(`Notebook file is reserved for WebContainer: ${collision}`)
  }
  const binaryRootCollision = binaryPaths.find(
    (path) => path === notebookAiDocumentPath || path === notebookAiPackagePath,
  )
  if (binaryRootCollision) {
    throw new Error(
      `Notebook file must be text for WebContainer: ${binaryRootCollision}`,
    )
  }

  const needsOctane = textPaths.some((path) => path.endsWith('.tsrx'))
  const packageSource = createNotebookAiPackageSource(
    current.workspace.files[notebookAiPackagePath],
    needsOctane,
  )
  const documentSource = createNotebookAiDocumentSource(current.workspace)

  const workspace = createExampleWorkspace({
    binaryFiles: current.workspace.binaryFiles,
    entry: current.workspace.entry,
    environment: current.workspace.environment,
    files: {
      ...current.workspace.files,
      [notebookAiEntryPath]: createNotebookAiEntrySource(current.workspace),
      [notebookAiScaffoldMarkerPath]: notebookAiScaffoldMarkerSource,
      [notebookAiViteConfigPath]: createNotebookAiViteConfigSource(
        current.workspace,
        needsOctane,
      ),
      [notebookAiDocumentPath]: documentSource,
      [notebookAiPackagePath]: packageSource,
    },
    imports: current.workspace.imports,
  })

  return { workspace, runtime: createNotebookAiWebContainerRuntime() }
}

function createNotebookAiWebContainerRuntime(): ExampleRuntime {
  return {
    type: 'webcontainer',
    install: { command: 'pnpm', args: ['install'] },
    start: { command: 'pnpm', args: ['run', 'dev'] },
  }
}

function createNotebookAiEntrySource(workspace: ExampleWorkspace) {
  const entry = `..${workspace.entry}`
  if (!workspace.environment) return `import ${JSON.stringify(entry)}\n`
  return exampleEnvironmentProfiles[workspace.environment].createEntrySource(
    entry,
  )
}

function isNotebookAiManagedPath(path: string) {
  return (
    path === notebookAiScaffoldDirectory ||
    path.startsWith(`${notebookAiScaffoldDirectory}/`) ||
    path === notebookAiDocumentPath ||
    path.startsWith(`${notebookAiDocumentPath}/`) ||
    path === notebookAiPackagePath ||
    path.startsWith(`${notebookAiPackagePath}/`)
  )
}

function isNotebookAiScaffoldCollision(path: string) {
  return (
    path === notebookAiScaffoldDirectory ||
    path.startsWith(`${notebookAiScaffoldDirectory}/`) ||
    path.startsWith(`${notebookAiDocumentPath}/`) ||
    path.startsWith(`${notebookAiPackagePath}/`)
  )
}

function hasNotebookAiManagedScaffold(workspace: ExampleWorkspace) {
  return (
    workspace.files[notebookAiScaffoldMarkerPath] ===
    notebookAiScaffoldMarkerSource
  )
}

function createNotebookAiPackageSource(
  source: string | undefined,
  needsOctane: boolean,
) {
  const manifest = source === undefined ? {} : parseNotebookAiPackage(source)
  const scripts = readPackageSection(manifest, 'scripts')
  const authoredDependencies = readPackageSection(manifest, 'dependencies')
  const authoredDevDependencies = readPackageSection(
    manifest,
    'devDependencies',
  )
  const runtimeDependencies = {
    react: '19.2.3',
    'react-dom': '19.2.3',
    ...(needsOctane ? { octane: '0.1.13' } : {}),
  }
  const runtimeDevDependencies = {
    '@vitejs/plugin-react': '6.0.1',
    vite: '8.0.16',
  }
  const dependencies = {
    ...omitKeys(
      authoredDependencies,
      new Set(Object.keys(runtimeDevDependencies)),
    ),
    ...runtimeDependencies,
  }
  const devDependencies = {
    ...omitKeys(authoredDevDependencies, new Set(Object.keys(dependencies))),
    ...runtimeDevDependencies,
  }

  return stringifyNotebookAiPackage({
    ...manifest,
    private: true,
    type: 'module',
    scripts: { ...scripts, dev: notebookAiDevScript },
    dependencies,
    devDependencies,
  })
}

function createNotebookAiDocumentSource(workspace: ExampleWorkspace) {
  const importMap = escapeScriptText(
    JSON.stringify({
      imports: { ...notebookImports, ...workspace.imports },
    }),
  )
  const head = `
    <meta name="color-scheme" content="light dark" />
    <script type="importmap">${importMap}</script>
    <style>${notebookAiThemeSource}</style>
  `
  const body = `
    <script type="module" src="${notebookAiEntryPath}"></script>
  `
  const authoredDocument = workspace.files[notebookAiDocumentPath]
  const source =
    authoredDocument !== undefined
      ? removeAuthoredEntryScripts(authoredDocument, workspace.entry)
      : notebookAiDefaultDocumentSource

  return injectBeforeClosingTag(
    injectBeforeClosingTag(source, 'head', head),
    'body',
    body,
  )
}

function createNotebookAiViteConfigSource(
  workspace: ExampleWorkspace,
  needsOctane: boolean,
) {
  const builtInSpecifiers = JSON.stringify(Object.keys(notebookImports))
  const workspaceSpecifiers = JSON.stringify(
    Object.keys(workspace.imports ?? {}),
  )
  const octaneImport = needsOctane
    ? "import { octane } from 'octane/compiler/vite'\n"
    : ''
  const octanePlugin = needsOctane
    ? '    octane({ requireDirective: true }),\n'
    : ''

  return `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import packageJson from '../package.json'
${octaneImport}
const builtInSpecifiers = ${builtInSpecifiers}
const workspaceSpecifiers = ${workspaceSpecifiers}
const installedPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
])
const sharedRuntimePackages = new Set(['react', 'react-dom'])

function matchesImportMap(specifiers, source) {
  return specifiers.some((specifier) =>
    specifier.endsWith('/')
      ? source.startsWith(specifier)
      : source === specifier,
  )
}

function getPackageName(source) {
  const segments = source.split('/')
  return source.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0]
}

const importMapExternals = {
  name: 'tanstack-notebook-import-map',
  enforce: 'pre',
  resolveId(source) {
    const usesWorkspaceImport = matchesImportMap(workspaceSpecifiers, source)
    const packageName = getPackageName(source)
    const usesBuiltInImport =
      matchesImportMap(builtInSpecifiers, source) &&
      (sharedRuntimePackages.has(packageName) ||
        !installedPackages.has(packageName))

    if (usesWorkspaceImport || usesBuiltInImport) {
      return { id: source, external: true }
    }
  },
}

export default defineConfig({
  plugins: [
    importMapExternals,
${octanePlugin}    react(),
  ],
})
`
}

function removeAuthoredEntryScripts(source: string, entry: string) {
  return source.replace(
    /<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/script\s*>/gi,
    (script: string, _quote: string, src: string) => {
      if (!/\btype\s*=\s*(["'])module\1/i.test(script)) return script
      try {
        const url = new URL(src, 'https://tanstack.example/')
        return url.origin === 'https://tanstack.example' &&
          url.pathname === entry
          ? ''
          : script
      } catch {
        return script
      }
    },
  )
}

function injectBeforeClosingTag(
  source: string,
  tag: 'body' | 'head',
  value: string,
) {
  const closingTag = `</${tag}>`
  const index = source.toLowerCase().lastIndexOf(closingTag)
  if (index === -1) return `${source}${value}`
  return `${source.slice(0, index)}${value}${source.slice(index)}`
}

function escapeScriptText(value: string) {
  return value.replaceAll('</script', '<\\/script')
}

function parseNotebookAiPackage(source: string): Record<string, unknown> {
  let manifest: unknown
  try {
    manifest = JSON.parse(source)
  } catch {
    throw new Error('Invalid /package.json')
  }
  if (!isRecord(manifest)) throw new Error('Invalid /package.json')

  readPackageSection(manifest, 'scripts')
  readPackageSection(manifest, 'dependencies')
  readPackageSection(manifest, 'devDependencies')
  return manifest
}

function readPackageSection(
  manifest: Record<string, unknown>,
  section: 'dependencies' | 'devDependencies' | 'scripts',
) {
  const value = manifest[section]
  if (value === undefined) return {}
  if (!isStringRecord(value)) {
    throw new Error(`Invalid /package.json ${section}`)
  }
  return value
}

function stringifyNotebookAiPackage(manifest: Record<string, unknown>) {
  const source = `${JSON.stringify(manifest, null, 2)}\n`
  if (new TextEncoder().encode(source).byteLength > maxFileBytes) {
    throw new Error('Package manifest is too large')
  }
  return source
}

function omitKeys(source: Record<string, string>, keys: ReadonlySet<string>) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.has(key)),
  )
}

function hasInvalidNumericPrerelease(version: string) {
  const prerelease = version.split('-', 2)[1]
  return Boolean(
    prerelease
      ?.split('.')
      .some(
        (identifier) =>
          identifier.length > 1 &&
          identifier.startsWith('0') &&
          /^\d+$/.test(identifier),
      ),
  )
}

function withNotebookAiWorkspace(
  current: NotebookAiWorkspaceState,
  workspace: ExampleWorkspace,
): NotebookAiWorkspaceState {
  return current.runtime
    ? { workspace, runtime: current.runtime }
    : { workspace }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

function assertEditablePath(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
  path: string,
) {
  if (!isCanonicalExamplePath(path) || workspace.files[path] === undefined) {
    throw new Error(`Notebook file not found: ${path}`)
  }

  if (hiddenFiles.includes(path)) {
    throw new Error(`Notebook file is hidden from AI: ${path}`)
  }

  if (
    hasNotebookAiManagedScaffold(workspace) &&
    isNotebookAiManagedPath(path)
  ) {
    throw new Error(`Notebook file is managed by the runtime: ${path}`)
  }
}
