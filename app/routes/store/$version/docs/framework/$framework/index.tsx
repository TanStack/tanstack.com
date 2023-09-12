import type { LoaderArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader = (context: LoaderArgs) => {
  // When first path part after docs contain framework name, just redirect to overview
  // if (
  //   context.request.url.includes('/docs/react') ||
  //   context.request.url.includes('/docs/solid') ||
  //   context.request.url.includes('/docs/vue') ||
  //   context.request.url.includes('/docs/svelte')
  // ) {
  //   throw redirect(context.request.url + '/overview')
  // }
}
