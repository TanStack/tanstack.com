import {
  isCanonicalExamplePath,
  parseExampleWorkspace,
  serializeExampleWorkspace,
  type ExampleDefinition,
  type ExampleWorkspace,
} from './example-workspace'

export const sharedExampleProjectVersion = 1

export type SharedExampleProject = {
  version: typeof sharedExampleProjectVersion
  title: string
  description: string
  initialFile?: string
  workspace: ExampleWorkspace
}

export function createSharedExampleProject({
  title,
  description = '',
  initialFile,
  workspace,
}: {
  title: string
  description?: string
  initialFile?: string
  workspace: ExampleWorkspace
}): SharedExampleProject {
  return {
    version: sharedExampleProjectVersion,
    title,
    description,
    ...(initialFile ? { initialFile } : {}),
    workspace,
  }
}

export function serializeSharedExampleProject(project: SharedExampleProject) {
  return JSON.stringify({
    version: project.version,
    title: project.title,
    description: project.description,
    ...(project.initialFile ? { initialFile: project.initialFile } : {}),
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
      'workspace',
    ]) ||
    value.version !== sharedExampleProjectVersion ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    (value.initialFile !== undefined &&
      (typeof value.initialFile !== 'string' ||
        !isCanonicalExamplePath(value.initialFile)))
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

  return createSharedExampleProject({
    title: value.title,
    description: value.description,
    initialFile: value.initialFile,
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
    workspace: project.workspace,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
