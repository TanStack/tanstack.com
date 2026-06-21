import { docsMarkdownExtensions } from '@tanstack/markdown/extensions/docs'
import { parseMarkdown } from '@tanstack/markdown/parser'
import type { MarkdownDocument, MarkdownHeading } from '@tanstack/markdown'

export type { MarkdownDocument, MarkdownHeading } from '@tanstack/markdown'

export type SiteMarkdownDocument = MarkdownDocument & {
  headings: Array<MarkdownHeading>
}

export function parseSiteMarkdown(content: string): SiteMarkdownDocument {
  const document = parseMarkdown(content, {
    allowHtml: true,
    extensions: docsMarkdownExtensions(),
    headingIds: true,
  })

  return {
    ...document,
    headings: document.headings ?? [],
  }
}
