/** Follow the visible viewport without scrolling the document or stealing focus. */
export function observeMobileViewport() {
  const viewport = window.visualViewport
  const narrow = window.matchMedia('(max-width: 760px)')
  const style = document.documentElement.style
  let frame: number | undefined
  const clear = () => {
    style.removeProperty('--mobile-height')
    style.removeProperty('--mobile-top')
  }
  const update = () => {
    frame = undefined
    // Let the browser handle pinch zoom normally rather than resizing the app
    // underneath the gesture. Desktop layouts retain their normal sizing too.
    if (!viewport || !narrow.matches || viewport.scale !== 1) {
      clear()
      return
    }
    style.setProperty('--mobile-height', `${viewport.height}px`)
    style.setProperty('--mobile-top', `${Math.max(0, viewport.offsetTop)}px`)
  }
  const schedule = () => {
    if (frame === undefined) frame = requestAnimationFrame(update)
  }
  update()
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)
  window.addEventListener('resize', schedule)
  narrow.addEventListener('change', schedule)
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    viewport?.removeEventListener('resize', schedule)
    viewport?.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    narrow.removeEventListener('change', schedule)
    clear()
  }
}
