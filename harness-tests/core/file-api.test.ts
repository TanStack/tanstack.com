import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileApi, readFileUpload } from '../../src/chat/server/file-api'
import {
  SavedFiles,
  type FileEnvironment,
} from '../../src/chat/server/saved-files'
import { maxFileBytes, type SavedFile } from '../../src/chat/core/files'

const env: FileEnvironment = {
  FILES: {
    put: vi.fn(async () => null),
    head: vi.fn(async () => null),
    get: vi.fn(async () => null),
  },
}
const scope = { workspaceId: 'w', userId: 'u', botId: 'b' }
const file: SavedFile = {
  id: '88888888-8888-4888-8888-888888888888',
  botId: 'b',
  name: 'notes.md',
  mediaType: 'text/markdown',
  source: 'upload',
  state: 'ready',
  size: 3,
  sha256: 'a'.repeat(64),
  createdAt: 1,
}
afterEach(() => vi.restoreAllMocks())

describe('file HTTP boundary', () => {
  it('bounds actual bytes even without a length header and cancels the stream', async () => {
    let canceled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maxFileBytes))
        controller.enqueue(new Uint8Array(1))
      },
      cancel() {
        canceled = true
      },
    })
    const request = new Request('https://gum.test/upload', {
      method: 'PUT',
      body,
      duplex: 'half',
    } as RequestInit)
    await expect(readFileUpload(request)).rejects.toMatchObject({ status: 413 })
    expect(canceled).toBe(true)
    expect(body.locked).toBe(false)
  })
  it('rejects a declared oversized upload before reading it', async () => {
    const request = new Request('https://gum.test/upload', {
      method: 'PUT',
      headers: { 'Content-Length': String(maxFileBytes + 1) },
      body: 'small',
    })
    await expect(readFileUpload(request)).rejects.toMatchObject({ status: 413 })
    expect(request.bodyUsed).toBe(false)
  })
  it('preserves empty and UTF-8 binary payload bytes', async () => {
    expect(
      await readFileUpload(
        new Request('https://gum.test/upload', { method: 'PUT' }),
      ),
    ).toEqual(new Uint8Array())
    const bytes = new TextEncoder().encode('Hello 🪴')
    expect(
      await readFileUpload(
        new Request('https://gum.test/upload', { method: 'PUT', body: bytes }),
      ),
    ).toEqual(bytes)
  })
  it('serves HTML as non-executable text and uses safe unicode filename headers', async () => {
    vi.spyOn(SavedFiles.prototype, 'content').mockResolvedValue({
      file: { ...file, name: 'é.html', mediaType: 'text/html' },
      body: new Blob(['<x>']).stream(),
      arrayBuffer: () => new Blob(['<x>']).arrayBuffer(),
    })
    const response = await fileApi(
      new Request('https://gum.test/content'),
      env,
      scope,
      file.id,
      true,
    )
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    )
    expect(response.headers.get('Content-Disposition')).toBe(
      'inline; filename="download"; filename*=UTF-8\'\'%C3%A9.html',
    )
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    )
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('<x>')
  })
  it('never previews SVG or arbitrary binary content as a document', async () => {
    const content = vi.spyOn(SavedFiles.prototype, 'content')
    for (const mediaType of [
      'image/svg+xml',
      'application/pdf',
      'application/octet-stream',
    ]) {
      content.mockResolvedValue({
        file: { ...file, mediaType },
        body: new Blob(['abc']).stream(),
        arrayBuffer: () => new Blob(['abc']).arrayBuffer(),
      })
      const response = await fileApi(
        new Request('https://gum.test/content'),
        env,
        scope,
        file.id,
        true,
      )
      expect(response.headers.get('Content-Disposition')).toMatch(
        /^attachment;/,
      )
      expect(await response.text()).toBe('abc')
    }
  })
  it('forces download for supported preview content when requested', async () => {
    vi.spyOn(SavedFiles.prototype, 'content').mockResolvedValue({
      file,
      body: new Blob(['abc']).stream(),
      arrayBuffer: () => new Blob(['abc']).arrayBuffer(),
    })
    const response = await fileApi(
      new Request('https://gum.test/content?download=1'),
      env,
      scope,
      file.id,
      true,
    )
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment;/)
  })
  it('uses server-owned source and scope for uploads', async () => {
    const save = vi.spyOn(SavedFiles.prototype, 'save').mockResolvedValue(file)
    const response = await fileApi(
      new Request('https://gum.test/upload', {
        method: 'PUT',
        headers: { 'X-File-Name': 'notes.md', 'Content-Type': 'text/markdown' },
        body: 'abc',
      }),
      env,
      scope,
      file.id,
    )
    expect(response.status).toBe(200)
    expect(save).toHaveBeenCalledWith(
      {
        id: file.id,
        name: 'notes.md',
        mediaType: 'text/markdown',
        source: 'upload',
      },
      new TextEncoder().encode('abc'),
    )
  })
})
