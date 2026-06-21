export type MarkdownInput = string | MarkdownDocument

export interface MarkdownDocument {
  type: 'root'
  children: BlockNode[]
  frontmatter?: string
  headings?: MarkdownHeading[]
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | CodeBlockNode
  | ListNode
  | BlockquoteNode
  | TableNode
  | ThematicBreakNode
  | HtmlBlockNode
  | CalloutNode
  | ComponentNode

export interface HeadingNode {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  id?: string
  framework?: string
  children: InlineNode[]
}

export interface ParagraphNode {
  type: 'paragraph'
  children: InlineNode[]
}

export interface CodeBlockNode {
  type: 'code'
  lang?: string
  meta?: string
  title?: string
  framework?: string
  file?: string
  value: string
  highlightLines?: number[]
}

export interface ListNode {
  type: 'list'
  ordered: boolean
  start?: number
  items: ListItemNode[]
}

export interface ListItemNode {
  type: 'listItem'
  checked?: boolean
  children: BlockNode[]
}

export interface BlockquoteNode {
  type: 'blockquote'
  children: BlockNode[]
}

export interface TableNode {
  type: 'table'
  align: Array<'left' | 'center' | 'right' | undefined>
  header: TableCellNode[]
  rows: TableCellNode[][]
}

export interface TableCellNode {
  type: 'tableCell'
  children: InlineNode[]
}

export interface ThematicBreakNode {
  type: 'thematicBreak'
}

export interface HtmlBlockNode {
  type: 'html'
  value: string
}

export interface CalloutNode {
  type: 'callout'
  kind: string
  title: string
  children: BlockNode[]
}

export interface ComponentNode {
  type: 'component'
  name: string
  attributes: Record<string, string>
  children: BlockNode[]
  tagName?: string
  properties?: Record<string, string>
}

export type InlineNode =
  | TextNode
  | CodeSpanNode
  | StrongNode
  | EmphasisNode
  | StrikeNode
  | LinkNode
  | ImageNode
  | BreakNode
  | HtmlInlineElementNode
  | HtmlInlineNode

export interface TextNode {
  type: 'text'
  value: string
}

export interface CodeSpanNode {
  type: 'inlineCode'
  value: string
}

export interface StrongNode {
  type: 'strong'
  children: InlineNode[]
}

export interface EmphasisNode {
  type: 'emphasis'
  children: InlineNode[]
}

export interface StrikeNode {
  type: 'strike'
  children: InlineNode[]
}

export interface LinkNode {
  type: 'link'
  href: string
  title?: string
  children: InlineNode[]
}

export interface ImageNode {
  type: 'image'
  src: string
  alt: string
  title?: string
}

export interface BreakNode {
  type: 'break'
}

export interface HtmlInlineNode {
  type: 'inlineHtml'
  value: string
}

export interface HtmlInlineElementNode {
  type: 'inlineElement'
  tagName: string
  attributes: Record<string, string>
  children: InlineNode[]
  void: boolean
}

export interface MarkdownExtension {
  name: string
  parseBlock?: (context: BlockParseContext) => BlockNode | undefined
  transformDocument?: (
    document: MarkdownDocument,
    context: DocumentTransformContext,
  ) => MarkdownDocument | void
  transformInline?: (
    nodes: InlineNode[],
    context: InlineTransformContext,
  ) => InlineNode[]
  renderHtml?: (
    node: BlockNode | InlineNode,
    context: HtmlRenderContext,
  ) => string | undefined
}

export interface BlockParseContext {
  lines: string[]
  index: number
  options: ParseOptions
  parseInline: (value: string) => InlineNode[]
  parseBlocks: (value: string) => BlockNode[]
  consume: (lines: number) => void
}

export interface InlineTransformContext {
  options: ParseOptions
}

export interface DocumentTransformContext {
  options: ParseOptions
}

export interface HtmlRenderContext {
  options: RenderOptions
  renderBlock: (node: BlockNode) => string
  renderInline: (node: InlineNode) => string
}

export interface ParseOptions {
  allowHtml?: boolean
  frontmatter?: boolean
  headingIds?: boolean | ((text: string, index: number) => string)
  extensions?: MarkdownExtension[]
}

export interface RenderOptions extends ParseOptions {
  highlighter?: CodeHighlighter
  codeLineNumbers?: boolean
  headingAnchors?: boolean | HeadingAnchorOptions
}

export interface CodeHighlighter {
  (code: string, lang?: string, options?: CodeHighlightOptions): string
}

export interface CodeHighlightOptions {
  highlightLines?: number[]
  lineNumbers?: boolean
}

export interface HeadingAnchorOptions {
  content?: string
  className?: string
  ariaHidden?: boolean
  tabIndex?: number
}

export interface MarkdownHeading {
  id: string
  text: string
  level: number
  framework?: string
}
