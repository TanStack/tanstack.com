import type { InlineNode, MarkdownExtension } from '@tanstack/markdown'

// The agent often emits bare URLs in prose, and CommonMark only autolinks
// URLs wrapped in angle brackets. Turn bare http(s) URLs inside text nodes
// into links. Code spans and existing links are separate inline node types,
// so this transform can never touch them.
const BARE_URL_PATTERN = /https?:\/\/[^\s<>]+/g
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?'"]+$/

// GFM autolink rule: a trailing `)` is only punctuation when the URL has
// more closing than opening parens, so `/routes/(auth)` stays intact while
// `(see https://x.dev/a)` drops the wrapper.
function trimBareUrl(raw: string) {
  let url = raw.replace(TRAILING_PUNCTUATION_PATTERN, '')

  while (url.endsWith(')') && url.split(')').length > url.split('(').length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION_PATTERN, '')
  }

  return url
}

export function autolinkInlineNodes(
  nodes: Array<InlineNode>,
): Array<InlineNode> {
  return nodes.flatMap((node): Array<InlineNode> => {
    if (
      node.type === 'strong' ||
      node.type === 'emphasis' ||
      node.type === 'strike'
    ) {
      return [{ ...node, children: autolinkInlineNodes(node.children) }]
    }

    if (node.type !== 'text') {
      return [node]
    }

    const parts: Array<InlineNode> = []
    let cursor = 0

    for (const match of node.value.matchAll(BARE_URL_PATTERN)) {
      const index = match.index ?? 0
      const url = trimBareUrl(match[0])

      if (index > cursor) {
        parts.push({ type: 'text', value: node.value.slice(cursor, index) })
      }
      parts.push({
        type: 'link',
        href: url,
        children: [{ type: 'text', value: url }],
      })
      cursor = index + url.length
    }

    if (parts.length === 0) {
      return [node]
    }

    if (cursor < node.value.length) {
      parts.push({ type: 'text', value: node.value.slice(cursor) })
    }

    return parts
  })
}

export const autolinkBareUrlsExtension: MarkdownExtension = {
  name: 'autolink-bare-urls',
  transformInline: autolinkInlineNodes,
}
