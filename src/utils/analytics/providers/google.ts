import { TRAFFIC_QUALITY_BOOTSTRAP } from '../traffic-quality'
import type { AnalyticsProvider, EventPayload } from '../types'

// Matches the declaration in @c15t/integrations/google-tag, which defines
// gtag once Analytics is allowed.
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}

// Page views can arrive before c15t defines gtag: before the visitor chooses,
// or before hydration starts the loader. Hold them until gtag exists.
const pendingEvents: Array<[string, EventPayload]> = []
let trafficQualityInstalled = false

// c15t defines gtag either from the server HTML or from its script loader.
// Either way, wrap it so every event carries traffic_quality, then send the
// held events in order.
export function flushPendingGoogleAnalyticsEvents() {
  if (!trafficQualityInstalled) {
    trafficQualityInstalled = true
    new Function(TRAFFIC_QUALITY_BOOTSTRAP)()
  }
  for (const [event, properties] of pendingEvents.splice(0)) {
    window.gtag('event', event, properties)
  }
}

export const googleAnalyticsProvider: AnalyticsProvider = {
  trackEvent(event, properties) {
    if (import.meta.env.MODE === 'staging' || typeof window === 'undefined') {
      return
    }

    if (!('gtag' in window)) {
      if (import.meta.env.PROD) {
        pendingEvents.push([event, properties])
      }
      return
    }

    flushPendingGoogleAnalyticsEvents()
    window.gtag('event', event, properties)
  },
}
