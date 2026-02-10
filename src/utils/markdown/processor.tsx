import * as React from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeCallouts from 'rehype-callouts'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import rehypeReact from 'rehype-react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeShiki from '@shikijs/rehype'
import { transformerNotationDiff } from '@shikijs/transformers'
import type { RehypeShikiOptions } from '@shikijs/rehype'
import { createHighlighter, type Highlighter } from 'shiki'

import {
  rehypeCollectHeadings,
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
  rehypeTransformFrameworkComponents,
  type MarkdownHeading,
} from '~/utils/markdown/plugins'
import { extractCodeMeta } from '~/utils/markdown/plugins/extractCodeMeta'

// Import markdown components for JSX rendering
import { MarkdownLink } from '~/components/markdown/MarkdownLink'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { InlineCode, MarkdownImg } from '~/ui'
import {
  MdCommentComponent,
  MdTabPanel,
  MdFrameworkPanel,
} from '~/components/markdown/MdComponents'

export type { MarkdownHeading } from '~/utils/markdown/plugins'

export type MarkdownRenderResult = {
  markup: string
  headings: MarkdownHeading[]
}

export type MarkdownJsxResult = {
  content: React.ReactNode
  headings: MarkdownHeading[]
}

// Language aliases to normalize common variations
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  console: 'bash',
  zsh: 'bash',
  cmd: 'bash',
  md: 'markdown',
  txt: 'text',
  text: 'text',
  plaintext: 'text',
  yml: 'yaml',
  json5: 'jsonc',
  eslintrc: 'jsonc',
}

const shikiOptions: RehypeShikiOptions = {
  themes: {
    light: 'github-light',
    dark: 'vitesse-dark',
  },
  defaultColor: false,
  cssVariablePrefix: '--shiki-',
  transformers: [transformerNotationDiff()],
  defaultLanguage: 'typescript',
  langs: [
    'typescript',
    'javascript',
    'tsx',
    'jsx',
    'bash',
    'json',
    'html',
    'css',
    'markdown',
    'toml',
    'yaml',
    'sql',
    'diff',
    'vue',
    'svelte',
    'scss',
    'jsonc',
    'vue-html',
    'angular-html',
    'angular-ts',
  ],
  langAlias: LANG_ALIASES,
  // Handle unknown languages gracefully
  onError: (error) => {
    console.warn('Shiki highlighting error:', error)
  },
}

export async function renderMarkdownAsync(
  content: string,
): Promise<MarkdownRenderResult> {
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
    .use(rehypeShiki, shikiOptions)
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

  const file = await processor.process(content)

  return {
    markup: String(file),
    headings,
  }
}

// Synchronous version for backwards compatibility (doesn't include syntax highlighting)
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

// Lazy-loaded highlighter singleton for standalone code highlighting
let highlighterPromise: Promise<Highlighter> | null = null

const SUPPORTED_LANGS = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'bash',
  'json',
  'html',
  'css',
  'markdown',
  'toml',
  'yaml',
  'sql',
  'diff',
  'vue',
  'svelte',
  'scss',
  'jsonc',
  'vue-html',
  'angular-html',
  'angular-ts',
  'text',
] as const

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'vitesse-dark'],
      langs: [...SUPPORTED_LANGS],
    })
  }
  return highlighterPromise
}

/**
 * Highlight code with Shiki (server-side only).
 * Returns HTML string with dual-theme CSS variables for light/dark mode.
 */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  const highlighter = await getHighlighter()

  // Normalize language alias
  const normalizedLang = LANG_ALIASES[lang] || lang

  // Check if language is supported, fallback to text
  const loadedLangs = highlighter.getLoadedLanguages()
  const effectiveLang = loadedLangs.includes(normalizedLang as any)
    ? normalizedLang
    : 'text'

  const html = highlighter.codeToHtml(code.trimEnd(), {
    lang: effectiveLang,
    themes: {
      light: 'github-light',
      dark: 'vitesse-dark',
    },
    defaultColor: false,
    cssVariablePrefix: '--shiki-',
    transformers: [transformerNotationDiff()],
  })

  return html
}

// Custom heading component - rehype-autolink-headings already wraps with <a>,
// so we just render the heading element with proper styling
function createHeadingComponent(
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
) {
  const HeadingComponent = ({
    id,
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
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

// Iframe component for markdown
function MarkdownIframe(props: React.IframeHTMLAttributes<HTMLIFrameElement>) {
  return <iframe {...props} className="w-full" title="Embedded Content" />
}

// Wrapper for code elements - only style inline code, pass through code blocks
function CodeElement({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  // If this code element is inside a pre (code block), it will have no special styling
  // Shiki adds no className to the inner <code>, so we detect code blocks by checking
  // if children are complex (contain React elements, not just text)
  const childArray = React.Children.toArray(children)
  const hasComplexChildren = childArray.some((child) =>
    React.isValidElement(child),
  )

  // Code blocks (inside <pre>) have span children from Shiki
  // Inline code has only text children
  if (hasComplexChildren) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  // Inline code - apply InlineCode styling
  return (
    <InlineCode className={className} {...props}>
      {children}
    </InlineCode>
  )
}

// Wrapper for anchor elements - pass through anchor-heading links, apply MarkdownLink to others
function LinkElement(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  // If this is an anchor-heading link (from rehype-autolink-headings), render as plain <a>
  // to avoid nested anchors when the heading content also has links
  if (props.className?.includes('anchor-heading')) {
    return <a {...props} />
  }
  // For all other links, use MarkdownLink which handles relative links
  return <MarkdownLink {...props} />
}

// Component mapping for rehype-react
const markdownComponents = {
  a: LinkElement,
  pre: CodeBlock,
  h1: createHeadingComponent('h1'),
  h2: createHeadingComponent('h2'),
  h3: createHeadingComponent('h3'),
  h4: createHeadingComponent('h4'),
  h5: createHeadingComponent('h5'),
  h6: createHeadingComponent('h6'),
  code: CodeElement,
  iframe: MarkdownIframe,
  img: MarkdownImg,
  // Custom markdown components
  'md-comment-component': MdCommentComponent,
  'md-tab-panel': MdTabPanel,
  'md-framework-panel': MdFrameworkPanel,
}

/**
 * Render markdown directly to JSX elements (for RSC).
 * This avoids the HTML string → parse step on the client.
 */
export async function renderMarkdownToJsx(
  content: string,
): Promise<MarkdownJsxResult> {
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
    .use(rehypeShiki, shikiOptions)
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
      components: markdownComponents,
    } as any)

  const file = await processor.process(content)

  return {
    content: file.result as React.ReactNode,
    headings,
  }
}
