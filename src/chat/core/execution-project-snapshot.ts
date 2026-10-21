import { z } from 'zod'
import { executionArtifact } from './execution-artifact'

export const maxProjectSnapshotBytes = 32 * 1024 * 1024
export const maxSessionSnapshotBytes = 128 * 1024 * 1024
export const maxSessionSnapshots = 32
export const maxProjectSnapshotEntries = 10_000
const maxHeaderBytes = 8 * 1024 * 1024
const magic = new TextEncoder().encode('GUMSNAP1')
const prefixBytes = 12
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const identity = z
  .object({
    userId: z.string().min(1).max(1000),
    workspaceId: z.string().min(1).max(1000),
    botId: z.string().min(1).max(1000),
    conversationId: z.string().min(1).max(1000),
  })
  .strict()
export const executionProjectSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('trusted-fixture'), digest: hash }).strict(),
  z
    .object({
      source: z.literal('snapshot'),
      snapshotId: z.uuid(),
      digest: hash,
    })
    .strict(),
])
export type ExecutionProject = z.infer<typeof executionProjectSchema>
export const projectSnapshotMetadataSchema = z
  .object({
    snapshotId: z.uuid(),
    format: z.literal(1),
    workspaceVersion: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    byteLength: integer.min(prefixBytes + 1).max(maxProjectSnapshotBytes),
    sha256: hash,
    fileCount: integer.max(maxProjectSnapshotEntries),
  })
  .strict()
export type ProjectSnapshotMetadata = z.infer<
  typeof projectSnapshotMetadataSchema
>
export const projectSnapshotRecordSchema = projectSnapshotMetadataSchema
  .extend({
    identity,
    sessionId: z.uuid(),
    hostGeneration: integer.positive(),
    runtimeId: z.uuid(),
    commandDigest: hash,
    artifact: z
      .object({
        adapter: z.literal(executionArtifact.adapter),
        apiVersion: z.literal(executionArtifact.apiVersion),
        tarballSHA256: z.literal(executionArtifact.tarballSHA256),
        manifestSHA256: z.literal(executionArtifact.manifestSHA256),
      })
      .strict(),
    createdAt: integer,
    state: z.enum(['pending', 'ready', 'unavailable']),
  })
  .strict()
export type ProjectSnapshotRecord = z.infer<typeof projectSnapshotRecordSchema>

// Structural counterpart of the pinned SDK's public WorkspaceSnapshot type.
// This module is shared by the Worker and browser, with no runtime SDK import.
export type ProjectWorkspaceSnapshot =
  | { version: 1; files: Record<string, Uint8Array> }
  | { version: 2; files: Record<string, Uint8Array>; directories: string[] }
  | {
      version: 3
      files: Record<string, Uint8Array>
      directories: string[]
      symlinks: Record<string, string>
    }
  | {
      version: 4
      files: Record<string, Uint8Array>
      directories: string[]
      symlinks: Record<string, string>
      fileModes: Record<string, number>
    }
  | {
      version: 5
      files: Record<string, Uint8Array>
      directories: string[]
      symlinks: Record<string, string>
      fileModes: Record<string, number>
      directoryModes: Record<string, number>
    }

const path = z
  .string()
  .min(2)
  .max(4096)
  .refine(
    (value) =>
      value.startsWith('/') &&
      new TextEncoder().encode(value).byteLength <= 4096 &&
      !/[\u0000-\u001f\u007f\\]/.test(value) &&
      value
        .slice(1)
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
  )
const directory = z.union([z.literal('/'), path])
const linkTarget = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => !/[\u0000-\u001f\u007f\\]/.test(value))
const mode = integer.max(0o7777)
const files = z
  .array(
    z.object({ path, length: integer.max(maxProjectSnapshotBytes) }).strict(),
  )
  .max(maxProjectSnapshotEntries)
const directories = z.array(directory).max(maxProjectSnapshotEntries)
const symlinks = z
  .array(z.object({ path, target: linkTarget }).strict())
  .max(maxProjectSnapshotEntries)
const fileModes = z
  .array(z.object({ path, mode }).strict())
  .max(maxProjectSnapshotEntries)
const directoryModes = z
  .array(z.object({ path: directory, mode }).strict())
  .max(maxProjectSnapshotEntries + 1)
const base = {
  format: z.literal('gum-workspace-snapshot'),
  version: z.literal(1),
  files,
}
const headerSchema = z.discriminatedUnion('workspaceVersion', [
  z.object({ ...base, workspaceVersion: z.literal(1) }).strict(),
  z.object({ ...base, workspaceVersion: z.literal(2), directories }).strict(),
  z
    .object({ ...base, workspaceVersion: z.literal(3), directories, symlinks })
    .strict(),
  z
    .object({
      ...base,
      workspaceVersion: z.literal(4),
      directories,
      symlinks,
      fileModes,
    })
    .strict(),
  z
    .object({
      ...base,
      workspaceVersion: z.literal(5),
      directories,
      symlinks,
      fileModes,
      directoryModes,
    })
    .strict(),
])
type Header = z.infer<typeof headerSchema>
export class ProjectSnapshotError extends Error {
  constructor(message = 'The project snapshot is invalid or unsupported.') {
    super(message)
    this.name = 'ProjectSnapshotError'
  }
}
function validateHeader(value: unknown): Header {
  const parsed = headerSchema.safeParse(value)
  if (!parsed.success) throw new ProjectSnapshotError()
  const header = parsed.data
  const entries = new Map<string, 'file' | 'directory' | 'symlink'>()
  const add = (path: string, kind: 'file' | 'directory' | 'symlink') => {
    if (entries.has(path))
      throw new ProjectSnapshotError(
        'The project snapshot has conflicting paths.',
      )
    entries.set(path, kind)
    if (entries.size - Number(entries.has('/')) > maxProjectSnapshotEntries)
      throw new ProjectSnapshotError(
        'The project snapshot has too many files and directories.',
      )
  }
  header.files.forEach((file) => add(file.path, 'file'))
  if ('directories' in header)
    header.directories.forEach((path) => add(path, 'directory'))
  if ('symlinks' in header)
    header.symlinks.forEach((link) => add(link.path, 'symlink'))
  entries.set('/', 'directory')
  const validatedAncestors = new Set(['/'])
  // Walk each ancestor once. Iterating this growing map directly would visit
  // every newly inferred directory and repeatedly walk a deep path's parents.
  for (const entry of [...entries.keys()]) {
    let parent = entry.slice(0, entry.lastIndexOf('/'))
    const ancestors: string[] = []
    while (parent) {
      const kind = entries.get(parent)
      if (kind && kind !== 'directory')
        throw new ProjectSnapshotError(
          'The project snapshot has conflicting paths.',
        )
      if (validatedAncestors.has(parent)) break
      if (!kind) add(parent, 'directory')
      ancestors.push(parent)
      parent = parent.slice(0, parent.lastIndexOf('/'))
    }
    for (const ancestor of ancestors) validatedAncestors.add(ancestor)
    validatedAncestors.add(entry)
  }
  if (entries.size - 1 > maxProjectSnapshotEntries)
    throw new ProjectSnapshotError(
      'The project snapshot has too many files and directories.',
    )
  for (const [modes, kind] of [
    ['fileModes' in header ? header.fileModes : [], 'file'],
    ['directoryModes' in header ? header.directoryModes : [], 'directory'],
  ] as const) {
    const seen = new Set<string>()
    for (const entry of modes) {
      if (seen.has(entry.path) || entries.get(entry.path) !== kind)
        throw new ProjectSnapshotError(
          'The project snapshot has invalid file modes.',
        )
      seen.add(entry.path)
    }
    if (
      (kind === 'file' && 'fileModes' in header) ||
      (kind === 'directory' && 'directoryModes' in header)
    ) {
      if (
        seen.size !==
        [...entries.values()].filter((value) => value === kind).length
      )
        throw new ProjectSnapshotError(
          'The project snapshot has incomplete file modes.',
        )
    }
  }
  return header
}
const order = ([left]: [string, unknown], [right]: [string, unknown]) =>
  left < right ? -1 : left > right ? 1 : 0

/** No compression or executable deserializer. File bytes remain raw and exact. */
export function encodeProjectSnapshot(
  snapshot: ProjectWorkspaceSnapshot,
): Uint8Array<ArrayBuffer> {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    !snapshot.files ||
    typeof snapshot.files !== 'object'
  )
    throw new ProjectSnapshotError()
  const entries = Object.entries(snapshot.files).sort(order)
  if (entries.some(([, bytes]) => !(bytes instanceof Uint8Array)))
    throw new ProjectSnapshotError()
  const header = validateHeader({
    format: 'gum-workspace-snapshot',
    version: 1,
    workspaceVersion: snapshot.version,
    files: entries.map(([path, bytes]) => ({ path, length: bytes.byteLength })),
    ...('directories' in snapshot
      ? { directories: [...snapshot.directories].sort() }
      : {}),
    ...('symlinks' in snapshot
      ? {
          symlinks: Object.entries(snapshot.symlinks)
            .sort(order)
            .map(([path, target]) => ({ path, target })),
        }
      : {}),
    ...('fileModes' in snapshot
      ? {
          fileModes: Object.entries(snapshot.fileModes)
            .sort(order)
            .map(([path, mode]) => ({ path, mode })),
        }
      : {}),
    ...('directoryModes' in snapshot
      ? {
          directoryModes: Object.entries(snapshot.directoryModes)
            .sort(order)
            .map(([path, mode]) => ({ path, mode })),
        }
      : {}),
  })
  const metadata = new TextEncoder().encode(JSON.stringify(header))
  const size =
    prefixBytes +
    metadata.byteLength +
    entries.reduce((sum, [, bytes]) => sum + bytes.byteLength, 0)
  if (metadata.byteLength > maxHeaderBytes || size > maxProjectSnapshotBytes)
    throw new ProjectSnapshotError(
      'The project snapshot exceeds the 32 MiB limit.',
    )
  const result = new Uint8Array(size)
  result.set(magic)
  new DataView(result.buffer).setUint32(8, metadata.byteLength, false)
  result.set(metadata, prefixBytes)
  let offset = prefixBytes + metadata.byteLength
  for (const [, bytes] of entries) {
    result.set(bytes, offset)
    offset += bytes.byteLength
  }
  return result
}

function readHeader(bytes: Uint8Array) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength <= prefixBytes ||
    bytes.byteLength > maxProjectSnapshotBytes ||
    magic.some((byte, index) => bytes[index] !== byte)
  )
    throw new ProjectSnapshotError()
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(8, false)
  if (
    !length ||
    length > maxHeaderBytes ||
    prefixBytes + length > bytes.byteLength
  )
    throw new ProjectSnapshotError()
  let value: unknown
  try {
    value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        bytes.subarray(prefixBytes, prefixBytes + length),
      ),
    )
  } catch {
    throw new ProjectSnapshotError()
  }
  const header = validateHeader(value)
  const offset = prefixBytes + length
  if (
    header.files.reduce((sum, file) => sum + file.length, offset) !==
    bytes.byteLength
  )
    throw new ProjectSnapshotError(
      'The project snapshot byte lengths do not match.',
    )
  return { header, offset }
}
export function decodeProjectSnapshot(
  bytes: Uint8Array,
): ProjectWorkspaceSnapshot {
  const { header, offset: start } = readHeader(bytes)
  let offset = start
  const files = Object.fromEntries(
    header.files.map((file) => {
      const value = bytes.subarray(offset, offset + file.length)
      offset += file.length
      return [file.path, value]
    }),
  )
  return {
    version: header.workspaceVersion,
    files,
    ...('directories' in header ? { directories: header.directories } : {}),
    ...('symlinks' in header
      ? {
          symlinks: Object.fromEntries(
            header.symlinks.map((link) => [link.path, link.target]),
          ),
        }
      : {}),
    ...('fileModes' in header
      ? {
          fileModes: Object.fromEntries(
            header.fileModes.map((entry) => [entry.path, entry.mode]),
          ),
        }
      : {}),
    ...('directoryModes' in header
      ? {
          directoryModes: Object.fromEntries(
            header.directoryModes.map((entry) => [entry.path, entry.mode]),
          ),
        }
      : {}),
  } as ProjectWorkspaceSnapshot
}
export async function inspectProjectSnapshot(
  bytes: Uint8Array,
): Promise<Omit<ProjectSnapshotMetadata, 'snapshotId'>> {
  const { header } = readHeader(bytes)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes as Uint8Array<ArrayBuffer>,
  )
  return {
    format: 1,
    workspaceVersion: header.workspaceVersion,
    byteLength: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
    fileCount: header.files.length,
  }
}
