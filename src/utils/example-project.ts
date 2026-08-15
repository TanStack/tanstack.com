import {
  isCanonicalExamplePath,
  parseExampleWorkspace,
  serializeExampleWorkspace,
  type ExampleDefinition,
  type ExampleRuntime,
  type ExampleWorkspace,
} from './example-workspace'

export const sharedExampleProjectVersion = 1

export type SharedExampleProject = {
  version: typeof sharedExampleProjectVersion
  title: string
  description: string
  initialFile?: string
  hiddenFiles?: ReadonlyArray<string>
  runtime?: ExampleRuntime
  workspace: ExampleWorkspace
}

export function createSharedExampleProject({
  title,
  description = '',
  initialFile,
  hiddenFiles,
  runtime,
  workspace,
}: {
  title: string
  description?: string
  initialFile?: string
  hiddenFiles?: ReadonlyArray<string>
  runtime?: ExampleRuntime
  workspace: ExampleWorkspace
}): SharedExampleProject {
  return {
    version: sharedExampleProjectVersion,
    title,
    description,
    ...(initialFile ? { initialFile } : {}),
    ...(hiddenFiles?.length ? { hiddenFiles: [...hiddenFiles] } : {}),
    ...(runtime ? { runtime } : {}),
    workspace,
  }
}

export function serializeSharedExampleProject(project: SharedExampleProject) {
  return JSON.stringify({
    version: project.version,
    title: project.title,
    description: project.description,
    ...(project.initialFile ? { initialFile: project.initialFile } : {}),
    ...(project.hiddenFiles?.length
      ? { hiddenFiles: project.hiddenFiles }
      : {}),
    ...(project.runtime ? { runtime: project.runtime } : {}),
    workspace: JSON.parse(serializeExampleWorkspace(project.workspace)),
  })
}

export function parseSharedExampleProject(
  value: unknown,
): SharedExampleProject {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'version',
      'title',
      'description',
      'initialFile',
      'hiddenFiles',
      'runtime',
      'workspace',
    ]) ||
    value.version !== sharedExampleProjectVersion ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    (value.initialFile !== undefined &&
      (typeof value.initialFile !== 'string' ||
        !isCanonicalExamplePath(value.initialFile))) ||
    (value.hiddenFiles !== undefined &&
      (!Array.isArray(value.hiddenFiles) ||
        !value.hiddenFiles.every(
          (path) => typeof path === 'string' && isCanonicalExamplePath(path),
        ) ||
        new Set(value.hiddenFiles).size !== value.hiddenFiles.length)) ||
    (value.runtime !== undefined && !isExampleRuntime(value.runtime))
  ) {
    throw new Error('Invalid shared example project')
  }

  const workspace = parseExampleWorkspace(value.workspace)
  if (
    value.initialFile !== undefined &&
    workspace.files[value.initialFile] === undefined
  ) {
    throw new Error('Invalid shared example project')
  }
  if (
    value.hiddenFiles?.some(
      (path) =>
        workspace.files[path] === undefined || path === value.initialFile,
    )
  ) {
    throw new Error('Invalid shared example project')
  }

  return createSharedExampleProject({
    title: value.title,
    description: value.description,
    initialFile: value.initialFile,
    hiddenFiles: value.hiddenFiles,
    runtime: value.runtime,
    workspace,
  })
}

export function sharedProjectToExampleDefinition(
  id: string,
  project: SharedExampleProject,
): ExampleDefinition {
  return {
    id,
    title: project.title,
    ...(project.description ? { description: project.description } : {}),
    ...(project.initialFile ? { initialFile: project.initialFile } : {}),
    ...(project.hiddenFiles?.length
      ? { hiddenFiles: project.hiddenFiles }
      : {}),
    ...(project.runtime ? { runtime: project.runtime } : {}),
    workspace: project.workspace,
  }
}

function isExampleRuntime(value: unknown): value is ExampleRuntime {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['type', 'compatibility', 'install', 'start']) &&
    value.type === 'webcontainer' &&
    (value.compatibility === undefined ||
      value.compatibility === 'tanstack-start-async-context') &&
    isExampleRuntimeCommand(value.install) &&
    isExampleRuntimeCommand(value.start)
  )
}

function isExampleRuntimeCommand(value: unknown) {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['command', 'args']) &&
    typeof value.command === 'string' &&
    value.command.trim().length > 0 &&
    Array.isArray(value.args) &&
    value.args.every((arg) => typeof arg === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
