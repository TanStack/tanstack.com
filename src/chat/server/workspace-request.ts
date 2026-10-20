// A 12,000-character message plus ten references with opaque 1,000-character
// conversation IDs can exceed 140 KB when JSON-escaped. Bound bytes while
// reading, then let each route validate its own fields and character limits.
export const maxWorkspaceRequestBytes = 192 * 1024

export class WorkspaceBodyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'WorkspaceBodyError'
  }
}

export async function readWorkspaceJson(request: Request): Promise<unknown> {
  const tooLarge = () => new WorkspaceBodyError('Request is too large.', 413)
  if (
    Number(request.headers.get('content-length') ?? 0) >
    maxWorkspaceRequestBytes
  ) {
    await request.body?.cancel()
    throw tooLarge()
  }
  const reader = request.body?.getReader()
  if (!reader) throw new WorkspaceBodyError('The request is invalid.')
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
  let size = 0,
    text = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > maxWorkspaceRequestBytes) throw tooLarge()
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text) as unknown
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof WorkspaceBodyError) throw error
    throw new WorkspaceBodyError('The request is invalid.')
  } finally {
    reader.releaseLock()
  }
}
