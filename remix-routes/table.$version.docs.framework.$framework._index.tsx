import type { LoaderFunctionArgs } from '@remix-run/node'

export const loader = async (context) => {
  throw redirect(context.request.url.replace(/\/docs.*/, '/docs/introduction'))
}
