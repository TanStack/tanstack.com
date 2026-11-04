import { LinkifyIt } from 'linkify-it'
import type {
  BlockNode,
  InlineNode,
  MarkdownExtension,
} from '@tanstack/markdown'

// Explicit web URLs only. Leave emails, bare domains and other protocols as text.
const links = new LinkifyIt({
  fuzzyLink: false,
  fuzzyEmail: false,
  fuzzyIP: false,
})

function inline(nodes: InlineNode[]): InlineNode[] {
  return nodes.flatMap((node): InlineNode[] => {
    if (node.type === 'text') {
      const matches = (links.match(node.value) ?? []).filter((match) =>
        /^https?:\/\//i.test(match.url),
      )
      const output: InlineNode[] = []
      let offset = 0
      for (const match of matches) {
        if (match.index > offset)
          output.push({
            type: 'text',
            value: node.value.slice(offset, match.index),
          })
        output.push({
          type: 'link',
          href: match.url,
          children: [{ type: 'text', value: match.raw }],
        })
        offset = match.lastIndex
      }
      if (!matches.length) return [node]
      if (offset < node.value.length)
        output.push({ type: 'text', value: node.value.slice(offset) })
      return output
    }
    if (
      node.type === 'strong' ||
      node.type === 'emphasis' ||
      node.type === 'strike' ||
      node.type === 'inlineComponent'
    )
      return [{ ...node, children: inline(node.children) }]
    // Never create anchors inside an existing link, image, code span or raw HTML.
    return [node]
  })
}

function blocks(nodes: BlockNode[]): BlockNode[] {
  return nodes.map((node) => {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
        return { ...node, children: inline(node.children) }
      case 'callout':
      case 'component':
        return { ...node, children: blocks(node.children) }
      case 'list':
      case 'footnotes':
        return {
          ...node,
          items: node.items.map((item) => ({
            ...item,
            children: blocks(item.children),
          })),
        } as BlockNode
      case 'table':
        return {
          ...node,
          header: node.header.map((cell) => ({
            ...cell,
            children: inline(cell.children),
          })),
          rows: node.rows.map((row) =>
            row.map((cell) => ({ ...cell, children: inline(cell.children) })),
          ),
        }
      // Quoted source evidence intentionally stays inert.
      default:
        return node
    }
  })
}

export const webLinksExtension: MarkdownExtension = {
  name: 'gum-web-links',
  transformDocument: (document) => ({
    ...document,
    children: blocks(document.children),
  }),
}
