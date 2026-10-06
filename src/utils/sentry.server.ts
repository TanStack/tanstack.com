import * as Sentry from '@sentry/node'
import { env } from '~/utils/env'

const SENTRY_DSN =
  'https://ac4bfc43ff4a892f8dc7053c4a50d92f@o4507236158537728.ingest.us.sentry.io/4507236163649536'

export function initSentryServer(): void {
  if (Sentry.getClient()) return

  Sentry.init({
    dsn: env.SENTRY_DSN ?? SENTRY_DSN,
    enabled: process.env.NODE_ENV === 'production' || Boolean(env.SENTRY_DSN),
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV ?? 'development',
  })
}

export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, {
    tags: {
      runtime: 'server',
      context: 'mcp',
    },
    extra: context,
  })
}

export function withSentrySpan<TResult>(
  name: string,
  operation: string,
  fn: () => Promise<TResult>,
): Promise<TResult> {
  return Sentry.startSpan(
    {
      name,
      op: operation,
      attributes: {
        runtime: 'server',
        context: 'mcp',
      },
    },
    fn,
  )
}
