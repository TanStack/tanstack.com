export const exampleWorkspaceVersion = 1

export const exampleEnvironmentNames = [
  'charts',
  'charts-react',
  'charts-octane',
] as const

export type ExampleEnvironment = (typeof exampleEnvironmentNames)[number]

export type ExampleWorkspace = {
  version: typeof exampleWorkspaceVersion
  entry: string
  environment?: ExampleEnvironment
  files: Record<string, string>
  imports?: Record<string, string>
}

export type ExampleDefinition = {
  id: string
  title: string
  description?: string
  initialFile?: string
  workspace: ExampleWorkspace
}

export function createExampleWorkspace({
  entry,
  environment,
  files,
  imports,
}: {
  entry: string
  environment?: ExampleEnvironment
  files: Record<string, string>
  imports?: Record<string, string>
}): ExampleWorkspace {
  const normalizedFiles: Record<string, string> = {}

  for (const [path, source] of Object.entries(files)) {
    normalizedFiles[normalizeExamplePath(path)] = source
  }

  return {
    version: exampleWorkspaceVersion,
    entry: normalizeExamplePath(entry),
    ...(environment ? { environment } : {}),
    files: normalizedFiles,
    ...(imports ? { imports: { ...imports } } : {}),
  }
}

export function normalizeExamplePath(path: string) {
  const segments: Array<string> = []

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  return `/${segments.join('/')}`
}

export function serializeExampleWorkspace(workspace: ExampleWorkspace) {
  const files = Object.fromEntries(
    Object.entries(workspace.files).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
  const imports = workspace.imports
    ? Object.fromEntries(
        Object.entries(workspace.imports).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      )
    : undefined

  return JSON.stringify({
    version: workspace.version,
    entry: workspace.entry,
    ...(workspace.environment ? { environment: workspace.environment } : {}),
    files,
    ...(imports ? { imports } : {}),
  })
}

export function parseExampleWorkspace(value: unknown): ExampleWorkspace {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'entry',
      'environment',
      'files',
      'imports',
    ]) ||
    value.version !== exampleWorkspaceVersion
  ) {
    throw new Error('Unsupported example workspace version')
  }

  if (
    typeof value.entry !== 'string' ||
    !isCanonicalExamplePath(value.entry) ||
    (value.environment !== undefined &&
      !isExampleEnvironment(value.environment)) ||
    !isStringRecord(value.files) ||
    !Object.keys(value.files).every(isCanonicalExamplePath) ||
    (value.imports !== undefined && !isStringRecord(value.imports))
  ) {
    throw new Error('Invalid example workspace')
  }

  const workspace = createExampleWorkspace({
    entry: value.entry,
    environment: value.environment,
    files: value.files,
    imports: value.imports,
  })

  if (workspace.files[workspace.entry] === undefined) {
    throw new Error(`Entry file not found: ${workspace.entry}`)
  }

  return workspace
}

export function isCanonicalExamplePath(path: string) {
  return (
    path.startsWith('/') &&
    path.length > 1 &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    !path.split('/').includes('..') &&
    normalizeExamplePath(path) === path
  )
}

export function isExampleEnvironment(
  value: unknown,
): value is ExampleEnvironment {
  return exampleEnvironmentNames.some((name) => name === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((source) => typeof source === 'string')
  )
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
