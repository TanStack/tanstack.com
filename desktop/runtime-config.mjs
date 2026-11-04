export const productionOrigin = 'https://tanstack.com'

export function resolveAppUrl({ packaged, developmentUrl }) {
  const url = new URL(
    packaged ? productionOrigin : developmentUrl || 'http://127.0.0.1:3000/',
  )
  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && url.hostname === '127.0.0.1')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'The desktop app URL must be an HTTPS origin or local 127.0.0.1 origin.',
    )
  url.pathname = '/chat'
  return url
}
