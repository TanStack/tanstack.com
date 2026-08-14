export const exampleWorkspaceVersion = 1

export const exampleEnvironmentNames = [
  'client',
  'react',
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
  binaryFiles?: Record<string, string>
  imports?: Record<string, string>
}

export type ExampleRuntime = {
  type: 'webcontainer'
  compatibility?: 'tanstack-start-async-context'
  install: ExampleRuntimeCommand
  start: ExampleRuntimeCommand
}

export type ExampleRuntimeCommand = {
  command: string
  args: Array<string>
}

export type ExampleDefinition = {
  id: string
  title: string
  description?: string
  initialFile?: string
  runtime?: ExampleRuntime
  workspace: ExampleWorkspace
}

export function createExampleWorkspace({
  binaryFiles,
  entry,
  environment,
  files,
  imports,
}: {
  binaryFiles?: Record<string, string>
  entry: string
  environment?: ExampleEnvironment
  files: Record<string, string>
  imports?: Record<string, string>
}): ExampleWorkspace {
  const normalizedFiles: Record<string, string> = {}
  const normalizedBinaryFiles: Record<string, string> = {}

  for (const [path, source] of Object.entries(files)) {
    normalizedFiles[normalizeExamplePath(path)] = source
  }

  for (const [path, source] of Object.entries(binaryFiles ?? {})) {
    const normalizedPath = normalizeExamplePath(path)
    if (normalizedFiles[normalizedPath] !== undefined) {
      throw new Error(`Duplicate example file path: ${normalizedPath}`)
    }
    normalizedBinaryFiles[normalizedPath] = source
  }

  return {
    version: exampleWorkspaceVersion,
    entry: normalizeExamplePath(entry),
    ...(environment ? { environment } : {}),
    files: normalizedFiles,
    ...(Object.keys(normalizedBinaryFiles).length
      ? { binaryFiles: normalizedBinaryFiles }
      : {}),
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
  const binaryFiles = workspace.binaryFiles
    ? Object.fromEntries(
        Object.entries(workspace.binaryFiles).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      )
    : undefined

  return JSON.stringify({
    version: workspace.version,
    entry: workspace.entry,
    ...(workspace.environment ? { environment: workspace.environment } : {}),
    files,
    ...(binaryFiles ? { binaryFiles } : {}),
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
      'binaryFiles',
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
    (value.binaryFiles !== undefined &&
      (!isStringRecord(value.binaryFiles) ||
        !Object.keys(value.binaryFiles).every(isCanonicalExamplePath) ||
        !Object.values(value.binaryFiles).every(isCanonicalBase64))) ||
    (value.imports !== undefined && !isStringRecord(value.imports))
  ) {
    throw new Error('Invalid example workspace')
  }

  const workspace = createExampleWorkspace({
    binaryFiles: value.binaryFiles,
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

export function encodeExampleBinaryFile(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeExampleBinaryFile(source: string) {
  const binary = atob(source)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
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

function isCanonicalBase64(value: string) {
  try {
    return encodeExampleBinaryFile(decodeExampleBinaryFile(value)) === value
  } catch {
    return false
  }
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
