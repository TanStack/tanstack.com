import { expect, it, vi } from 'vitest'
import {
  maxWorkspaceRequestBytes,
  readWorkspaceJson,
} from '../../src/chat/server/workspace-request'

function streamed(chunks: Uint8Array[], headers: HeadersInit = {}) {
  const cancel = vi.fn()
  const body = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift()
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
    cancel,
  })
  const request = new Request('https://gum.example.com', {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  } as RequestInit)
  return { request, cancel }
}
it('decodes multibyte JSON split across network chunks', async () => {
  const value = { text: 'Hello 🌎' }
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const { request } = streamed([...bytes].map((byte) => Uint8Array.of(byte)))
  expect(await readWorkspaceJson(request)).toEqual(value)
})
it('counts actual bytes and cancels an oversized stream despite an understated header', async () => {
  const bytes = new TextEncoder().encode(
    '"' + '🌎'.repeat(maxWorkspaceRequestBytes / 4) + '"',
  )
  const { request, cancel } = streamed(
    [bytes.slice(0, 120000), bytes.slice(120000), Uint8Array.of(32)],
    { 'content-length': '2' },
  )
  await expect(readWorkspaceJson(request)).rejects.toMatchObject({
    status: 413,
  })
  expect(cancel).toHaveBeenCalledTimes(1)
})
it('rejects a known oversized body before reading it', async () => {
  const { request, cancel } = streamed([Uint8Array.of(123)], {
    'content-length': String(maxWorkspaceRequestBytes + 1),
  })
  await expect(readWorkspaceJson(request)).rejects.toMatchObject({
    status: 413,
  })
  expect(cancel).toHaveBeenCalledTimes(1)
})
it('rejects malformed UTF-8 rather than replacing bytes in opaque identities', async () => {
  const { request } = streamed([Uint8Array.of(34, 0xff, 34)])
  await expect(readWorkspaceJson(request)).rejects.toMatchObject({
    status: 400,
  })
})
