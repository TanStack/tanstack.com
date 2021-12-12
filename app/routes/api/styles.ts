import { LoaderFunction } from 'remix'
import { getStylesByHash } from '~/utils/styleContext'

export const loader: LoaderFunction = (context) => {
  // Parse the search params
  const url = new URL(context.request.url)
  const hash = url.searchParams.get('hash')

  if (!hash) {
    return new Response('Input Error: No style hash was provided', {
      status: 500,
    })
  }

  const styles = getStylesByHash(hash)

  if (!styles) {
    return new Response('', { status: 404 })
  }

  return new Response(styles, {
    status: 200,
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'max-age=31536000, max-stale=31536000',
    },
  })
}
