import {
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'
import { decodeExampleBinaryFile } from './example-workspace'

const maxCanonicalBytes = 1024 * 1024
const maxFileBytes = 512 * 1024
const maxFiles = 128
const maxPathBytes = 512
const maxTitleCharacters = 160
const maxDescriptionCharacters = 1_000

export function validateBuilderProjectSnapshot(project: SharedExampleProject) {
  if (project.title.length === 0 || project.title.length > maxTitleCharacters) {
    throw new Error('Project title must be between 1 and 160 characters')
  }
  if (project.description.length > maxDescriptionCharacters) {
    throw new Error('Project description exceeds 1,000 characters')
  }

  const encoder = new TextEncoder()
  const files = [
    ...Object.entries(project.workspace.files).map(([path, source]) => ({
      byteLength: encoder.encode(source).byteLength,
      path,
    })),
    ...Object.entries(project.workspace.binaryFiles ?? {}).map(
      ([path, source]) => ({
        byteLength: decodeExampleBinaryFile(source).byteLength,
        path,
      }),
    ),
  ]
  if (files.length === 0 || files.length > maxFiles) {
    throw new Error('Projects must contain between 1 and 128 files')
  }

  for (const { byteLength, path } of files) {
    if (encoder.encode(path).byteLength > maxPathBytes) {
      throw new Error(`Builder path exceeds 512 bytes: ${path}`)
    }
    if (byteLength > maxFileBytes) {
      throw new Error(`Builder file exceeds 512 KiB: ${path}`)
    }
  }

  if (
    encoder.encode(serializeSharedExampleProject(project)).byteLength >
    maxCanonicalBytes
  ) {
    throw new Error('Project snapshot exceeds 1 MiB')
  }
}
