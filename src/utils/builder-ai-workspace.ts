import {
  createExampleWorkspace,
  isCanonicalExamplePath,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'
import {
  exampleEnvironmentProfiles,
  builderImports,
} from './builder-environment'

const maxFileBytes = 512 * 1024
const builderAiScaffoldDirectory = '/.tanstack'
const builderAiEntryPath = '/.tanstack/main.ts'
const builderAiScaffoldMarkerPath = '/.tanstack/builder-ai.json'
const builderAiViteConfigPath = '/.tanstack/vite.config.ts'
const builderAiDocumentPath = '/index.html'
const builderAiPackagePath = '/package.json'
const npmPackageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const npmPackageVersionPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9a-z-]+(?:\.[0-9a-z-]+)*)?$/i
const builderAiScaffoldMarkerSource = '{"version":1}\n'
const builderAiDevScript =
  'vite --config .tanstack/vite.config.ts --host 0.0.0.0'
const builderAiDefaultDocumentSource = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TanStack Builder</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`
const builderAiThemeSource = `:root {
  color-scheme: light;
  --builder-background: #fff;
  --builder-foreground: #111;
  --builder-error: #b91c1c;
  --ts-chart-1: #3aa3c4;
  --ts-chart-2: #d3481b;
  --ts-chart-3: #39af46;
  --ts-chart-4: #b64cc7;
  --ts-chart-5: #ffa216;
  --ts-chart-6: #3e3529;
}
:root.dark {
  color-scheme: dark;
  --builder-background: #111;
  --builder-foreground: #d4d4d4;
  --builder-error: #e06e49;
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
    --builder-background: #111;
    --builder-foreground: #d4d4d4;
    --builder-error: #e06e49;
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
  background: var(--builder-background);
  color: var(--builder-foreground);
}
`

export type BuilderAiWorkspaceState = {
  workspace: ExampleWorkspace
  runtime?: ExampleRuntime
}

export type BuilderAiFile = {
  path: string
  characters: number
}

export function listBuilderAiFiles(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
) {
  const hidden = new Set(hiddenFiles)
  const hasManagedScaffold = hasBuilderAiManagedScaffold(workspace)

  return Object.entries(workspace.files)
    .filter(
      ([path]) =>
        !hidden.has(path) &&
        !(hasManagedScaffold && isBuilderAiManagedPath(path)),
    )
    .map(([path, source]) => ({ path, characters: source.length }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

export function readBuilderAiFile(
  workspace: ExampleWorkspace,
  hiddenFiles: ReadonlyArray<string>,
  path: string,
) {
  assertEditablePath(workspace, hiddenFiles, path)
  return workspace.files[path]
}

export function replaceBuilderAiFile(
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

export function getChangedBuilderAiFiles(
  before: ExampleWorkspace,
  after: ExampleWorkspace,
) {
  return [
    ...new Set([...Object.keys(before.files), ...Object.keys(after.files)]),
  ]
    .filter((path) => before.files[path] !== after.files[path])
    .sort()
}

export function installBuilderAiPackage(
  current: BuilderAiWorkspaceState,
  packageName: string,
  version: string,
): BuilderAiWorkspaceState {
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

  const source = current.workspace.files[builderAiPackagePath]
  if (source === undefined) {
    throw new Error('Package installation requires /package.json')
  }

  const manifest = parseBuilderAiPackage(source)
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

  return withBuilderAiWorkspace(
    current,
    createExampleWorkspace({
      binaryFiles: current.workspace.binaryFiles,
      entry: current.workspace.entry,
      environment: current.workspace.environment,
      files: {
        ...current.workspace.files,
        [builderAiPackagePath]: packageSource,
      },
      imports: current.workspace.imports,
    }),
  )
}

export function upgradeBuilderAiWorkspaceToWebContainer(
  current: BuilderAiWorkspaceState,
): BuilderAiWorkspaceState {
  if (current.runtime) {
    throw new Error('Builder already uses a WebContainer runtime')
  }

  const textPaths = Object.keys(current.workspace.files)
  const binaryPaths = Object.keys(current.workspace.binaryFiles ?? {})
  const collision = [...textPaths, ...binaryPaths].find(
    isBuilderAiScaffoldCollision,
  )
  if (collision) {
    throw new Error(`Builder file is reserved for WebContainer: ${collision}`)
  }
  const binaryRootCollision = binaryPaths.find(
    (path) => path === builderAiDocumentPath || path === builderAiPackagePath,
  )
  if (binaryRootCollision) {
    throw new Error(
      `Builder file must be text for WebContainer: ${binaryRootCollision}`,
    )
  }

  const needsOctane = textPaths.some((path) => path.endsWith('.tsrx'))
  const packageSource = createBuilderAiPackageSource(
    current.workspace.files[builderAiPackagePath],
    needsOctane,
  )
  const documentSource = createBuilderAiDocumentSource(current.workspace)

  const workspace = createExampleWorkspace({
    binaryFiles: current.workspace.binaryFiles,
    entry: current.workspace.entry,
    environment: current.workspace.environment,
    files: {
      ...current.workspace.files,
      [builderAiEntryPath]: createBuilderAiEntrySource(current.workspace),
      [builderAiScaffoldMarkerPath]: builderAiScaffoldMarkerSource,
      [builderAiViteConfigPath]: createBuilderAiViteConfigSource(
        current.workspace,
        needsOctane,
      ),
      [builderAiDocumentPath]: documentSource,
      [builderAiPackagePath]: packageSource,
    },
    imports: current.workspace.imports,
  })

  return { workspace, runtime: createBuilderAiWebContainerRuntime() }
}

function createBuilderAiWebContainerRuntime(): ExampleRuntime {
  return {
    type: 'webcontainer',
    install: { command: 'pnpm', args: ['install'] },
    start: { command: 'pnpm', args: ['run', 'dev'] },
  }
}

function createBuilderAiEntrySource(workspace: ExampleWorkspace) {
  const entry = `..${workspace.entry}`
  if (!workspace.environment) return `import ${JSON.stringify(entry)}\n`
  return exampleEnvironmentProfiles[workspace.environment].createEntrySource(
    entry,
  )
}

function isBuilderAiManagedPath(path: string) {
  return (
    path === builderAiScaffoldDirectory ||
    path.startsWith(`${builderAiScaffoldDirectory}/`) ||
    path === builderAiDocumentPath ||
    path.startsWith(`${builderAiDocumentPath}/`) ||
    path === builderAiPackagePath ||
    path.startsWith(`${builderAiPackagePath}/`)
  )
}

function isBuilderAiScaffoldCollision(path: string) {
  return (
    path === builderAiScaffoldDirectory ||
    path.startsWith(`${builderAiScaffoldDirectory}/`) ||
    path.startsWith(`${builderAiDocumentPath}/`) ||
    path.startsWith(`${builderAiPackagePath}/`)
  )
}

function hasBuilderAiManagedScaffold(workspace: ExampleWorkspace) {
  return (
    workspace.files[builderAiScaffoldMarkerPath] ===
    builderAiScaffoldMarkerSource
  )
}

function createBuilderAiPackageSource(
  source: string | undefined,
  needsOctane: boolean,
) {
  const manifest = source === undefined ? {} : parseBuilderAiPackage(source)
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

  return stringifyBuilderAiPackage({
    ...manifest,
    private: true,
    type: 'module',
    scripts: { ...scripts, dev: builderAiDevScript },
    dependencies,
    devDependencies,
  })
}

function createBuilderAiDocumentSource(workspace: ExampleWorkspace) {
  const importMap = escapeScriptText(
    JSON.stringify({
      imports: { ...builderImports, ...workspace.imports },
    }),
  )
  const head = `
    <meta name="color-scheme" content="light dark" />
    <script type="importmap">${importMap}</script>
    <style>${builderAiThemeSource}</style>
  `
  const body = `
    <script type="module" src="${builderAiEntryPath}"></script>
  `
  const authoredDocument = workspace.files[builderAiDocumentPath]
  const source =
    authoredDocument !== undefined
      ? removeAuthoredEntryScripts(authoredDocument, workspace.entry)
      : builderAiDefaultDocumentSource

  return injectBeforeClosingTag(
    injectBeforeClosingTag(source, 'head', head),
    'body',
    body,
  )
}

function createBuilderAiViteConfigSource(
  workspace: ExampleWorkspace,
  needsOctane: boolean,
) {
  const builtInSpecifiers = JSON.stringify(Object.keys(builderImports))
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
  name: 'tanstack-builder-import-map',
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

function parseBuilderAiPackage(source: string): Record<string, unknown> {
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

function stringifyBuilderAiPackage(manifest: Record<string, unknown>) {
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

function withBuilderAiWorkspace(
  current: BuilderAiWorkspaceState,
  workspace: ExampleWorkspace,
): BuilderAiWorkspaceState {
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
    throw new Error(`Builder file not found: ${path}`)
  }

  if (hiddenFiles.includes(path)) {
    throw new Error(`Builder file is hidden from AI: ${path}`)
  }

  if (hasBuilderAiManagedScaffold(workspace) && isBuilderAiManagedPath(path)) {
    throw new Error(`Builder file is managed by the runtime: ${path}`)
  }
}
