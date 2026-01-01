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
  rehypeCollectHeadings,
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
} from '~/utils/markdown/plugins'

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
        containerProps(node, type) {
          return {
            className: `markdown-alert markdown-alert-${type}`,
            children: node.children,
          }
        },
        titleIconProps() {
          return {
            className: 'octicon octicon-info mr-2',
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
      },
    })
    .use(rehypeSlug)
    .use(rehypeTransformCommentComponents)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: {
        className: ['anchor-heading'],
      },
    })
    .use((tree, file) => rehypeCollectHeadings(tree, file, headings))

  const file = processor.use(rehypeStringify).processSync(content)

  return {
    markup: String(file),
    headings,
  }
}
