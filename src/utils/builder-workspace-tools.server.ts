import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import type { BuilderAiExecution } from './builder-ai'
import {
  getChangedBuilderAiFiles,
  installBuilderAiPackage,
  listBuilderAiFiles,
  readBuilderAiFile,
  replaceBuilderAiFile,
  upgradeBuilderAiWorkspaceToWebContainer,
  type BuilderAiWorkspaceState,
} from './builder-ai-workspace'
import {
  createBuilderAiPackageFetchState,
  inspectBuilderAiModule,
  readBuilderAiPackageResource,
  searchBuilderAiPackageResources,
} from './builder-ai-package-resources'
import type { BuilderAiProgressGate } from './builder-ai-progress'
import { builderImportAliases } from './builder-environment'

const maxReadCharacters = 50_000
const maxToolResultCharacters = 400_000

export function createWorkspaceTools(
  getExecution: () => BuilderAiExecution,
  setExecution: (execution: BuilderAiExecution) => void,
  hiddenFiles: ReadonlyArray<string>,
  signal: AbortSignal,
  progressGate: BuilderAiProgressGate,
  syncValidationState: () => void,
) {
  const packageFetchState = createBuilderAiPackageFetchState()
  let toolResultCharacters = 0

  function recordToolResult<Result>(result: Result) {
    toolResultCharacters += JSON.stringify(result).length
    if (toolResultCharacters > maxToolResultCharacters) {
      throw new Error('Builder AI tool output limit reached')
    }
    return result
  }

  const describeBuilder = toolDefinition({
    name: 'describe_project',
    description:
      'Describe the builder runtime, entry, built-in imports, workspace import overrides, and package manifest. Call this first.',
    inputSchema: z.object({}),
  }).server(() => {
    const execution = getExecution()
    const packageJson = execution.workspace.files['/package.json'] ?? null
    return recordToolResult({
      runtime: execution.runtime ? 'webcontainer' : 'client',
      entry: execution.workspace.entry,
      environment: execution.workspace.environment ?? null,
      builtInImports: builderImportAliases,
      workspaceImports: execution.workspace.imports ?? {},
      packageJson: packageJson?.slice(0, maxReadCharacters) ?? null,
      packageJsonTruncated:
        packageJson !== null && packageJson.length > maxReadCharacters,
    })
  })

  const listFiles = toolDefinition({
    name: 'list_files',
    description: 'List editable text files in the builder.',
    inputSchema: z.object({}),
  }).server(() =>
    recordToolResult({
      files: listBuilderAiFiles(getExecution().workspace, hiddenFiles),
    }),
  )

  const readFile = toolDefinition({
    name: 'read_file',
    description:
      'Read an editable builder text file. Reads at most 50,000 characters; use nextOffset to continue when the result is truncated.',
    inputSchema: z.object({
      path: z.string(),
      offset: z.number().int().min(0).optional(),
    }),
  }).server(({ path, offset = 0 }) => {
    const source = readBuilderAiFile(
      getExecution().workspace,
      hiddenFiles,
      path,
    )
    if (offset > source.length) {
      throw new Error(`Read offset exceeds file length: ${path}`)
    }
    const end = Math.min(source.length, offset + maxReadCharacters)
    const result = recordToolResult({
      path,
      content: source.slice(offset, end),
      offset,
      totalCharacters: source.length,
      nextOffset: end < source.length ? end : null,
    })
    progressGate.recordEvidence('read_file', { path, offset }, result)
    syncValidationState()
    return result
  })

  const inspectModule = toolDefinition({
    name: 'inspect_module',
    description:
      'Inspect the exact installed or built-in npm module export map, detected runtime and declaration exports, declarations, and runtime source. Use this whenever a package API is uncertain or implicated in a failure.',
    inputSchema: z.object({ specifier: z.string().min(1).max(512) }),
  }).server(async ({ specifier }) => {
    const result = await inspectBuilderAiModule(getExecution(), specifier, {
      fetchState: packageFetchState,
      signal,
    })
    const recorded = recordToolResult(result)
    progressGate.recordEvidence('inspect_module', { specifier }, recorded)
    syncValidationState()
    return recorded
  })

  const searchPackageResources = toolDefinition({
    name: 'search_package_resources',
    description:
      'Search version-matched npm package paths for declarations, source, docs, llms.txt, and permitted @tanstack Intent skills. The query matches resource paths; use an empty query to discover indexes and skills.',
    inputSchema: z.object({
      specifier: z.string().min(1).max(512),
      query: z.string().max(120).optional(),
    }),
  }).server(async ({ specifier, query = '' }) => {
    const result = recordToolResult(
      await searchBuilderAiPackageResources(getExecution(), specifier, query, {
        fetchState: packageFetchState,
        signal,
      }),
    )
    progressGate.recordEvidence(
      'search_package_resources',
      { specifier, query },
      result,
    )
    syncValidationState()
    return result
  })

  const readPackageResource = toolDefinition({
    name: 'read_package_resource',
    description:
      'Read a package resource returned by search_package_resources. Reads at most 50,000 characters; use nextOffset to continue. Only @tanstack packages may contribute Intent skills.',
    inputSchema: z.object({
      specifier: z.string().min(1).max(512),
      path: z.string().min(1).max(512),
      offset: z.number().int().min(0).optional(),
    }),
  }).server(async ({ specifier, path, offset = 0 }) => {
    const result = recordToolResult(
      await readBuilderAiPackageResource(
        getExecution(),
        specifier,
        path,
        offset,
        { fetchState: packageFetchState, signal },
      ),
    )
    progressGate.recordEvidence(
      'read_package_resource',
      { specifier, path, offset },
      result,
    )
    syncValidationState()
    return result
  })

  const replaceFile = toolDefinition({
    name: 'replace_file',
    description:
      'Replace an existing editable builder text file with complete new contents. Read it first and preserve unrelated code.',
    inputSchema: z.object({ path: z.string(), content: z.string() }),
  }).server(({ path, content }) => {
    const mutation = progressGate.assertCanMutate('replace_file', {
      path,
      content,
    })
    const current = getExecution()
    const workspace = replaceBuilderAiFile(
      current.workspace,
      hiddenFiles,
      path,
      content,
    )
    setExecution({ runtime: current.runtime, workspace })
    progressGate.recordMutation(mutation)
    syncValidationState()
    return recordToolResult({ path, characters: content.length })
  })

  const upgradeRuntime = toolDefinition({
    name: 'upgrade_runtime',
    description:
      'Upgrade a browser builder to the full React/Vite WebContainer runtime. Use this before installing a package that is not built into the client runtime. The host creates the scaffold and fixed commands.',
    inputSchema: z.object({}),
  }).server(() => {
    const mutation = progressGate.assertCanMutate('upgrade_runtime', {})
    const current = getExecution()
    const next = upgradeBuilderAiWorkspaceToWebContainer(
      toWorkspaceState(current),
    )
    const execution = toExecution(next)
    setExecution(execution)
    progressGate.recordMutation(mutation)
    syncValidationState()
    return recordToolResult({
      runtime: 'webcontainer',
      createdFiles: getChangedBuilderAiFiles(
        current.workspace,
        execution.workspace,
      ),
    })
  })

  const installDependency = toolDefinition({
    name: 'install_dependency',
    description:
      'Add or update one npm dependency in a WebContainer builder. Call upgrade_runtime first when the current runtime is client. Supply an exact version or omit it to resolve the current version from npm. This updates package.json; the host runs pnpm install.',
    inputSchema: z.object({
      name: z.string().min(1).max(214),
      version: z.string().min(1).max(128).optional(),
    }),
  }).server(async ({ name, version }) => {
    const mutation = progressGate.assertCanMutate('install_dependency', {
      name,
      ...(version ? { version } : {}),
    })
    const current = getExecution()
    if (!current.runtime) {
      throw new Error('Call upgrade_runtime before install_dependency')
    }
    const exactVersion =
      version ?? (await resolveNpmPackageVersion(name, signal))
    const execution = toExecution(
      installBuilderAiPackage(toWorkspaceState(current), name, exactVersion),
    )
    setExecution(execution)
    progressGate.recordMutation(mutation)
    syncValidationState()
    return recordToolResult({
      name,
      version: exactVersion,
      packageJson: '/package.json',
    })
  })

  return [
    describeBuilder,
    listFiles,
    readFile,
    inspectModule,
    searchPackageResources,
    readPackageResource,
    replaceFile,
    upgradeRuntime,
    installDependency,
  ]
}

function toWorkspaceState(
  execution: BuilderAiExecution,
): BuilderAiWorkspaceState {
  return execution.runtime
    ? { runtime: execution.runtime, workspace: execution.workspace }
    : { workspace: execution.workspace }
}

function toExecution(state: BuilderAiWorkspaceState): BuilderAiExecution {
  return { runtime: state.runtime ?? null, workspace: state.workspace }
}

async function resolveNpmPackageVersion(name: string, signal: AbortSignal) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  )
  if (!response.ok) {
    throw new Error(`npm could not resolve ${name} (${response.status})`)
  }

  const source = await response.text()
  if (source.length > 64 * 1024) {
    throw new Error(`npm returned an invalid package record for ${name}`)
  }

  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error(`npm returned an invalid package record for ${name}`)
  }
  if (!isRecord(value) || typeof value.version !== 'string') {
    throw new Error(`npm returned an invalid package record for ${name}`)
  }
  return value.version
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
