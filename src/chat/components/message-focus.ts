/** One message-navigation intent. History may arrive later, but newer user
 * input always wins over its automatic focus transfer.
 */
export function createMessageFocusIntent() {
  const controller = new AbortController()
  const source = document.activeElement
  let cancelled = false
  let consumed = false
  let navigationAction = false
  const cancel = () => {
    cancelled = true
    controller.abort()
  }
  const active = () =>
    !cancelled &&
    !consumed &&
    document.hasFocus() &&
    document.visibilityState === 'visible'
  document.addEventListener('pointerdown', cancel, {
    signal: controller.signal,
  })
  document.addEventListener(
    'focusin',
    (event) => {
      if (!navigationAction && event.target !== source) cancel()
    },
    { signal: controller.signal },
  )
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState !== 'visible') cancel()
    },
    { signal: controller.signal },
  )
  window.addEventListener('blur', cancel, { signal: controller.signal })
  if (!document.hasFocus() || document.visibilityState !== 'visible') cancel()
  return {
    active,
    cancel,
    run(action: () => void) {
      if (!active()) return false
      navigationAction = true
      try {
        action()
      } finally {
        navigationAction = false
      }
      return true
    },
    focus(target: HTMLElement) {
      const allowed =
        active() && target.isConnected && !!target.getClientRects().length
      consumed = true
      controller.abort()
      if (!allowed) return false
      target.focus({ preventScroll: true })
      return true
    },
  }
}
export type MessageFocusIntent = ReturnType<typeof createMessageFocusIntent>
export type UrlMessageFocus = {
  messageId: string
  intent: MessageFocusIntent | null
}

/** Own the effect lifecycle separately from the navigation intent. React may
 * replay an effect while visible, but hiding a pane must never revive it.
 */
export function createUrlMessageFocusOwner(create = createMessageFocusIntent) {
  let selection: UrlMessageFocus | undefined
  let previousVisible = false
  let cleaned = false
  return {
    setup(messageId: string | undefined, visible: boolean) {
      if (!messageId) {
        selection?.intent?.cancel()
        selection = undefined
      } else if (
        selection?.messageId !== messageId ||
        (cleaned && previousVisible && visible)
      ) {
        selection?.intent?.cancel()
        selection = {
          messageId,
          intent: visible ? create() : null,
        }
      } else if (!visible) selection.intent?.cancel()
      previousVisible = visible
      cleaned = false
      return selection
    },
    cleanup() {
      selection?.intent?.cancel()
      cleaned = true
    },
  }
}
