import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { reactVirtualV2List } from '~/projects/virtual'
import { handleRedirects } from '~/utils/handleRedirects.server'

export const loader = (context: LoaderFunctionArgs) => {
  handleRedirects(
    reactVirtualV2List,
    context.request.url,
    '/virtual/v2',
    '/virtual/v3',
    'from=reactVirtualV2'
  )

  return redirect('/virtual/latest')
}
