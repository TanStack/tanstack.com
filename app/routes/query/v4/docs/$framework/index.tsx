import type { LoaderArgs} from '@remix-run/node';
import { redirect } from '@remix-run/node'

export const loader = (context : LoaderArgs) => {
  throw redirect(context.request.url + '/overview')
}