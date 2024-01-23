import { redirect } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

export const loader = async (context: LoaderFunctionArgs) => {
  throw redirect(context.request.url.replace(/\/docs.*/, '/docs/overview'))
}
