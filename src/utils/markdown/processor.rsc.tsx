import * as React from 'react'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeCallouts from 'rehype-callouts'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import rehypeSlug from 'rehype-slug'
import * as jsxRuntime from 'react/jsx-runtime'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { CodeBlock } from '~/components/markdown/CodeBlock.server'
import {
  MdCommentComponent,
  MdFrameworkPanel,
  MdTabPanel,
} from '~/components/markdown/MdComponents'
import { MarkdownLink } from '~/components/markdown/MarkdownLink'
import { InlineCode, MarkdownImg } from '~/ui'
import { extractCodeMeta } from '~/utils/markdown/plugins/extractCodeMeta'
import {
  rehypeCollectHeadings,
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
  rehypeTransformFrameworkComponents,
  type MarkdownHeading,
} from '~/utils/markdown/plugins'

export type { MarkdownHeading } from '~/utils/markdown/plugins'

export type MarkdownJsxResult = {
  content: React.ReactNode
  headings: MarkdownHeading[]
}

export type MarkdownRenderOptions = {
  preserveTabPanels?: boolean
}

function createHeadingComponent(
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
) {
  function HeadingComponent({
    children,
    className,
    id,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) {
    const Tag = level

    return (
      <Tag
        id={id}
        className={`${className ?? ''} block scroll-my-20 lg:scroll-my-4`}
        {...props}
      >
        {children}
      </Tag>
    )
  }

  HeadingComponent.displayName = `Heading${level.toUpperCase()}`

  return HeadingComponent
}

function MarkdownIframe(props: React.IframeHTMLAttributes<HTMLIFrameElement>) {
  return <iframe {...props} className="w-full" title="Embedded Content" />
}

function CodeElement({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  if (className?.includes('language-')) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return (
    <InlineCode className={className} {...props}>
      {children}
    </InlineCode>
  )
}

function LinkElement(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (props.className?.includes('anchor-heading')) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a {...props} />
  }

  return <MarkdownLink {...props} />
}

function createMarkdownComponents(options: MarkdownRenderOptions = {}) {
  function MdCommentComponentWithOptions(
    props: React.ComponentProps<typeof MdCommentComponent>,
  ) {
    return (
      <MdCommentComponent
        {...props}
        preserveTabPanels={options.preserveTabPanels}
      />
    )
  }

  return {
    a: LinkElement,
    code: CodeElement,
    h1: createHeadingComponent('h1'),
    h2: createHeadingComponent('h2'),
    h3: createHeadingComponent('h3'),
    h4: createHeadingComponent('h4'),
    h5: createHeadingComponent('h5'),
    h6: createHeadingComponent('h6'),
    iframe: MarkdownIframe,
    img: MarkdownImg,
    'md-comment-component': MdCommentComponentWithOptions,
    'md-framework-panel': MdFrameworkPanel,
    'md-tab-panel': MdTabPanel,
    pre: CodeBlock,
  }
}

export async function renderMarkdownToJsx(
  content: string,
  options?: MarkdownRenderOptions,
): Promise<MarkdownJsxResult> {
  const headings: Array<MarkdownHeading> = []

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(extractCodeMeta)
    .use(rehypeRaw)
    .use(rehypeParseCommentComponents)
    .use(rehypeCallouts, {
      theme: 'github',
      props: {
        containerProps: (_node: unknown, type: string) => ({
          className: `markdown-alert markdown-alert-${type}`,
        }),
        contentProps: () => ({
          className: 'markdown-alert-content',
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
    .use(rehypeReact, {
      Fragment: jsxRuntime.Fragment,
      jsx: jsxRuntime.jsx,
      jsxs: jsxRuntime.jsxs,
      components: createMarkdownComponents(options),
    } as any)
    .process(content)

  return {
    content: file.result as React.ReactNode,
    headings,
  }
}
