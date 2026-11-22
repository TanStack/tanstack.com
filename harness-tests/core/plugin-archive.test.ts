import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { readPluginArchive } from '../../src/chat/core/plugin-archive'
import { pluginFileTableSchema } from '../../src/chat/core/plugins'

const manifest = '{"name":"notes"}'
function central(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = 0; offset < bytes.length - 4; offset++)
    if (view.getUint32(offset, true) === 0x02014b50) return offset
  throw Error('No test directory')
}
function descriptorZip(signature: boolean) {
  const zip = zipSync({ 'plugin.json': strToU8(manifest) })
  const directory = central(zip)
  const output = new Uint8Array(zip.length + (signature ? 16 : 12))
  output.set(zip.subarray(0, directory))
  output.set(zip.subarray(directory), directory + (signature ? 16 : 12))
  const old = new DataView(zip.buffer)
  const view = new DataView(output.buffer)
  const at = directory + (signature ? 4 : 0)
  if (signature) view.setUint32(directory, 0x08074b50, true)
  for (const [destination, original] of [
    [0, 16],
    [4, 20],
    [8, 24],
  ])
    view.setUint32(
      at + destination,
      old.getUint32(directory + original, true),
      true,
    )
  view.setUint16(6, old.getUint16(6, true) | 8, true)
  view.setUint16(
    central(output) + 8,
    old.getUint16(directory + 8, true) | 8,
    true,
  )
  for (const field of [14, 18, 22]) view.setUint32(field, 0, true)
  view.setUint32(output.length - 22 + 16, central(output), true)
  return { bytes: output, descriptor: at }
}
describe('plugin ZIP intake', () => {
  it.each([0, 6] as const)(
    'retains complete UTF-8 files with compression level %i',
    async (level) => {
      const files = {
        'notes/plugin.json': strToU8(manifest),
        'notes/skills/summary/SKILL.md': strToU8('A café summary\n'),
        'notes/skills/summary/reference.txt': strToU8('Exact resource\n'),
      }
      expect(await readPluginArchive(zipSync(files, { level }))).toEqual(
        Object.entries(files).map(([path, value]) => ({
          path: path.slice('notes/'.length),
          text: new TextDecoder().decode(value),
        })),
      )
    },
  )
  it('checks bytes, not just claimed size or a valid-looking manifest', async () => {
    const zip = zipSync({ 'plugin.json': strToU8(manifest) }, { level: 0 })
    zip[30 + 'plugin.json'.length] ^= 1
    await expect(readPluginArchive(zip)).rejects.toThrow('integrity')
    const forged = zipSync({ 'plugin.json': strToU8('x'.repeat(200000)) })
    const view = new DataView(forged.buffer)
    view.setUint32(22, 1, true)
    view.setUint32(central(forged) + 24, 1, true)
    await expect(readPluginArchive(forged)).rejects.toThrow('declared size')
  })
  it.each([
    '../plugin.json',
    '/plugin.json',
    'C:plugin.json',
    'a\\plugin.json',
  ])('rejects unsafe path %s', async (path) => {
    await expect(
      readPluginArchive(zipSync({ [path]: strToU8(manifest) })),
    ).rejects.toThrow()
  })
  it('rejects symbolic links, conflicting names and binary files', async () => {
    await expect(
      readPluginArchive(
        zipSync({
          'plugin.json': [strToU8('target'), { os: 3, attrs: 0xa1ff0000 }],
        }),
      ),
    ).rejects.toThrow('symbolic')
    await expect(
      readPluginArchive(
        zipSync({
          'plugin.json': strToU8(manifest),
          'PLUGIN.JSON': strToU8(manifest),
        }),
      ),
    ).rejects.toThrow('conflicting')
    await expect(
      readPluginArchive(zipSync({ 'plugin.json': new Uint8Array([0xff]) })),
    ).rejects.toThrow('UTF-8')
  })
  it('rejects oversized, truncated and locally mismatched archives', async () => {
    await expect(
      readPluginArchive(
        zipSync({ 'plugin.json': strToU8('x'.repeat(262145)) }),
      ),
    ).rejects.toThrow('256 KiB')
    const zip = zipSync({ 'plugin.json': strToU8(manifest) })
    await expect(readPluginArchive(zip.slice(0, -5))).rejects.toThrow()
    zip[30] ^= 1
    await expect(readPluginArchive(zip)).rejects.toThrow('path')
  })

  it.each([false, true])(
    'validates a streaming data descriptor with signature=%s',
    async (signature) => {
      const { bytes, descriptor } = descriptorZip(signature)
      expect(await readPluginArchive(bytes)).toEqual([
        { path: 'plugin.json', text: manifest },
      ])
      const forged = bytes.slice()
      forged[descriptor] ^= 1
      await expect(readPluginArchive(forged)).rejects.toThrow('data descriptor')
      const conflict = bytes.slice()
      new DataView(conflict.buffer).setUint32(22, 123, true)
      await expect(readPluginArchive(conflict)).rejects.toThrow(
        'streaming header conflicts',
      )
    },
  )

  it('requires a descriptor when the streaming flag claims one exists', async () => {
    const bytes = zipSync({ 'plugin.json': strToU8(manifest) })
    const view = new DataView(bytes.buffer)
    view.setUint16(6, view.getUint16(6, true) | 8, true)
    view.setUint16(
      central(bytes) + 8,
      view.getUint16(central(bytes) + 8, true) | 8,
      true,
    )
    await expect(readPluginArchive(bytes)).rejects.toThrow('data descriptor')
  })

  it.each([1, 0x7075])(
    'rejects local-only unsupported extra field %i',
    async (kind) => {
      const bytes = zipSync(
        { 'plugin.json': strToU8(manifest) },
        { extra: { 0x1234: new Uint8Array([0]) } },
      )
      const view = new DataView(bytes.buffer)
      view.setUint16(30 + view.getUint16(26, true), kind, true)
      await expect(readPluginArchive(bytes)).rejects.toThrow(
        'alternate path or ZIP64',
      )
    },
  )

  it('rejects file/directory and Unicode path conflicts through the shared file-table boundary', async () => {
    for (const names of [
      ['parent', 'parent/child'],
      ['Ｋ.txt', 'K.txt'],
    ]) {
      const files = {
        'plugin.json': strToU8(manifest),
        ...Object.fromEntries(names.map((name) => [name, strToU8('')])),
      }
      try {
        const parsed = await readPluginArchive(zipSync(files))
        expect(pluginFileTableSchema.safeParse(parsed).success).toBe(false)
      } catch (error) {
        expect(String(error)).toContain('conflicting paths')
      }
    }
  })
})
