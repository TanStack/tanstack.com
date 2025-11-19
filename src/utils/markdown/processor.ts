import { unified, type PluggableList } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'

import {
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
  rehypeCallouts,
} from './plugins'

export type MarkdownHeading = {
  id: string
  text: string
  level: number
}

export type MarkdownRenderResult = {
  markup: string
  headings: MarkdownHeading[]
}

export type MarkdownProcessorOptions = {
  rehypePlugins?: PluggableList
}

export function renderMarkdown(
  content: any,
  { rehypePlugins = [] }: MarkdownProcessorOptions = {}
): MarkdownRenderResult {
  const headings: MarkdownHeading[] = []

  const processor = unified().use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeParseCommentComponents)
    .use(rehypeCallouts)
    .use(rehypeSlug)
    .use(rehypeTransformCommentComponents)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: {
        className: ['anchor-heading'],
      },
    })
    .use(() => (tree, file) => {
      visit(tree, 'element', (node) => {
        if (!('tagName' in node)) return
        if (!/^h[1-6]$/.test(String(node.tagName))) {
          return
        }

        const tagName = String(node.tagName)
        const id =
          typeof node.properties?.id === 'string' ? node.properties.id : ''
        if (!id) {
          return
        }

        headings.push({
          id,
          level: Number(tagName.substring(1)),
          text: toString(node).trim(),
        })
      })

      file.data.headings = headings
    })

  rehypePlugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      processor.use(plugin[0] as any, ...(plugin.slice(1) as any))
    } else {
      processor.use(plugin as any)
    }
  })

  const file = processor.use(rehypeStringify).processSync(content)

  return {
    markup: String(file),
    headings,
  }
}
