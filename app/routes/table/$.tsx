import { LoaderFunction } from 'remix'
import { handleRedirects } from '~/redirects'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return new Response('OK')
}
