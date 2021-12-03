import { renderToString } from 'react-dom/server'
import { RemixServer } from 'remix'
import type { EntryContext } from 'remix'
import { virtualSheet, getStyleTag } from 'twind/sheets'
import { setup } from 'twind'
import { sharedTwindConfig } from '../twind.shared'

if (!global.__sheet) {
  global.__sheet = virtualSheet()
  setup({
    ...sharedTwindConfig,
    sheet: global.__sheet,
  })
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  global.__sheet.reset()

  let markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  )

  const styleTag = getStyleTag(global.__sheet)

  markup = markup.replace('</head>', styleTag + '</head>')

  responseHeaders.set('Content-Type', 'text/html')

  return new Response('<!DOCTYPE html>' + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  })
}
