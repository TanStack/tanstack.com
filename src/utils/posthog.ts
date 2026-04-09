import * as React from 'react'
import { capturePostHogEvent } from './posthog.functions'

const ANONYMOUS_ID_STORAGE_KEY = 'tanstack.posthog.anonymous_id'

type EventProperties = Record<string, unknown>

type ImpressionOptions = {
  enabled?: boolean
  event: string
  properties?: EventProperties
  threshold?: number
}

function getPageType(pathname: string) {
  if (pathname === '/') {
    return 'home'
  }

  if (pathname.startsWith('/partners/')) {
    return pathname === '/partners/' || pathname === '/partners'
      ? 'partners_index'
      : 'partner_detail'
  }

  if (pathname.startsWith('/blog/')) {
    return pathname === '/blog/' || pathname === '/blog'
      ? 'blog_index'
      : 'blog_post'
  }

  if (pathname.startsWith('/docs/') || pathname.includes('/docs/')) {
    return 'docs'
  }

  if (pathname.startsWith('/partners-embed')) {
    return 'partners_embed'
  }

  return 'page'
}

function getAnonymousDistinctId() {
  if (typeof window === 'undefined') {
    return ''
  }

  const existingId = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
  if (existingId) {
    return existingId
  }

  const anonymousId = window.crypto.randomUUID()
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, anonymousId)
  return anonymousId
}

function buildProperties(properties?: EventProperties) {
  if (typeof window === 'undefined') {
    return properties ?? {}
  }

  return {
    page_path: window.location.pathname,
    page_type: getPageType(window.location.pathname),
    page_url: window.location.href,
    ...properties,
  }
}

export function trackPostHogEvent(event: string, properties?: EventProperties) {
  if (typeof window === 'undefined') {
    return
  }

  void capturePostHogEvent({
    data: {
      anonymousId: getAnonymousDistinctId(),
      event,
      properties: buildProperties(properties),
    },
  }).catch(() => {
    // Analytics failures should never affect user flows.
  })
}

export function useTrackedImpression<TElement extends Element>({
  enabled = true,
  event,
  properties,
  threshold = 0.5,
}: ImpressionOptions) {
  const ref = React.useRef<TElement | null>(null)
  const hasTrackedRef = React.useRef(false)
  const propertiesRef = React.useRef(properties)

  React.useEffect(() => {
    propertiesRef.current = properties
  }, [properties])

  React.useEffect(() => {
    if (!enabled || hasTrackedRef.current) {
      return
    }

    const element = ref.current
    if (!element) {
      return
    }

    const track = () => {
      if (hasTrackedRef.current) {
        return
      }

      hasTrackedRef.current = true
      trackPostHogEvent(event, propertiesRef.current)
    }

    if (typeof IntersectionObserver === 'undefined') {
      track()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }

          if (entry.intersectionRatio < threshold) {
            continue
          }

          track()
          observer.disconnect()
          return
        }
      },
      { threshold: [threshold] },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [enabled, event, threshold])

  return ref
}
