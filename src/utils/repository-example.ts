import {
  createExampleWorkspace,
  normalizeExamplePath,
  type ExampleDefinition,
  type ExampleRuntime,
} from './example-workspace'

export function createRepositoryExampleDefinition({
  binaryFiles,
  description,
  entry,
  files,
  id,
  initialFile,
  runtime,
  title,
}: {
  binaryFiles?: Record<string, string>
  description?: string
  entry: string
  files: Record<string, string>
  id: string
  initialFile?: string
  runtime?: ExampleRuntime
  title: string
}): ExampleDefinition {
  const workspace = createExampleWorkspace({ binaryFiles, entry, files })

  if (workspace.files[workspace.entry] === undefined) {
    throw new Error(`Entry file not found: ${workspace.entry}`)
  }

  const normalizedInitialFile = initialFile
    ? normalizeExamplePath(initialFile)
    : workspace.entry

  return {
    id,
    title,
    ...(description ? { description } : {}),
    ...(runtime ? { runtime } : {}),
    initialFile:
      workspace.files[normalizedInitialFile] === undefined
        ? workspace.entry
        : normalizedInitialFile,
    workspace,
  }
}

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
] as const
const tanstackAiPackagePrefix = '@tanstack/ai'
const workspaceProtocolVersion = 'workspace:*'
const npmLatestVersion = 'latest'

/**
 * Replace `workspace:*` versions for `@tanstack/ai` packages with `latest`.
 *
 * Looks for `package.json` or `/package.json`. If that file is missing or is
 * not valid JSON, the files stay the same.
 *
 * @param files - Example files, keyed by path
 *
 * @example
 * const files = rewriteWorkspaceProtocolDependencies({
 *   '/package.json': '{"dependencies":{"@tanstack/ai":"workspace:*"}}',
 * })
 */
export function rewriteWorkspaceProtocolDependencies(
  files: Record<string, string>,
) {
  const packageJson = getPackageJsonEntry(files)
  if (!packageJson) {
    return files
  }

  const parsed = parsePackageJson(packageJson.source)
  if (!parsed) {
    return files
  }

  let changed = false
  const nextPackageJson = { ...parsed }

  for (const field of dependencyFields) {
    const current = parsed[field]
    if (!isRecord(current)) {
      continue
    }

    const nextDependencies = rewriteTanStackAiWorkspaceDependencies(current)
    if (nextDependencies === current) {
      continue
    }

    nextPackageJson[field] = nextDependencies
    changed = true
  }

  if (!changed) {
    return files
  }

  return {
    ...files,
    [packageJson.path]: `${JSON.stringify(nextPackageJson, null, 2)}\n`,
  }
}

function getPackageJsonEntry(files: Record<string, string>) {
  const unprefixed = files['package.json']
  if (unprefixed !== undefined) {
    return { path: 'package.json', source: unprefixed }
  }

  const prefixed = files['/package.json']
  if (prefixed !== undefined) {
    return { path: '/package.json', source: prefixed }
  }

  return undefined
}

function parsePackageJson(source: string) {
  try {
    const value: unknown = JSON.parse(source)
    if (!isRecord(value)) {
      return undefined
    }
    return value
  } catch {
    return undefined
  }
}

function rewriteTanStackAiWorkspaceDependencies(
  dependencies: Record<string, unknown>,
) {
  const nextDependencies = { ...dependencies }
  let changed = false
  const packageNames = Object.keys(dependencies)

  for (const packageName of packageNames) {
    const isTanStackAiPackage = packageName.startsWith(tanstackAiPackagePrefix)
    const usesWorkspaceProtocol =
      dependencies[packageName] === workspaceProtocolVersion

    if (!isTanStackAiPackage || !usesWorkspaceProtocol) {
      continue
    }

    nextDependencies[packageName] = npmLatestVersion
    changed = true
  }

  if (!changed) {
    return dependencies
  }

  return nextDependencies
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
