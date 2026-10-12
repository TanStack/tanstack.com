import type { ConsentRootProps } from '@c15t/tanstack-start'
import { gtag } from '@c15t/integrations/google-tag'
import { sentry } from '@c15t/integrations/sentry'
import { getClient, setUser } from '@sentry/tanstackstart-react'
import { flushPendingGoogleAnalyticsEvents } from '~/utils/analytics/providers/google'
import { scarf } from '~/utils/analytics/scarf'

const GOOGLE_ANALYTICS_ID = 'G-JMT1Z50SPS'
// src/server.ts proxies gtag.js and its collect endpoint through /_a.
const GOOGLE_ANALYTICS_PROXY_PREFIX = '/_a'

// Page views are sent only by <PageViewTracker /> (initial load and SPA
// navigations), so the gtag config sets send_page_view: false.
const googleTag = gtag({
  id: GOOGLE_ANALYTICS_ID,
  category: 'measurement',
  config: {
    send_page_view: false,
    transport_url:
      typeof window === 'undefined'
        ? undefined
        : `${window.location.origin}${GOOGLE_ANALYTICS_PROXY_PREFIX}`,
  },
  // The helper has no loader URL option yet, and the proxy is what keeps
  // gtag.js loading behind ad blockers.
  script: { src: `${GOOGLE_ANALYTICS_PROXY_PREFIX}/gtag.js` },
})

// Vendor scripts load through c15t, which gates them on the visitor's choice.
// Analytics only runs in production.
export const consentScripts: NonNullable<ConsentRootProps['scripts']> =
  import.meta.env.PROD
    ? [
        {
          ...googleTag,
          // Consent is per category only. Without vendor details the dialog
          // doesn't give Google Tag its own switch under Analytics.
          vendorDetails: undefined,
          onBeforeLoad(info) {
            // The helper defines gtag and queues consent defaults and config
            // here, so page views held since hydration can go out after them.
            googleTag.onBeforeLoad?.(info)
            flushPendingGoogleAnalyticsEvents()
          },
        },
        {
          id: 'namethathost',
          category: 'measurement',
          src: 'https://namethathost.com/tracker.js',
          defer: true,
          attributes: {
            'data-site': 'b7d91d66-ccee-480a-9d33-f7a9f109edc4',
            referrerpolicy: 'no-referrer',
          },
        },
        // Sentry starts in src/router.tsx so it catches hydration errors and
        // traces navigations. Error reports keep flowing for everyone; c15t
        // strips user data, IPs and session IDs until Analytics is allowed.
        sentry({ getClient, setUser }),
        scarf(),
      ]
    : []
