import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeaders } from '@tanstack/react-start/server'
import { parseVisitorLocation } from './visitor-location'

export const getVisitorLocation = createServerFn({ method: 'GET' }).handler(
  () => {
    setResponseHeaders(
      new Headers({
        'Cache-Control': 'private, no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      }),
    )
    const request = getRequest()
    return parseVisitorLocation('cf' in request ? request.cf : undefined)
  },
)
