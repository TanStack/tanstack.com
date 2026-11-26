/** Original history/stream HTTP handling. The caller must authorize the
 * conversation identity before supplying its Durable Object stub. */
export async function conversationReadApi(
  request: Request,
  operation: string,
  stub: {
    streamSnapshot(): Promise<unknown>
    readStream(query: string): Promise<Response>
  },
  workflowWorker?: unknown,
): Promise<Response | undefined> {
  const url = new URL(request.url)
  const json = (value: unknown) =>
    Response.json(value, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  if (operation === 'history' && request.method === 'GET') {
    const snapshot: unknown = await stub.streamSnapshot()
    if (!snapshot || typeof snapshot !== 'object')
      throw new Error('Conversation history is unavailable.')
    return json({
      ...snapshot,
      ...(workflowWorker ? { workflowWorker } : {}),
    })
  }
  if (operation === 'stream' && request.method === 'GET') {
    const query = new URLSearchParams()
    for (const key of ['offset', 'live', 'cursor']) {
      const value = url.searchParams.get(key)
      if (value !== null) query.set(key, value)
    }
    return stub.readStream('?' + query.toString())
  }
}
