import { redirect } from '@remix-run/node'
import type { LoaderArgs } from '@remix-run/node'

export const loader = (context: LoaderArgs) => {
  return redirect(`/form/latest`, 301)
}
