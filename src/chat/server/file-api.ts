import {
  maxFileBytes,
  isPreviewImage,
  isTextFile,
  uploadMediaType,
  type FileScope,
  type DraftFileScope,
} from '../core/files'
import { SavedFiles, SavedFileError, type FileEnvironment } from './saved-files'
import { DraftFiles } from './draft-files'

export async function readFileUpload(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxFileBytes)
    throw new SavedFileError('Files must be 2 MB or smaller.', 413)
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxFileBytes) {
        await reader.cancel()
        throw new SavedFileError('Files must be 2 MB or smaller.', 413)
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function fileApi(
  request: Request,
  env: FileEnvironment,
  scope: FileScope | DraftFileScope,
  id?: string,
  content = false,
): Promise<Response> {
  const files =
    'draftId' in scope ? new DraftFiles(env, scope) : new SavedFiles(env, scope)
  const json = (value: unknown) =>
    Response.json(value, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  if (request.method === 'GET') {
    if (!id) return json({ files: await files.list() })
    if (!content) return json(await files.get(id))
    const { file, body } = await files.content(id)
    const download = new URL(request.url).searchParams.get('download') === '1'
    const inline =
      !download &&
      (isTextFile(file.mediaType) || isPreviewImage(file.mediaType))
    const name = encodeURIComponent(file.name).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    return new Response(body, {
      headers: {
        'Content-Type': isTextFile(file.mediaType)
          ? 'text/plain; charset=utf-8'
          : file.mediaType,
        'Content-Length': String(file.size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="download"; filename*=UTF-8''${name}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy':
          "sandbox; default-src 'none'; frame-ancestors 'none'",
      },
    })
  }
  if (request.method === 'PUT' && id && !content) {
    let name: string
    try {
      name = decodeURIComponent(request.headers.get('x-file-name') ?? '')
    } catch {
      throw new SavedFileError('The filename is invalid.', 400)
    }
    return json(
      await files.save(
        {
          id,
          name,
          mediaType: uploadMediaType(
            name,
            request.headers.get('content-type') ?? '',
          ),
          source: 'upload',
        },
        await readFileUpload(request),
      ),
    )
  }
  return Response.json(
    { error: 'Method not allowed.' },
    {
      status: 405,
      headers: {
        Allow: id && !content ? 'GET, PUT' : 'GET',
        'Cache-Control': 'no-store',
      },
    },
  )
}
