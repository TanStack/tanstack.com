import { LoaderFunction, redirect } from 'remix'

export const loader: LoaderFunction = (context) => {
  handleRedirects(context)

  return new Response('OK')
}

function handleRedirects(context: Parameters<LoaderFunction>[0]) {
  const url = new URL(context.request.url)
  // prettier-ignore
  const reactTablev7List = [
    {from: 'docs/api/overview',to: 'docs/guide/01-overview',},
    {from: 'docs/examples/basic',to: 'docs/examples/react/basic',},
    {from: 'docs/installation',to: 'docs/guide/02-installation',},
    {from: 'docs/overview',to: 'docs/guide/00-introduction',},
    {from: 'docs/quick-start',to: 'docs/guide/01-overview',},
    {from: '',to: '',},
  ]

  reactTablev7List.forEach((item) => {
    if (url.pathname.startsWith(`/table/v7/${item.from}`)) {
      throw redirect(
        `/virtual/v3/${item.to}?from=reactVirtualV2&original=https://react-virtual-v2.tanstack.com/${item.from}`
      )
    }
  })
}
