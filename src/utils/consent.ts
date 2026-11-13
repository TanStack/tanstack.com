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
  // No request to Google, and no cookieless pings, until Analytics is allowed.
  loadMode: 'after-consent',
  config: {
    send_page_view: false,
    // A fixed origin, because a returning visitor's config runs from the server
    // HTML, where there is no window. Analytics only loads on tanstack.com.
    transport_url: `https://tanstack.com${GOOGLE_ANALYTICS_PROXY_PREFIX}`,
  },
  // The helper has no loader URL option, only this deprecated override. The
  // proxy is what keeps gtag.js loading behind ad blockers.
  script: { src: `${GOOGLE_ANALYTICS_PROXY_PREFIX}/gtag.js` },
})

// Vendor scripts load through c15t, which gates them on the visitor's choice.
// Analytics only runs in production.
export const consentScripts: NonNullable<ConsentRootProps['scripts']> =
  import.meta.env.PROD
    ? [
        {
          ...googleTag,
          // Keep onBeforeLoad as the helper's own: c15t only starts a helper
          // from the server HTML when it is unchanged. The first page view
          // also flushes held events, so this covers a visitor who sends none.
          onLoad: flushPendingGoogleAnalyticsEvents,
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
