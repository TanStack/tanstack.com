import * as React from 'react'
import { googleAnalyticsProvider } from './analytics/providers/google'
import type {
  AnalyticsPropertyValue,
  EventPayload,
  EventProperties,
} from './analytics/types'

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

function normalizeAnalyticsValue(
  value: unknown,
): AnalyticsPropertyValue | undefined {
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value
  }

  if (value === null || value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    const normalizedEntries = value
      .map((entry) => normalizeAnalyticsValue(entry))
      .filter((entry) => entry !== undefined)

    return normalizedEntries.join(',')
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildEventProperties(properties?: EventProperties): EventPayload {
  const eventProperties: EventPayload = {}

  if (typeof window !== 'undefined') {
    eventProperties.page_location = window.location.href
    eventProperties.page_path = window.location.pathname
    eventProperties.page_title = document.title
    eventProperties.page_type = getPageType(window.location.pathname)
  }

  for (const [key, value] of Object.entries(properties ?? {})) {
    const normalizedValue = normalizeAnalyticsValue(value)

    if (normalizedValue === undefined) {
      continue
    }

    eventProperties[key === 'page_url' ? 'page_location' : key] =
      normalizedValue
  }

  return eventProperties
}

const analyticsProviders = [googleAnalyticsProvider]

export function trackEvent(event: string, properties?: EventProperties) {
  const eventProperties = buildEventProperties(properties)

  for (const provider of analyticsProviders) {
    try {
      provider.trackEvent(event, eventProperties)
    } catch {
      // Analytics failures should never affect user flows.
    }
  }
}

export function trackPageView(pagePath: string) {
  trackEvent('page_view', {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title,
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
      trackEvent(event, propertiesRef.current)
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
