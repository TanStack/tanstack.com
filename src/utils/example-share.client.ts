import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'

const sharedProjectFragmentPrefix = '#project='
const inlineUrlLimit = 8_000

export async function createSharedExampleUrl(project: SharedExampleProject) {
  const encoded = await encodeSharedExampleProject(project)
  const inlineUrl = new URL('/builder', window.location.origin)
  inlineUrl.hash = `${sharedProjectFragmentPrefix.slice(1)}${encoded}`

  if (inlineUrl.href.length <= inlineUrlLimit) return inlineUrl

  const response = await fetch('/api/builder/projects', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: serializeSharedExampleProject(project),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Sign in to share projects larger than 8 KB.')
    }

    throw new Error(await readShareError(response))
  }

  const result: unknown = await response.json()
  if (!isRecord(result) || typeof result.url !== 'string') {
    throw new Error('The builder share response was invalid.')
  }

  return new URL(result.url, window.location.origin)
}

export async function decodeSharedExampleProject(hash: string) {
  if (!hash.startsWith(sharedProjectFragmentPrefix)) return undefined

  const encoded = hash.slice(sharedProjectFragmentPrefix.length)
  const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const decompressed = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  const source = await new Response(decompressed).text()

  return parseSharedExampleProject(JSON.parse(source))
}

async function encodeSharedExampleProject(project: SharedExampleProject) {
  const source = serializeSharedExampleProject(project)
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

async function readShareError(response: Response) {
  const value: unknown = await response.json().catch(() => undefined)
  if (isRecord(value) && typeof value.error === 'string') return value.error
  return 'Unable to share this builder.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
