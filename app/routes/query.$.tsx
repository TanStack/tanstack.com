import { redirect } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { reactQueryV3List, reactQueryV3RemovedInV5List } from '~/projects/query'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const loader = (context: LoaderFunctionArgs) => {
  handleRedirects(
    reactQueryV3List,
    context.request.url,
    '/query/v3',
    '/query/latest',
    'from=reactQueryV3'
  )

  handleRedirects(
    reactQueryV3RemovedInV5List,
    context.request.url,
    '/query/v3',
    '/query/v5',
    'from=reactQueryV3'
  )

  return redirect(`/query/latest`)
}
