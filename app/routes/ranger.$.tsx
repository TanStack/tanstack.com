import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return redirect('/ranger/latest')
}

function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  const reactRangerV1List = [
    { from: 'docs/overview', to: 'docs/introduction' },
    { from: 'docs/installation', to: 'docs/installation' },
  ]

  reactRangerV1List.forEach((item) => {
    if (url.pathname.startsWith(`/ranger/v1/${item.from}`)) {
      throw redirect(`/ranger/v0/${item.to}`)
    }
  })
}
