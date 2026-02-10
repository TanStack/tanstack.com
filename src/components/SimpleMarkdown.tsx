'use client'

import * as React from 'react'
import { MarkdownLink } from '~/components/markdown/MarkdownLink'
import type { HTMLProps } from 'react'
import parse, {
  attributesToProps,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser'
import { InlineCode, MarkdownImg } from '~/ui'

/**
 * Lightweight markdown renderer for simple content like excerpts.
 * Does NOT include syntax highlighting (shiki) or diagram rendering (mermaid).
 * Expects pre-rendered HTML markup from the server.
 */

const markdownComponents: Record<string, React.FC<any>> = {
  a: MarkdownLink,
  code: InlineCode,
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
  img: MarkdownImg,
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
  htmlMarkup: string
}

export function SimpleMarkdown({ htmlMarkup }: SimpleMarkdownProps) {
  return React.useMemo(() => {
    if (!htmlMarkup) {
      return null
    }

    return parse(htmlMarkup, options)
  }, [htmlMarkup])
}
