import { storeBuilderProjectRevision } from './builder-project.client'
import {
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'

const sharedProjectFragmentPrefix = '#project='
const inlineUrlLimit = 8_000

export async function createSharedExampleUrl(project: SharedExampleProject) {
  const encoded = await encodeSharedExampleProject(project)
  const inlineUrl = new URL('/chat/shared', window.location.origin)
  inlineUrl.hash = `${sharedProjectFragmentPrefix.slice(1)}${encoded}`

  if (inlineUrl.href.length <= inlineUrlLimit) return inlineUrl

  const snapshot = await storeBuilderProjectRevision(project)
  return new URL(`/chat/p/${snapshot}`, window.location.origin)
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
