import { Inflate } from 'fflate'
import type { PluginFile } from './plugins'

const maxArchiveBytes = 2 * 1024 * 1024
const maxFileBytes = 256 * 1024
const maxTotalBytes = 1024 * 1024
const maxEntries = 128
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const fail = (message: string): never => {
  throw Error(message)
}
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte
  for (let bit = 0; bit < 8; bit++)
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  return value >>> 0
})
function crc32(bytes: Uint8Array) {
  let value = 0xffffffff
  for (const byte of bytes)
    value = (value >>> 8) ^ crcTable[(value ^ byte) & 255]
  return (value ^ 0xffffffff) >>> 0
}
function decode(bytes: Uint8Array, label: string) {
  try {
    return decoder.decode(bytes)
  } catch {
    return fail(
      `${label} must use UTF-8 text. Binary plugin files are not supported yet.`,
    )
  }
}

/** ZIP is only an intake container. No file is written to the host filesystem.
 * Central and local metadata must agree, and decompressed bytes must match
 * the declared size and CRC. Chunked inflation bounds expansion before it
 * can allocate an entire falsely sized archive member.
 */
export async function readPluginArchive(
  bytes: Uint8Array,
): Promise<PluginFile[]> {
  if (bytes.byteLength > maxArchiveBytes)
    fail('Choose a plugin ZIP no larger than 2 MiB.')
  if (bytes.byteLength < 22) fail('Choose a complete plugin ZIP file.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  const checkExtra = (start: number, length: number, limit: number) => {
    const finish = start + length
    if (finish > limit) fail('The ZIP has malformed extra fields.')
    for (let extra = start; extra < finish; ) {
      if (extra + 4 > finish) fail('The ZIP has malformed extra fields.')
      const kind = u16(extra),
        size = u16(extra + 2)
      extra += 4 + size
      if (extra > finish || kind === 1 || kind === 0x7075)
        fail('Use a standard UTF-8 ZIP without alternate path or ZIP64 fields.')
    }
  }
  let end = -1
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  ) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) {
      end = at
      break
    }
  }
  if (end < 0) fail('The ZIP directory is missing or incomplete.')
  const count = u16(end + 10),
    offset = u32(end + 16),
    size = u32(end + 12)
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count)
    fail('Split ZIP archives are not supported.')
  if (!count || count > maxEntries || offset + size !== end)
    fail(
      'Use a standard ZIP containing 1 to 128 entries, without ZIP64 extensions.',
    )
  const files: PluginFile[] = []
  const names = new Set<string>()
  const ranges: Array<[number, number]> = []
  let total = 0,
    cursor = offset
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50)
      fail('The ZIP directory is malformed.')
    const flags = u16(cursor + 8),
      method = u16(cursor + 10)
    const checksum = u32(cursor + 16),
      compressed = u32(cursor + 20),
      expanded = u32(cursor + 24)
    const nameLength = u16(cursor + 28),
      extraLength = u16(cursor + 30),
      commentLength = u16(cursor + 32)
    const local = u32(cursor + 42),
      entryEnd = cursor + 46 + nameLength + extraLength + commentLength
    if (entryEnd > end || u16(cursor + 34) || local >= offset)
      fail('The ZIP contains an invalid file entry.')
    if (flags & ~0x080e || ![0, 8].includes(method))
      fail('Use an unencrypted ZIP with stored or DEFLATE files.')
    if (compressed === 0xffffffff || expanded > maxFileBytes)
      fail('Keep each plugin file under 256 KiB. ZIP64 is not supported.')
    total += expanded
    if (total > maxTotalBytes) fail('Keep the unpacked plugin under 1 MiB.')
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    const name = decode(rawName, 'ZIP paths')
    if (
      !name ||
      name.includes('\\') ||
      name.startsWith('/') ||
      name.includes(':') ||
      /[\u0000-\u001f\u007f]/u.test(name)
    )
      fail(
        'Use relative plugin paths without control characters or backslashes.',
      )
    const directory = name.endsWith('/')
    const parts = (directory ? name.slice(0, -1) : name).split('/')
    if (parts.some((part) => !part || part === '.' || part === '..'))
      fail('Plugin paths cannot contain empty, dot or parent segments.')
    const key = name.normalize('NFKC').toLocaleLowerCase('en-US')
    if (names.has(key)) fail('The ZIP contains duplicate or conflicting paths.')
    names.add(key)
    const platform = bytes[cursor + 5],
      mode = u32(cursor + 38) >>> 16
    if (
      platform === 3 &&
      mode & 0xf000 &&
      (mode & 0xf000) !== (directory ? 0x4000 : 0x8000)
    )
      fail('Plugin ZIPs cannot contain symbolic links or special files.')
    // Never reinterpret ZIP64 sizes or alternate Unicode path records.
    checkExtra(cursor + 46 + nameLength, extraLength, entryEnd)
    if (
      local + 30 > offset ||
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method
    )
      fail('The ZIP file header does not match its directory.')
    const dataStart = local + 30 + u16(local + 26) + u16(local + 28)
    const dataEnd = dataStart + compressed
    if (
      dataEnd > offset ||
      dataStart > offset ||
      decode(
        bytes.subarray(local + 30, local + 30 + u16(local + 26)),
        'ZIP paths',
      ) !== name
    )
      fail('The ZIP file data or path does not match its directory.')
    checkExtra(local + 30 + u16(local + 26), u16(local + 28), dataStart)
    if (
      !(flags & 8) &&
      (u32(local + 14) !== checksum ||
        u32(local + 18) !== compressed ||
        u32(local + 22) !== expanded)
    )
      fail('The ZIP file sizes do not match its directory.')
    let recordEnd = dataEnd
    if (flags & 8) {
      // Streaming writers put the authoritative CRC and sizes after the data.
      // Accept either standard descriptor spelling, but never skip its checks
      // or permit another local record to overlap it.
      if (
        [14, 18, 22].some((field, index) => {
          const value = u32(local + field)
          return (
            value !== 0 && value !== [checksum, compressed, expanded][index]
          )
        })
      )
        fail('The ZIP streaming header conflicts with its directory.')
      const matches = (at: number) =>
        at + 12 <= offset &&
        u32(at) === checksum &&
        u32(at + 4) === compressed &&
        u32(at + 8) === expanded
      if (
        dataEnd + 4 <= offset &&
        u32(dataEnd) === 0x08074b50 &&
        matches(dataEnd + 4)
      )
        recordEnd = dataEnd + 16
      else if (matches(dataEnd)) recordEnd = dataEnd + 12
      else fail('The ZIP data descriptor does not match its directory.')
    }
    if (ranges.some(([start, finish]) => local < finish && recordEnd > start))
      fail('The ZIP contains overlapping file entries.')
    ranges.push([local, recordEnd])
    const output = new Uint8Array(expanded)
    let written = 0
    const accept = (chunk: Uint8Array) => {
      if (written + chunk.length > expanded)
        fail('A ZIP file expands beyond its declared size.')
      output.set(chunk, written)
      written += chunk.length
    }
    if (method === 0) accept(bytes.subarray(dataStart, dataEnd))
    else {
      const inflate = new Inflate(accept)
      for (let start = dataStart; start < dataEnd; start += 128)
        inflate.push(
          bytes.subarray(start, Math.min(start + 128, dataEnd)),
          start + 128 >= dataEnd,
        )
      if (compressed === 0) fail('A compressed ZIP file has no data.')
    }
    if (written !== expanded || crc32(output) !== checksum)
      fail(
        'A plugin file failed ZIP integrity checks. Download the package again.',
      )
    if (directory) {
      if (expanded) fail('ZIP directories cannot contain file contents.')
    } else files.push({ path: name, text: decode(output, name) })
    cursor = entryEnd
  }
  if (cursor !== end) fail('The ZIP contains unrecognized directory entries.')
  if (!files.some((file) => file.path === 'plugin.json')) {
    const roots = new Set(files.map((file) => file.path.split('/')[0]))
    if (roots.size === 1 && files.every((file) => file.path.includes('/'))) {
      const prefix = [...roots][0] + '/'
      if (files.some((file) => file.path === prefix + 'plugin.json'))
        return files.map((file) => ({
          ...file,
          path: file.path.slice(prefix.length),
        }))
    }
  }
  return files
}
