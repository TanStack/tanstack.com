import { renderCodeFence, type CodeFenceInput } from './markdown'

export type RemarkCodeNode = {
  type: 'code'
  value: string
  lang?: string | null
  meta?: string | null
}

export type RemarkHtmlNode = {
  type: 'html'
  value: string
  data?: Record<string, unknown>
}

export type RemarkHighlightOptions = {
  getTitle?: (node: RemarkCodeNode) => string | undefined
}

type UnknownNode = {
  children?: Array<UnknownNode>
  type?: string
  [key: string]: unknown
}

export function remarkCodeNodeToHtml(
  node: RemarkCodeNode,
  options: RemarkHighlightOptions = {},
): RemarkHtmlNode {
  const rendered = renderCodeFence({
    code: node.value,
    lang: node.lang,
    meta: node.meta,
    title: options.getTitle?.(node),
  } satisfies CodeFenceInput)

  return {
    type: 'html',
    value: rendered.htmlMarkup,
    data: {
      tanstackHighlight: {
        copyText: rendered.copyText,
        lang: rendered.lang,
        title: rendered.title,
      },
    },
  }
}

export function remarkHighlightCodeBlocks(
  options: RemarkHighlightOptions = {},
) {
  return function transformer(tree: UnknownNode) {
    replaceCodeNodes(tree, options)
  }
}

function replaceCodeNodes(node: UnknownNode, options: RemarkHighlightOptions) {
  const children = node.children
  if (!children) return

  for (let index = 0; index < children.length; index++) {
    const child = children[index]

    if (isRemarkCodeNode(child)) {
      children[index] = remarkCodeNodeToHtml(child, options) as UnknownNode
      continue
    }

    replaceCodeNodes(child, options)
  }
}

function isRemarkCodeNode(
  node: UnknownNode,
): node is UnknownNode & RemarkCodeNode {
  return node.type === 'code' && typeof node.value === 'string'
}
