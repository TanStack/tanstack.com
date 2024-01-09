import { redirect } from '@remix-run/node'
import type { LoaderFunction } from '@remix-run/node'

export const loader: LoaderFunction = (context) => {
  throw redirect(
    context.request.url.replace(/\/examples.*/, '/examples/react/basic')
  )
}
