import * as Sentry from '@sentry/tanstackstart-react'
import { redactByokRequestHeaders } from './utils/sentry-redaction'

if (!Sentry.getClient())
  Sentry.init({
    dsn:
      process.env.SENTRY_DSN ??
      'https://ac4bfc43ff4a892f8dc7053c4a50d92f@o4507236158537728.ingest.us.sentry.io/4507236163649536',
    enabled:
      process.env.NODE_ENV === 'production' || Boolean(process.env.SENTRY_DSN),
    integrations: [],
    sendDefaultPii: true,
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ['localhost', /^https:\/\/tanstack\.com\//],
    // The lookup URL contains a visitor IP, so do not retain its breadcrumb.
    beforeBreadcrumb(breadcrumb) {
      if (
        typeof breadcrumb.data?.url === 'string' &&
        breadcrumb.data.url.startsWith(
          'https://api.scarf.sh/v3/organizations/TanStack/ip-company',
        )
      )
        return null
      return breadcrumb
    },
    beforeSend: redactByokRequestHeaders,
  })
