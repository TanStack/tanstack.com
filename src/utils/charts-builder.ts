const sharedSourcePrefix = '#code='

export async function encodeSharedChartSource(source: string) {
  const compressed = new Blob([source])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer())
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function decodeSharedChartSource(hash: string) {
  if (!hash.startsWith(sharedSourcePrefix)) return undefined

  const encoded = hash.slice(sharedSourcePrefix.length)
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const decompressed = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))

  return new Response(decompressed).text()
}

export function createSharedChartUrl(encodedSource: string) {
  const url = new URL(window.location.href)
  url.hash = `${sharedSourcePrefix.slice(1)}${encodedSource}`
  return url
}
