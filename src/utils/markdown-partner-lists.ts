import type { MarkdownDocument } from '@tanstack/markdown'

// Standalone blocks only, so examples inside code fences stay literal.
export function mapMarkdownPartnerLists(
  document: MarkdownDocument,
): MarkdownDocument {
  return {
    ...document,
    children: document.children.map((block) => {
      if (block.type !== 'html') return block

      const match = block.value.match(
        /^\s*<(partner-list|previous-partner-list)>\s*<\/\1>\s*$/,
      )
      if (!match) return block

      return {
        type: 'component',
        name: match[1],
        tagName: match[1],
        attributes: {},
        properties: {},
        children: [],
      }
    }),
  }
}
