import { expect, it, vi } from 'vitest'
import { conversationReadApi } from '../../src/chat/server/conversation-read-api'

it('passes a live stream through without buffering or losing protocol headers', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event'))
      controller.close()
    },
  })
  const response = new Response(stream, {
    headers: {
      'Stream-Next-Offset': '123',
      'Content-Type': 'text/event-stream',
    },
  })
  const stub = {
    streamSnapshot: vi.fn(),
    readStream: vi.fn(async () => response),
  }
  const result = await conversationReadApi(
    new Request(
      'https://tanstack.com/api/chat/stream?offset=12&live=sse&cursor=opaque&ignored=value',
    ),
    'stream',
    stub,
  )
  expect(stub.readStream).toHaveBeenCalledWith(
    '?offset=12&live=sse&cursor=opaque',
  )
  expect(result).toBe(response)
  expect(result?.bodyUsed).toBe(false)
  expect(result?.headers.get('Stream-Next-Offset')).toBe('123')
  expect(await result?.text()).toBe('event')
})

it('does not call the conversation object for an unsupported method', async () => {
  const stub = {
    streamSnapshot: vi.fn(async () => {
      throw new Error('Unexpected history read')
    }),
    readStream: vi.fn(async () => {
      throw new Error('Unexpected stream read')
    }),
  }
  expect(
    await conversationReadApi(
      new Request('https://tanstack.com/api/chat/history', { method: 'POST' }),
      'history',
      stub,
    ),
  ).toBeUndefined()
  expect(stub.streamSnapshot).not.toHaveBeenCalled()
  expect(stub.readStream).not.toHaveBeenCalled()
})
