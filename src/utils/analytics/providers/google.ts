import type { AnalyticsProvider } from '../types'

declare global {
  interface Window {
    dataLayer: unknown[] | undefined
    gtag: ((...args: unknown[]) => void) | undefined
  }
}

export const googleAnalyticsProvider: AnalyticsProvider = {
  trackEvent(event, properties) {
    if (
      import.meta.env.MODE === 'staging' ||
      typeof window === 'undefined' ||
      window.location.hostname !== 'tanstack.com' ||
      !window.gtag
    ) {
      return
    }

    window.gtag('event', event, properties)
  },
}
