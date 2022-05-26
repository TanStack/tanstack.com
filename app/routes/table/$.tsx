import { LoaderFunction } from 'remix'
import { handleRedirects } from '~/redirects'

export const loader: LoaderFunction = (context) => {
  console.log('hello', context.request.url)
  handleRedirects(context)

  return new Response('OK')
}
