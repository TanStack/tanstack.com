// Markdown types - separate file to avoid pulling processor into client bundles

export type MarkdownHeading = {
  id: string
  text: string
  level: number
  framework?: string
}
