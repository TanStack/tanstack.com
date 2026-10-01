/** Recover the cursor when a committed append's acknowledgment was lost.
 * The durable stream reports that retry as a duplicate 204 without an offset.
 * Each caller has one pending append per producer, so HEAD can read the cursor
 * for the confirmed commit before the local outbox advances. */
export async function confirmedAppendOffset(
  response: Response,
  producer: { epoch: number; sequence: number },
  head: () => Promise<Response>,
): Promise<{ offset: string | null; recoveryStatus?: number }> {
  if (!response.ok) return { offset: null }
  if (response.status !== 204)
    return { offset: response.headers.get('Stream-Next-Offset') }
  if (
    response.headers.get('Producer-Epoch') !== String(producer.epoch) ||
    response.headers.get('Producer-Seq') !== String(producer.sequence)
  )
    return { offset: null }
  const offset = response.headers.get('Stream-Next-Offset')
  if (offset) return { offset }
  const current = await head()
  return {
    offset: current.ok ? current.headers.get('Stream-Next-Offset') : null,
    recoveryStatus: current.status,
  }
}
