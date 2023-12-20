import { redirect } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

export const loader = (context: LoaderFunctionArgs) => {
  const { framework } = context.params

  throw redirect(
    context.request.url.replace('/examples/', `/examples/${framework}/basic`)
  )
}
