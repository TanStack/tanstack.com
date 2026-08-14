import {
  createExampleWorkspace,
  normalizeExamplePath,
  type ExampleDefinition,
} from './example-workspace'

export function createRepositoryExampleDefinition({
  description,
  entry,
  files,
  id,
  initialFile,
  title,
}: {
  description?: string
  entry: string
  files: Record<string, string>
  id: string
  initialFile?: string
  title: string
}): ExampleDefinition {
  const workspace = createExampleWorkspace({ entry, files })

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
    initialFile:
      workspace.files[normalizedInitialFile] === undefined
        ? workspace.entry
        : normalizedInitialFile,
    workspace,
  }
}
