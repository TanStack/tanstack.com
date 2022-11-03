import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return redirect('/router/v1')
}

function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  // prettier-ignore
  const reactLocationv2List = [
    {from: 'docs/overview',to: 'docs/guide/introduction',},
    {from: 'docs/installation',to: 'docs/guide/installation',},
    {from: 'docs/api',to: 'docs/api/virtualizer',},
    {from: 'examples/fixed',to: 'docs/examples/react/fixed',},
    {from: 'examples/variable',to: 'docs/examples/react/variable',},
    {from: 'examples/dynamic',to: 'docs/examples/react/dynamic',},
    {from: 'examples/infinite-scroll',to: 'docs/examples/react/infinite-scroll',},
    {from: 'examples/padding',to: 'docs/examples/react/padding',},
    {from: 'examples/smooth-scroll',to: 'docs/examples/react/smooth-scroll',},
    {from: 'examples/sticky',to: 'docs/examples/react/sticky',},
    {from: '',to: '',},
  ]

  reactLocationv2List.forEach((item) => {
    if (url.pathname.startsWith(`/router/vrl/${item.from}`)) {
      throw redirect(
        `/router/v1/${item.to}?from=reactLocationV2&original=https://react-location-v2.tanstack.com/${item.from}`
      )
    }
  })
}
