import type { AnalyticsProvider } from '../types'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export const googleAnalyticsProvider: AnalyticsProvider = {
  trackEvent(event, properties) {
    if (typeof window === 'undefined' || !window.gtag) {
      return
    }

    window.gtag('event', event, properties)
  },
}
