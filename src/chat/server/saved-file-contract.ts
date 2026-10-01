import { z } from 'zod'
import { isTextFile, type SavedFile, type SaveFileInput } from '../core/files'

export type FileRow = {
  id: string
  conversation_id: string | null
  bot_id: string | null
  draft_id: string | null
  name: string
  media_type: string
  size: number
  sha256: string
  source: SavedFile['source']
  state: SavedFile['state']
  created_at: number
}

export class SavedFileError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'SavedFileError'
  }
}

export function validateId(id: unknown): asserts id is string {
  if (!z.string().uuid().safeParse(id).success)
    throw new SavedFileError('Use a valid file ID.', 400)
}

export function normalizeInput(input: SaveFileInput): SaveFileInput {
  if (!input || typeof input !== 'object')
    throw new SavedFileError('Provide file metadata.', 400)
  validateId(input.id)
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 180 ||
    /[/\\\p{Cc}\p{Cf}]/u.test(input.name) ||
    input.name === '.' ||
    input.name === '..'
  )
    throw new SavedFileError(
      'Use a filename up to 180 characters without slashes or control characters.',
      400,
    )
  if (input.source !== 'upload' && input.source !== 'assistant')
    throw new SavedFileError('Use a supported file source.', 400)
  if (typeof input.mediaType !== 'string' || input.mediaType.length > 200)
    throw new SavedFileError('Use a valid file media type.', 400)
  const [type, ...parameters] = input.mediaType.trim().toLowerCase().split(';')
  const mediaType = type.trim() || 'application/octet-stream'
  const token = '[a-z0-9][a-z0-9!#$&^_.+\\-]{0,126}'
  if (
    !new RegExp(`^${token}/${token}$`).test(mediaType) ||
    parameters.length > 1 ||
    parameters.some(
      (p) =>
        !isTextFile(mediaType) ||
        !/^\s*charset\s*=\s*(?:utf-?8|"utf-?8")\s*$/.test(p),
    )
  )
    throw new SavedFileError(
      'Use a valid media type with UTF-8 text encoding.',
      400,
    )
  return { ...input, id: input.id.toLowerCase(), mediaType }
}

export function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes,
    )
  } catch {
    throw new SavedFileError('Text files must contain valid UTF-8.', 415)
  }
}

export function validateContent(type: string, bytes: Uint8Array) {
  if (isTextFile(type)) decodeText(bytes)
  const starts = (...signature: number[]) =>
    signature.every((byte, i) => bytes[i] === byte)
  const ascii = (offset: number, text: string) =>
    [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0))
  const valid =
    type === 'image/png'
      ? starts(137, 80, 78, 71, 13, 10, 26, 10)
      : type === 'image/jpeg'
        ? starts(255, 216, 255)
        : type === 'image/gif'
          ? ascii(0, 'GIF87a') || ascii(0, 'GIF89a')
          : type === 'image/webp'
            ? ascii(0, 'RIFF') && ascii(8, 'WEBP')
            : type === 'application/pdf'
              ? ascii(0, '%PDF-')
              : true
  if (!valid)
    throw new SavedFileError(
      'The file contents do not match its media type.',
      415,
    )
}

export function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function file(row: FileRow): SavedFile {
  if (!row.bot_id || !row.conversation_id)
    throw new SavedFileError('File not found.', 404)
  return {
    id: row.id,
    botId: row.bot_id,
    conversationId: row.conversation_id,
    name: row.name,
    mediaType: row.media_type,
    size: row.size,
    sha256: row.sha256,
    source: row.source,
    state: row.state,
    createdAt: row.created_at,
  }
}
