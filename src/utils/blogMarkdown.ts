import { parseSiteMarkdown } from './markdown'

export function parseBlogMarkdown(content: string) {
  const markdown = parseSiteMarkdown(content)
  const titleIndex = markdown.children.findIndex(
    (block) =>
      block.type !== 'html' ||
      !/^\s*(?:<!--[\s\S]*?-->\s*)+$/.test(block.value),
  )
  const title = markdown.children[titleIndex]

  if (title?.type === 'heading' && title.depth === 1) {
    markdown.children.splice(titleIndex, 1)
    markdown.headings = markdown.headings.filter(
      (heading) => heading.id !== title.id,
    )
  }

  return markdown
}
