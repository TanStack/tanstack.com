import { describe, expect, it } from 'vitest'
import {
  decodeProjectSnapshot,
  encodeProjectSnapshot,
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
  maxProjectSnapshotEntries,
  projectSnapshotMetadataSchema,
  type ProjectWorkspaceSnapshot,
} from '../../src/chat/core/execution-project-snapshot'

const text = (value: string) => new TextEncoder().encode(value)
const fixture = (): ProjectWorkspaceSnapshot => ({
  version: 5,
  files: {
    '/project/source.txt': text(
      '\ufeff界😀 café\r\n<script>literal</script>\u0000',
    ),
    '/project/image.bin': new Uint8Array([0, 255, 128, 1, 2, 0]),
    '/project/empty.txt': new Uint8Array(),
  },
  directories: ['/project', '/project/empty'],
  symlinks: { '/project/link': 'source.txt', '/project/parent': '../project' },
  fileModes: {
    '/project/source.txt': 0o644,
    '/project/image.bin': 0o755,
    '/project/empty.txt': 0o644,
  },
  directoryModes: { '/': 0o755, '/project': 0o700, '/project/empty': 0o750 },
})
function wire(header: unknown, body = new Uint8Array()) {
  const json = text(JSON.stringify(header))
  const result = new Uint8Array(12 + json.byteLength + body.byteLength)
  result.set(text('GUMSNAP1'))
  new DataView(result.buffer).setUint32(8, json.byteLength, false)
  result.set(json, 12)
  result.set(body, 12 + json.byteLength)
  return result
}
const base = {
  format: 'gum-workspace-snapshot',
  version: 1,
  workspaceVersion: 1,
  files: [],
}

describe('portable project snapshots', () => {
  it('retains raw binary/text bytes, empty directories, symlinks and modes', async () => {
    const original = fixture()
    const encoded = encodeProjectSnapshot(original)
    expect(decodeProjectSnapshot(encoded)).toEqual(original)
    const metadata = await inspectProjectSnapshot(encoded)
    expect(metadata).toMatchObject({
      format: 1,
      workspaceVersion: 5,
      byteLength: encoded.byteLength,
      fileCount: 3,
    })
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(
      projectSnapshotMetadataSchema.safeParse({
        ...metadata,
        snapshotId: crypto.randomUUID(),
      }).success,
    ).toBe(true)
  })
  it.each([1, 2, 3, 4, 5] as const)(
    'preserves the public SDK version %s without inventing fields',
    (version) => {
      const original = fixture()
      const value = {
        version,
        files: original.files,
        ...(version >= 2
          ? {
              directories:
                'directories' in original ? original.directories : [],
            }
          : {}),
        ...(version >= 3
          ? { symlinks: 'symlinks' in original ? original.symlinks : {} }
          : {}),
        ...(version >= 4
          ? { fileModes: 'fileModes' in original ? original.fileModes : {} }
          : {}),
        ...(version >= 5
          ? {
              directoryModes:
                'directoryModes' in original ? original.directoryModes : {},
            }
          : {}),
      } as ProjectWorkspaceSnapshot
      expect(decodeProjectSnapshot(encodeProjectSnapshot(value))).toEqual(value)
    },
  )
  it('produces stable bytes regardless of filesystem enumeration order', async () => {
    const first = fixture()
    const second = fixture()
    second.files = Object.fromEntries(Object.entries(second.files).reverse())
    if ('directories' in second) second.directories.reverse()
    if ('symlinks' in second)
      second.symlinks = Object.fromEntries(
        Object.entries(second.symlinks).reverse(),
      )
    expect(encodeProjectSnapshot(second)).toEqual(encodeProjectSnapshot(first))
    expect(await inspectProjectSnapshot(encodeProjectSnapshot(second))).toEqual(
      await inspectProjectSnapshot(encodeProjectSnapshot(first)),
    )
  })
  it('accepts a view with a nonzero byte offset', () => {
    const encoded = encodeProjectSnapshot(fixture())
    const backing = new Uint8Array(encoded.length + 4)
    backing.set(encoded, 2)
    expect(decodeProjectSnapshot(backing.subarray(2, -2))).toEqual(fixture())
  })
  it('captures independent bytes when the original file is later changed', () => {
    const original = fixture()
    const encoded = encodeProjectSnapshot(original)
    original.files['/project/image.bin'].fill(0)
    expect(decodeProjectSnapshot(encoded).files['/project/image.bin']).toEqual(
      new Uint8Array([0, 255, 128, 1, 2, 0]),
    )
  })
  it('changes the hash when a raw file byte changes', async () => {
    const encoded = encodeProjectSnapshot(fixture())
    const changed = encoded.slice()
    changed[changed.length - 1] ^= 1
    expect((await inspectProjectSnapshot(changed)).sha256).not.toEqual(
      (await inspectProjectSnapshot(encoded)).sha256,
    )
  })
  it.each([
    { ...base, workspaceVersion: 6 },
    { ...base, secret: 'not a snapshot field' },
    { ...base, files: [{ path: '/project/a', length: -1 }] },
    { ...base, files: [{ path: '/project/a', length: 0.5 }] },
    { ...base, files: [{ path: '/project/a', length: 1 }] },
    {
      ...base,
      files: [
        { path: '/project/a', length: 0 },
        { path: '/project/a', length: 0 },
      ],
    },
    {
      ...base,
      files: [
        { path: '/project/a', length: 0 },
        { path: '/project/a/b', length: 0 },
      ],
    },
    {
      ...base,
      workspaceVersion: 2,
      files: [{ path: '/project/a', length: 0 }],
      directories: ['/project/a'],
    },
    {
      ...base,
      workspaceVersion: 3,
      directories: [],
      symlinks: [{ path: '/project/link', target: 'a\u0000b' }],
    },
    {
      ...base,
      workspaceVersion: 4,
      directories: [],
      symlinks: [],
      fileModes: [{ path: '/missing', mode: 0o644 }],
    },
    {
      ...base,
      workspaceVersion: 5,
      directories: ['/project'],
      symlinks: [],
      fileModes: [],
      directoryModes: [{ path: '/missing', mode: 0o755 }],
    },
    {
      ...base,
      workspaceVersion: 5,
      directories: ['/project'],
      symlinks: [],
      fileModes: [],
      directoryModes: [
        { path: '/project', mode: 0o755 },
        { path: '/project', mode: 0o700 },
      ],
    },
  ])('rejects malformed or conflicting filesystem metadata %#', (header) => {
    expect(() => decodeProjectSnapshot(wire(header))).toThrow()
  })
  it.each([
    'relative',
    '/',
    '/project/../outside',
    '/project/./a',
    '/project//a',
    '/project/a/',
    '/project/a\\b',
    '/project/\u0000a',
  ])('rejects noncanonical file path %j', (path) => {
    expect(() =>
      decodeProjectSnapshot(wire({ ...base, files: [{ path, length: 0 }] })),
    ).toThrow()
  })
  it('rejects truncated, extended, unsupported and invalid UTF-8 envelopes', () => {
    const encoded = encodeProjectSnapshot(fixture())
    expect(() => decodeProjectSnapshot(encoded.subarray(0, -1))).toThrow()
    const extra = new Uint8Array(encoded.length + 1)
    extra.set(encoded)
    expect(() => decodeProjectSnapshot(extra)).toThrow()
    const magic = encoded.slice()
    magic[0] = 0
    expect(() => decodeProjectSnapshot(magic)).toThrow()
    const size = encoded.slice()
    new DataView(size.buffer).setUint32(8, 0xffffffff, false)
    expect(() => decodeProjectSnapshot(size)).toThrow()
    const utf8 = wire(base)
    utf8[12] = 0xff
    expect(() => decodeProjectSnapshot(utf8)).toThrow()
  })
  it('bounds encoded bytes before allocating a combined buffer', () => {
    expect(() =>
      encodeProjectSnapshot({
        version: 1,
        files: { '/large': new Uint8Array(maxProjectSnapshotBytes) },
      }),
    ).toThrow(/32 MiB/)
    expect(() =>
      decodeProjectSnapshot(new Uint8Array(maxProjectSnapshotBytes + 1)),
    ).toThrow()
  })
  it('limits total entries across directories and files, including empty entries', () => {
    expect(() =>
      encodeProjectSnapshot({
        version: 2,
        files: { '/file': new Uint8Array() },
        directories: Array.from(
          { length: maxProjectSnapshotEntries },
          (_, i) => `/d${i}`,
        ),
      }),
    ).toThrow(/too many/)
  })
  it('counts implicit parent directories toward the SDK workspace quota', () => {
    const files = Object.fromEntries(
      Array.from({ length: 5001 }, (_, i) => [`/d${i}/file`, new Uint8Array()]),
    )
    expect(() => encodeProjectSnapshot({ version: 1, files })).toThrow(
      /too many/,
    )
  })
  it('retains root directory permissions even though the SDK omits root from directories', () => {
    const snapshot: ProjectWorkspaceSnapshot = {
      version: 5,
      files: { '/project/file': text('hello') },
      directories: ['/project'],
      symlinks: {},
      fileModes: { '/project/file': 0o600 },
      directoryModes: { '/': 0o700, '/project': 0o755 },
    }
    expect(decodeProjectSnapshot(encodeProjectSnapshot(snapshot))).toEqual(
      snapshot,
    )
    expect(() =>
      encodeProjectSnapshot({
        ...snapshot,
        directoryModes: { '/project': 0o755 },
      }),
    ).toThrow(/incomplete/)
    expect(() => encodeProjectSnapshot({ ...snapshot, fileModes: {} })).toThrow(
      /incomplete/,
    )
  })
  it('accepts long SDK paths but bounds their encoded bytes', () => {
    const path = '/' + 'a'.repeat(1024)
    expect(
      decodeProjectSnapshot(
        encodeProjectSnapshot({
          version: 1,
          files: { [path]: text('long path') },
        }),
      ).files[path],
    ).toEqual(text('long path'))
    expect(() =>
      encodeProjectSnapshot({
        version: 1,
        files: { ['/' + '界'.repeat(1400)]: new Uint8Array() },
      }),
    ).toThrow()
  })
  it('rejects an unbounded declared body without allocating it', () => {
    expect(() =>
      decodeProjectSnapshot(
        wire({
          ...base,
          files: [{ path: '/large', length: Number.MAX_SAFE_INTEGER }],
        }),
      ),
    ).toThrow()
  })
})
