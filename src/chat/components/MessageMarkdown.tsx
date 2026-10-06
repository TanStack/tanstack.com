import { memo, useRef, type ComponentPropsWithoutRef } from 'react'
import { Markdown } from '@tanstack/markdown/react'
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'
import { tokenize, renderTokens, renderNodesToHtml } from '@tanstack/highlight'
import { createThemeCss, type HighlightTheme } from '@tanstack/highlight/theme'
import { githubDarkTheme } from '@tanstack/highlight/themes/github-dark'
import { githubLightTheme } from '@tanstack/highlight/themes/github-light'
import { CopyButton } from './CopyButton'
import { webLinksExtension } from '../core/markdown-links'

const extensions = [streamingMarkdownExtension(), webLinksExtension]
const highlighter = (code: string, lang?: string) =>
  renderNodesToHtml(renderTokens(tokenize(code, { lang }).tokens))

function CopyablePre(props: ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  return (
    <div className="message-code-block">
      <div className="message-code-actions">
        <CopyButton
          label="Copy code"
          text={() => ref.current?.textContent ?? ''}
        />
      </div>
      <pre {...props} ref={ref} />
    </div>
  )
}
const components = { pre: CopyablePre }
const noImageComponents = {
  ...components,
  img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) =>
    typeof src === 'string' ? (
      <a href={src}>{alt || 'Image'}</a>
    ) : (
      <span>{alt}</span>
    ),
}
const httpsOnlyComponents = {
  ...noImageComponents,
  a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) =>
    href?.startsWith('https://') ? (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ alt }: ComponentPropsWithoutRef<'img'>) => <span>{alt}</span>,
}

export const codeThemeCss = createThemeCss({
  light: {
    ...githubLightTheme,
    background: `light-dark(${githubLightTheme.background}, ${githubDarkTheme.background})`,
    foreground: `light-dark(${githubLightTheme.foreground}, ${githubDarkTheme.foreground})`,
    tokens: Object.fromEntries(
      Object.entries(githubLightTheme.tokens).map(([key, value]) => [
        key,
        `light-dark(${value}, ${githubDarkTheme.tokens[key as keyof typeof githubDarkTheme.tokens]})`,
      ]),
    ) as HighlightTheme['tokens'],
  },
  lightSelector: '.conversation-layout',
  codeBlockSelector: '.conversation-layout pre',
})

export const MessageMarkdown = memo(function MessageMarkdown({
  children,
  allowImages = true,
  httpsLinksOnly = false,
}: {
  children: string
  allowImages?: boolean
  httpsLinksOnly?: boolean
}) {
  return (
    <Markdown
      allowHtml={false}
      extensions={extensions}
      highlighter={highlighter}
      components={
        httpsLinksOnly
          ? httpsOnlyComponents
          : allowImages
            ? components
            : noImageComponents
      }
    >
      {children}
    </Markdown>
  )
})

export const CodeBlock = memo(function CodeBlock({
  code,
  lang,
}: {
  code: string
  lang?: string
}) {
  // Only Highlight's escaped output is HTML, never the source text itself.
  return (
    <CopyablePre>
      <code dangerouslySetInnerHTML={{ __html: highlighter(code, lang) }} />
    </CopyablePre>
  )
})
