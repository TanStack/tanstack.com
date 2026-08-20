import {
  createExampleWorkspace,
  normalizeExamplePath,
  type ExampleDefinition,
  type ExampleRuntime,
} from './example-workspace'

export function createRepositoryExampleDefinition({
  binaryFiles,
  entry,
  files,
  id,
  initialFile,
  runtime,
  title,
}: {
  binaryFiles?: Record<string, string>
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
    ...(runtime ? { runtime } : {}),
    initialFile:
      workspace.files[normalizedInitialFile] === undefined
        ? workspace.entry
        : normalizedInitialFile,
    workspace,
  }
}
