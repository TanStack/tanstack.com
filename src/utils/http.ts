export const docsContentNegotiationVaryHeader =
  'Accept, Accept-Encoding, Sec-Fetch-Dest, Sec-Fetch-Mode'

export function redirectInsecureSiteRequest(request: Request) {
  if (!request.url.startsWith('http://tanstack.com/')) return

  return Response.redirect(request.url.replace(/^http:/, 'https:'), 308)
}
