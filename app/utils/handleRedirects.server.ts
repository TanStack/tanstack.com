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
      /*
        We create a URL object from the destination route before
        adding the query params to make sure that the URL hash
        (#this-part) is preserved.
      */
      const urlTo = new URL(`${url.origin}${urlToPathStart}/${item.to}`)
      urlTo.search = urlToQueryParams

      throw redirect(urlTo.href)
    }
  })
}
