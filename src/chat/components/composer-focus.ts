/** One explicit composer transition, cancelled by an intervening user action. */
export function composerFocusHandoff(source: HTMLElement) {
  const controller = new AbortController()
  let cancelled = false
  let consumed = false
  const moved = (event: Event) => {
    if (event.target !== source) cancelled = true
  }
  document.addEventListener('focusin', moved, { signal: controller.signal })
  document.addEventListener('pointerdown', moved, { signal: controller.signal })
  return {
    cancel() {
      cancelled = true
      controller.abort()
    },
    focus(target: HTMLTextAreaElement) {
      if (consumed) return
      consumed = true
      controller.abort()
      if (
        !cancelled &&
        document.hasFocus() &&
        document.visibilityState === 'visible' &&
        (document.activeElement === source ||
          document.activeElement === document.body) &&
        target.isConnected &&
        target.getClientRects().length &&
        !target.readOnly &&
        !target.disabled
      )
        target.focus()
    },
  }
}
export type ComposerFocusHandoff = ReturnType<typeof composerFocusHandoff>

/** Only an action from the currently focused composer can claim its focus. */
export function captureComposerFocus(
  container: HTMLElement | null,
  enabled = true,
): ComposerFocusHandoff | undefined {
  const source = document.activeElement
  if (
    enabled &&
    container &&
    source instanceof HTMLElement &&
    source !== document.body &&
    container.contains(source)
  )
    return composerFocusHandoff(source)
}
