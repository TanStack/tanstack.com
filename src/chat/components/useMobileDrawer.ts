import { useEffect, type RefObject } from 'react'
import { animate } from 'motion'
import { mobileBackHandler } from './mobile-back'

/** Touch events allow canceling WebKit edge navigation before it takes ownership. */
export function useMobileDrawer(
  sidebar: RefObject<HTMLElement | null>,
  enabled: boolean,
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!enabled) return
    let drag:
      | {
          x: number
          y: number
          dx: number
          time: number
          active: boolean
          back?: () => void
          panel: HTMLElement
          surface: HTMLElement
          shade: HTMLElement | null
          width: number
        }
      | undefined
    let animation: ReturnType<typeof animate> | undefined
    const reset = () => {
      animation?.stop()
      if (drag) {
        drag.surface.style.removeProperty('transform')
        drag.surface.style.removeProperty('transition')
        drag.shade?.style.removeProperty('opacity')
        drag.shade?.style.removeProperty('visibility')
      }
      drag = undefined
    }
    const paint = (dx: number) => {
      if (!drag) return
      const x = drag.back
        ? Math.max(0, dx)
        : Math.max(-drag.width, Math.min(0, (open ? 0 : -drag.width) + dx))
      drag.surface.style.transform = `translate3d(${x}px,0,0)`
      if (!drag.back && drag.shade) {
        drag.shade.style.visibility = 'visible'
        drag.shade.style.opacity = String(1 + x / drag.width)
      }
    }
    const start = (event: TouchEvent) => {
      reset()
      if (event.touches.length !== 1) return
      const touch = event.touches[0]!
      const target = event.target as HTMLElement
      const panel = sidebar.current
      if (!panel?.parentElement?.contains(target)) return
      // Both edges are reserved, including forward navigation. Do not trap history.
      const edge = touch.clientX < 24 || touch.clientX > window.innerWidth - 24
      if (edge && event.cancelable) event.preventDefault()
      if (
        document.querySelector(
          '[role="dialog"][data-open], dialog[open], [role="menu"]',
        )
      )
        return
      if (
        target.closest(
          'input, textarea, [contenteditable="true"], button, a, [role="slider"], pre, code',
        ) ||
        window.getSelection()?.toString()
      )
        return
      if (
        !target.closest(
          '.main-header, .messages-scroll, .thread-heading, .brand, .sidebar-shade',
        )
      )
        return
      // Respect horizontal carousels and scroll containers.
      for (
        let node: HTMLElement | null = target;
        node && node !== panel.parentElement;
        node = node.parentElement
      ) {
        if (
          node.scrollWidth > node.clientWidth + 1 &&
          /auto|scroll/.test(getComputedStyle(node).overflowX)
        )
          return
      }
      const back = !open ? mobileBackHandler() : undefined
      const surface = back
        ? panel.parentElement.querySelector<HTMLElement>('.main')
        : panel
      if (!surface) return
      drag = {
        x: touch.clientX,
        y: touch.clientY,
        dx: 0,
        time: event.timeStamp,
        active: false,
        back,
        panel,
        surface,
        shade: panel.parentElement.querySelector('.sidebar-shade'),
        width: surface.getBoundingClientRect().width,
      }
    }
    const move = (event: TouchEvent) => {
      if (!drag) return
      if (event.touches.length !== 1) {
        reset()
        return
      }
      const touch = event.touches[0]!
      const dx = touch.clientX - drag.x,
        dy = touch.clientY - drag.y
      if (!drag.active) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          reset()
          return
        }
        if (Math.abs(dx) < 10) return
        if (Math.abs(dx) < Math.abs(dy) * 1.4 || (open ? dx > 0 : dx < 0)) {
          reset()
          return
        }
        drag.active = true
        drag.surface.style.transition = 'none'
      }
      if (event.cancelable) event.preventDefault()
      drag.dx = dx
      paint(dx)
    }
    const end = (event: TouchEvent) => {
      if (!drag) return
      const current = drag
      const commit =
        current.active &&
        (Math.abs(current.dx) > current.width * 0.3 ||
          (Math.abs(current.dx) > 40 &&
            Math.abs(current.dx) / Math.max(1, event.timeStamp - current.time) >
              0.45))
      const finish = () => {
        reset()
        if (commit) {
          if (current.back) current.back()
          else setOpen(!open)
        }
      }
      if (
        !current.active ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        finish()
        return
      }
      animation = animate(
        current.dx,
        commit
          ? current.back
            ? current.width
            : open
              ? -current.width
              : current.width
          : 0,
        {
          type: 'spring',
          stiffness: 500,
          damping: 45,
          onUpdate: paint,
          onComplete: finish,
        },
      )
    }
    document.addEventListener('touchstart', start, { passive: false })
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', reset)
    return () => {
      reset()
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', reset)
    }
  }, [sidebar, enabled, open, setOpen])
}
