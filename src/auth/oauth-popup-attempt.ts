import { createClientOnlyFn } from '@tanstack/react-start'

/** Completion is a hint to recheck the server session, never authentication. */
export const createOAuthPopupAttempt = createClientOnlyFn(function ({
  verifySession,
  onSuccess,
}: {
  verifySession: () => Promise<boolean>
  onSuccess: () => void
}) {
  const channelId = crypto.randomUUID()
  let active = true
  let checking = false
  const channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(`tanstack.oauth.${channelId}`)
  const complete = async (data: unknown) => {
    const { oauthPopupMessageSchema } = await import('./oauth-popup')
    const message = oauthPopupMessageSchema.safeParse(data)
    if (
      !active ||
      checking ||
      !message.success ||
      message.data.channel !== channelId
    )
      return
    checking = true
    try {
      if ((await verifySession()) && active) {
        dispose()
        onSuccess()
      }
    } catch {
      // Leave the modal open, a new sign-in attempt can retry verification.
    } finally {
      checking = false
    }
  }
  const receiveWindow = (event: MessageEvent) => {
    if (event.origin === window.location.origin) void complete(event.data)
  }
  const receiveChannel = (event: MessageEvent) => {
    void complete(event.data)
  }
  const timer = setTimeout(() => dispose(), 10 * 60 * 1000)
  function dispose() {
    if (!active) return
    active = false
    clearTimeout(timer)
    window.removeEventListener('message', receiveWindow)
    channel?.removeEventListener('message', receiveChannel)
    channel?.close()
  }
  window.addEventListener('message', receiveWindow)
  channel?.addEventListener('message', receiveChannel)
  return { channelId, dispose }
})
