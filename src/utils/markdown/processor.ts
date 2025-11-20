import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeCallouts from 'rehype-callouts'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'

import {
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
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

export function renderMarkdown(content): MarkdownRenderResult {
  const headings: MarkdownHeading[] = []

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeParseCommentComponents)
    .use(rehypeCallouts, {
      theme: 'github',
      props: {
        containerProps(node,type) {
          return {
            className: `markdown-alert markdown-alert-${type}`,
            children: node.children,
          }
        },
        titleIconProps() {
          return {
            className: 'octicon octicon-info mr-2'
          }
        },
        titleProps() {
          return {
            className: 'markdown-alert-title',
          }
        },
        titleTextProps() {
          return {
            className: 'markdown-alert-title',

          }
        },
        contentProps() {
          return {
            className: 'markdown-alert-content',
          }
        },
      }
    })
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

  const file = processor.use(rehypeStringify).processSync(content)

  return {
    markup: String(file),
    headings,
  }
}
