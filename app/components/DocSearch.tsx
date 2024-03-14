// During SSR, we need to double unpack the default export.
// On the client in the browser, we can rely on vite to handle this for us.

import * as pkg from '@docsearch/react'

let DocSearch: typeof pkg.DocSearch

if (import.meta.env.SSR) {
  DocSearch = (pkg as unknown as { default: any }).default.DocSearch
} else {
  DocSearch = pkg.DocSearch
}

export { DocSearch }
