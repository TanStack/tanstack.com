import { renderToString } from 'react-dom/server'
import { EntryContext, RemixServer } from '@remix-run/react'
// import { initStyles, renderWithStyles } from './utils/styleContext'
// initStyles()

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // const [markup, hashPath] = renderWithStyles(
  //   <RemixServer context={remixContext} url={request.url} />
  // )

  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  )

  responseHeaders.set('Content-Type', 'text/html')
  // responseHeaders.append('Link', `<${hashPath}>; rel=preload; as=style`)

  return new Response('<!DOCTYPE html>' + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  })
}
