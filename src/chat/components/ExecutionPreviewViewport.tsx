import { useLayoutEffect, useRef } from 'react'
import type { ExecutionIdentity } from '../core/execution-sessions'
import { openExecutionPreview } from '../core/execution-preview'
import { executionOwnerKey } from '../client/execution-owner'
import type { ExecutionPreviewBounds } from '../client/execution-browser-bridge'
import { useExecutionOwners, useExecutionOwnerViews } from './execution-context'
import './execution-preview-viewport.css'

type Rect = { left: number; top: number; width: number; height: number }
type Clip = { left: number; top: number; right: number; bottom: number }

/** Keep the guest viewport size while clipping pixels outside the pane. */
export function clipExecutionPreview(
  rect: Rect,
  limits: readonly Clip[],
): ExecutionPreviewBounds | null {
  if (
    ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) ||
    rect.width <= 0 ||
    rect.height <= 0
  )
    return null
  let left = rect.left,
    top = rect.top,
    right = left + rect.width,
    bottom = top + rect.height
  for (const limit of limits) {
    if (!Object.values(limit).every(Number.isFinite)) return null
    left = Math.max(left, limit.left)
    top = Math.max(top, limit.top)
    right = Math.min(right, limit.right)
    bottom = Math.min(bottom, limit.bottom)
  }
  if (right <= left || bottom <= top) return null
  return {
    ...rect,
    clip: {
      left: left - rect.left,
      top: top - rect.top,
      right: rect.left + rect.width - right,
      bottom: rect.top + rect.height - bottom,
    },
  }
}

export function measureExecutionPreview(
  element: HTMLElement,
): ExecutionPreviewBounds | null {
  const doc = element.ownerDocument,
    win = doc.defaultView
  if (
    !win ||
    !element.isConnected ||
    doc.visibilityState === 'hidden' ||
    element.closest('[hidden], [inert], [aria-hidden="true"]')
  )
    return null
  const viewport = win.visualViewport
  const left = viewport?.offsetLeft ?? 0,
    top = viewport?.offsetTop ?? 0
  const limits: Clip[] = [
    {
      left,
      top,
      right: left + (viewport?.width ?? win.innerWidth),
      bottom: top + (viewport?.height ?? win.innerHeight),
    },
  ]
  const rect = element.getBoundingClientRect()
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  ) {
    const style = win.getComputedStyle(current)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      Number(style.opacity) === 0
    )
      return null
    if (current === element) continue
    const bounds = current.getBoundingClientRect()
    const scaleX = current.offsetWidth ? bounds.width / current.offsetWidth : 1
    const scaleY = current.offsetHeight
      ? bounds.height / current.offsetHeight
      : 1
    const x = bounds.left + current.clientLeft * scaleX,
      y = bounds.top + current.clientTop * scaleY
    const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX)
    const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY)
    if (clipsX || clipsY)
      limits.push({
        left: clipsX ? x : rect.left,
        right: clipsX ? x + current.clientWidth * scaleX : rect.right,
        top: clipsY ? y : rect.top,
        bottom: clipsY ? y + current.clientHeight * scaleY : rect.bottom,
      })
  }
  return clipExecutionPreview(
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    limits,
  )
}

/** Observers only control presentation. They never create or move a runtime. */
export function observeExecutionPreviewViewport(
  element: HTMLElement,
  update: (bounds: ExecutionPreviewBounds | null) => void,
) {
  const doc = element.ownerDocument,
    win = doc.defaultView
  if (!win) {
    update(null)
    return () => {}
  }
  const ancestors: HTMLElement[] = []
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  )
    ancestors.push(current)
  let disposed = false,
    animationFrame = 0,
    moving = 0
  const refresh = () => {
    if (!disposed) update(measureExecutionPreview(element))
  }
  const animate = () => {
    animationFrame = 0
    refresh()
    if (!disposed && moving > 0)
      animationFrame = win.requestAnimationFrame(animate)
  }
  const motionStart = (event: Event) => {
    if (!ancestors.includes(event.target as HTMLElement)) return
    moving++
    if (!animationFrame) animationFrame = win.requestAnimationFrame(animate)
  }
  const motionEnd = (event: Event) => {
    if (!ancestors.includes(event.target as HTMLElement)) return
    moving = Math.max(0, moving - 1)
    refresh()
  }
  const resize = new ResizeObserver(refresh)
  const changes = new MutationObserver(refresh)
  for (const ancestor of ancestors) {
    resize.observe(ancestor)
    changes.observe(ancestor, {
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'hidden',
        'inert',
        'aria-hidden',
        'data-ending-style',
        'data-starting-style',
      ],
    })
  }
  win.addEventListener('resize', refresh)
  win.addEventListener('scroll', refresh, true)
  win.visualViewport?.addEventListener('resize', refresh)
  win.visualViewport?.addEventListener('scroll', refresh)
  doc.addEventListener('visibilitychange', refresh)
  doc.addEventListener('fullscreenchange', refresh)
  for (const type of ['transitionrun', 'animationstart'])
    doc.addEventListener(type, motionStart, true)
  for (const type of [
    'transitionend',
    'transitioncancel',
    'animationend',
    'animationcancel',
  ])
    doc.addEventListener(type, motionEnd, true)
  refresh()
  return () => {
    disposed = true
    resize.disconnect()
    changes.disconnect()
    if (animationFrame) win.cancelAnimationFrame(animationFrame)
    win.removeEventListener('resize', refresh)
    win.removeEventListener('scroll', refresh, true)
    win.visualViewport?.removeEventListener('resize', refresh)
    win.visualViewport?.removeEventListener('scroll', refresh)
    doc.removeEventListener('visibilitychange', refresh)
    doc.removeEventListener('fullscreenchange', refresh)
    for (const type of ['transitionrun', 'animationstart'])
      doc.removeEventListener(type, motionStart, true)
    for (const type of [
      'transitionend',
      'transitioncancel',
      'animationend',
      'animationcancel',
    ])
      doc.removeEventListener(type, motionEnd, true)
    update(null)
  }
}

export function ExecutionPreviewViewport({
  identity,
  previewId,
  active,
}: {
  identity: ExecutionIdentity
  previewId: string
  active: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const owners = useExecutionOwners(),
    views = useExecutionOwnerViews()
  const key = executionOwnerKey(identity)
  const view = views.find((item) => item.key === key)
  const session = view?.snapshot?.session
  const available = !!(
    view?.localOwner &&
    view.phase === 'ready' &&
    openExecutionPreview(
      view.snapshot ?? undefined,
      previewId,
      new Set(
        view.events.flatMap((event) =>
          event.type === 'process-exit' ? [event.processId] : [],
        ),
      ),
    )
  )
  useLayoutEffect(() => {
    if (!owners || !active || !available || !ref.current) return
    const attachment = owners.attachPreviewViewport(identity, previewId)
    const disconnect = observeExecutionPreviewViewport(ref.current, (bounds) =>
      attachment.update(bounds),
    )
    return () => {
      disconnect()
      attachment.release()
    }
  }, [
    owners,
    key,
    previewId,
    active,
    available,
    session?.id,
    session?.runtimeId,
    session?.hostGeneration,
  ])
  return (
    <div
      ref={ref}
      className="execution-preview-viewport"
      aria-label="Workspace preview viewport"
    >
      {active && !available && (
        <p role="status">This preview is not available in this page.</p>
      )}
    </div>
  )
}
