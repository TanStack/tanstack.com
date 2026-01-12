import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeCallouts from 'rehype-callouts'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'

import {
  rehypeCollectHeadings,
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
  rehypeTransformFrameworkComponents,
  type MarkdownHeading,
} from '~/utils/markdown/plugins'
import { extractCodeMeta } from '~/utils/markdown/plugins/extractCodeMeta'

export type { MarkdownHeading } from '~/utils/markdown/plugins'

export type MarkdownRenderResult = {
  markup: string
  headings: MarkdownHeading[]
}

export function renderMarkdown(content: string): MarkdownRenderResult {
  const headings: MarkdownHeading[] = []

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(extractCodeMeta)
    .use(rehypeRaw)
    .use(rehypeParseCommentComponents)
    .use(rehypeCallouts, {
      theme: 'github',
      props: {
        containerProps: (_node: any, type: string) => ({
          className: `markdown-alert markdown-alert-${type}`,
        }),
        titleIconProps: () => ({
          className: 'octicon octicon-info mr-2',
        }),
        titleProps: () => ({
          className: 'markdown-alert-title',
        }),
        titleTextProps: () => ({
          className: 'markdown-alert-title',
        }),
        contentProps: () => ({
          className: 'markdown-alert-content',
        }),
      },
    } as any)
    .use(rehypeSlug)
    .use(rehypeTransformFrameworkComponents)
    .use(rehypeTransformCommentComponents)
    .use(rehypeAutolinkHeadings, {
      behavior: 'wrap',
      properties: {
        className: ['anchor-heading'],
      },
    })
    .use(() => rehypeCollectHeadings(headings))
    .use(rehypeStringify)

  const file = processor.processSync(content)

  return {
    markup: String(file),
    headings,
  }
}
