import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return redirect('/ranger/v1')
}

function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  // prettier-ignore
  const reactRangerV1List = [
    {from: 'docs/overview',to: 'docs/guide/introduction',},
    {from: 'docs/installation',to: 'docs/guide/installation',},
    {from: 'examples/basic',to: 'docs/examples/react/basic',},
    {from: 'examples/custom-steps',to: 'docs/examples/react/custom-steps',},
    {from: 'examples/custom-styles',to: 'docs/examples/react/custom-styles',},
    {from: 'examples/logarithmic-interpolator',to: 'docs/examples/react/logarithmic-interpolator',},
    {from: 'examples/update-on-drag',to: 'docs/examples/react/update-on-drag',},
    {from: '',to: '',},
  ]

  reactRangerV1List.forEach((item) => {
    if (url.pathname.startsWith(`/ranger/v1/${item.from}`)) {
      throw redirect(
        `/ranger/v1/${item.to}?from=reactRangerV1&original=https://react-ranger-v1.tanstack.com/${item.from}`,
        301
      )
    }
  })
}
