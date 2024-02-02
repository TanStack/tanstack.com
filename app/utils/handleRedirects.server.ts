import { redirect } from '@remix-run/node'

type RedirectItem = { from: string; to: string }

export function handleRedirects(
  redirectItems: RedirectItem[],
  urlFromRequest: string,
  urlFromPathStart: string,
  urlToPathStart: string,
  urlToQueryParams: string
) {
  const url = new URL(urlFromRequest)
  redirectItems.forEach((item) => {
    if (url.pathname.startsWith(`${urlFromPathStart}/${item.from}`)) {
      /* console.log({
        urlTo: `${urlToPathStart}/${item.to}?${urlToQueryParams}`,
        urlFromRequest,
        itemFrom: item.from,
        urlFromPathStart,
        urlToPathStart,
      }) */
      throw redirect(`${urlToPathStart}/${item.to}?${urlToQueryParams}`)
    }
  })
}
