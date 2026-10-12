import type { AnalyticsProvider, EventPayload } from '../types'

// Matches the declaration in @c15t/integrations/google-tag, which defines
// gtag when its script loads.
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}

// c15t's script loader defines gtag after hydration, so the first page view
// can arrive before gtag exists. Hold events until the loader flushes them.
const pendingEvents: Array<[string, EventPayload]> = []

export function flushPendingGoogleAnalyticsEvents() {
  for (const [event, properties] of pendingEvents.splice(0)) {
    window.gtag('event', event, properties)
  }
}

export const googleAnalyticsProvider: AnalyticsProvider = {
  trackEvent(event, properties) {
    if (typeof window === 'undefined') {
      return
    }

    if (!('gtag' in window)) {
      if (import.meta.env.PROD) {
        pendingEvents.push([event, properties])
      }
      return
    }

    window.gtag('event', event, properties)
  },
}
