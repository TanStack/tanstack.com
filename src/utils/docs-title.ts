import { parseSiteMarkdown } from './markdown'

export function getDocsTitle(title: string | undefined, content: string) {
  return (
    title ??
    parseSiteMarkdown(content).headings.find((heading) => heading.level === 1)
      ?.text ??
    'Documentation'
  )
}
