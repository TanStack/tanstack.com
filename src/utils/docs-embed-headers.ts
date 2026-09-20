import { getClientExampleConfig } from './client-example-config'
import { getExampleRuntimeHeaders } from './stackblitz-embed'

const clientExampleCommentPattern = /<!--\s*::client-example\b([^>]*)-->/gi
const clientExampleAttributePattern = /([a-z]+)=([a-z0-9-]+)/gi

/**
 * Return WebContainer COOP/COEP headers when the markdown embeds a
 * `::client-example` that boots a WebContainer. Docs pages do not set these
 * by default. The Examples tab does.
 */
export function getDocsEmbedRuntimeHeaders({
  content,
  version,
}: {
  content: string
  version: string
}) {
  for (const match of content.matchAll(clientExampleCommentPattern)) {
    const attributes: Record<string, string> = {}
    for (const attribute of (match[1] ?? '').matchAll(
      clientExampleAttributePattern,
    )) {
      const key = attribute[1]
      const value = attribute[2]
      if (key && value) attributes[key] = value
    }

    const library = attributes.library
    const framework = attributes.framework
    const slug = attributes.slug
    if (!library || !framework || !slug) continue

    const config = getClientExampleConfig({
      framework,
      libraryId: library,
      slug,
      version,
    })
    if (config?.runtime?.type === 'webcontainer') {
      return getExampleRuntimeHeaders('webcontainer')
    }
  }

  return {}
}
