import * as React from 'react'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { HTMLProps } from 'react'
import parse, {
  attributesToProps,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser'
import { renderMarkdown } from '~/utils/markdown'

/**
 * Lightweight markdown renderer for simple content like excerpts.
 * Does NOT include syntax highlighting (shiki) or diagram rendering (mermaid).
 * Use the full <Markdown> component for documentation with code blocks.
 */

const markdownComponents: Record<string, React.FC<any>> = {
  a: MarkdownLink,
  code: function Code({ className, ...rest }: HTMLProps<HTMLElement>) {
    return (
      <span
        className={`border border-gray-500/20 bg-gray-500/10 rounded px-1 py-0.5${
          className ? ` ${className}` : ''
        }`}
        {...rest}
      />
    )
  },
  pre: function Pre({ children, ...rest }: HTMLProps<HTMLPreElement>) {
    return (
      <pre
        className="bg-gray-100 dark:bg-gray-800 rounded p-2 overflow-x-auto text-sm"
        {...rest}
      >
        {children}
      </pre>
    )
  },
  img: ({ children, alt, src, ...props }: HTMLProps<HTMLImageElement>) => {
    // Use Netlify Image CDN for local images
    const optimizedSrc =
      src &&
      !src.startsWith('http') &&
      !src.startsWith('data:') &&
      !src.endsWith('.svg')
        ? `/.netlify/images?url=${encodeURIComponent(src)}&w=800&q=80`
        : src

    return (
      <img
        {...props}
        src={optimizedSrc}
        alt={alt ?? ''}
        className={`max-w-full h-auto rounded-lg shadow-md ${props.className ?? ''}`}
        loading="lazy"
        decoding="async"
      />
    )
  },
}

const options: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (domNode instanceof Element && domNode.attribs) {
      const replacer = markdownComponents[domNode.name]
      if (replacer) {
        return React.createElement(
          replacer,
          attributesToProps(domNode.attribs),
          domToReact(domNode.children as any, options),
        )
      }
    }
    return
  },
}

type SimpleMarkdownProps = {
  rawContent?: string
  htmlMarkup?: string
}

export function SimpleMarkdown({ rawContent, htmlMarkup }: SimpleMarkdownProps) {
  const rendered = React.useMemo(() => {
    if (rawContent) {
      return renderMarkdown(rawContent)
    }

    if (htmlMarkup) {
      return { markup: htmlMarkup, headings: [] }
    }

    return { markup: '', headings: [] }
  }, [rawContent, htmlMarkup])

  return React.useMemo(() => {
    if (!rendered.markup) {
      return null
    }

    return parse(rendered.markup, options)
  }, [rendered.markup])
}
