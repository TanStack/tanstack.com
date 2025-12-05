import { redirect } from '@tanstack/react-router'

type RedirectItem = { from: string; to: string }

export function handleRedirects(
  redirectItems: RedirectItem[],
  urlFromRequest: string,
  urlFromPathStart: string,
  urlToPathStart: string,
  urlToQueryParams: string,
) {
  const url = new URL(urlFromRequest, 'https://tanstack.com')

  redirectItems.forEach((item) => {
    if (url.pathname.startsWith(`${urlFromPathStart}/${item.from}`)) {
      /*
        We create a URL object from the destination route before
        adding the query params to make sure that the URL hash
        (#this-part) is preserved.
      */
      const urlTo = new URL(`${url.origin}${urlToPathStart}/${item.to}`)
      urlTo.search = urlToQueryParams

      throw redirect({
        href: urlTo.href,
      })
    }
  })
}
