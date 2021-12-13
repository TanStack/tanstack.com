import { PassThrough } from 'stream'
import { RemixServer } from 'remix'
import type { EntryContext } from 'remix'
import { initStyles, renderWithStyles } from './utils/styleContext'

initStyles()

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const [markup, hashPath] = renderWithStyles(
    <RemixServer context={remixContext} url={request.url} />
  );

  let body = new PassThrough()
  setImmediate(() => {
    body.push('<!DOCTYPE html>')
    body.push(markup)
    body.push(null)
  })

  responseHeaders.set('Content-Type', 'text/html')
  responseHeaders.append('Link', `<${hashPath}>; rel=preload; as=style`)

  return new Response(body as any, {
    status: responseStatusCode,
    headers: responseHeaders,
  })
}
