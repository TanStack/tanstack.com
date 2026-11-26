import * as React from 'react'
import * as Sentry from '@sentry/tanstackstart-react'
import { DocContainer } from '~/components/DocContainer'

/**
 * Rendered by docs routes when the router renders a match before its loader
 * data is available (observed during client-side navigation). Reports the
 * condition so it stays visible in Sentry, and renders an empty container
 * until the loader data arrives and the route re-renders.
 */
export function MissingDocsLoaderData({
  routeId,
  params,
  pathname,
}: {
  routeId: string
  params: Record<string, string | undefined>
  pathname: string
}) {
  const paramsKey = JSON.stringify(params)

  React.useEffect(() => {
    Sentry.captureMessage('Docs route rendered without loader data', {
      level: 'warning',
      tags: { routeId },
      extra: { params, pathname },
    })
    // Report once per route/params/pathname combination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, paramsKey, pathname])

  return <DocContainer aria-busy="true">{null}</DocContainer>
}
