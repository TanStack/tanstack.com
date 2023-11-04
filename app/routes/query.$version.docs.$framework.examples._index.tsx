import { redirect } from '@remix-run/node'
import type { LoaderArgs } from '@remix-run/node'

export const loader = (context: LoaderArgs) => {
  const { framework } = context.params

  throw redirect(
    context.request.url.replace('/examples/', `/examples/${framework}/basic`)
  )
}
