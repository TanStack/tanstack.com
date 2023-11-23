import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader: LoaderFunction = (context) => {
  throw redirect(context.request.url.replace(/\/docs.*/, '/docs/overview'))
}
