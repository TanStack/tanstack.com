import { LoaderArgs, redirect } from '@remix-run/node'

export const loader = (context : LoaderArgs) => {
  throw redirect(
    context.request.url.replace(/\/examples.*/, '/examples/react/basic')
  )
}
