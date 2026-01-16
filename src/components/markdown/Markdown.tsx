import type { HTMLProps } from 'react'
import * as React from 'react'
import { MarkdownLink } from './MarkdownLink'

import parse, {
  attributesToProps,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser'

import { renderMarkdown } from '~/utils/markdown'
import { CodeBlock } from './CodeBlock'
import { handleTabsComponent } from './MarkdownTabsHandler'
import { handleFrameworkComponent } from './MarkdownFrameworkHandler'
import { InlineCode, MarkdownImg } from '~/ui'

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

const CustomHeading = ({
  Comp,
  id,
  children,
  ...props
}: HTMLProps<HTMLHeadingElement> & {
  Comp: HeadingLevel
}) => {
  // Convert children to array and strip any inner anchor (native 'a' or MarkdownLink)
  const childrenArray = React.Children.toArray(children)
  const sanitizedChildren = childrenArray.map((child) => {
    if (
      React.isValidElement(child) &&
      (child.type === 'a' || child.type === MarkdownLink)
    ) {
      // replace anchor child with its own children so outer anchor remains the only link
      return (child.props as { children?: React.ReactNode }).children ?? null
    }
    return child
  })

  const heading = (
    <Comp id={id} {...props}>
      {sanitizedChildren}
    </Comp>
  )

  if (id) {
    return (
      <a
        href={`#${id}`}
        className={`anchor-heading *:scroll-my-20 *:lg:scroll-my-4`}
      >
        {heading}
      </a>
    )
  }

  return heading
}

const makeHeading =
  (type: HeadingLevel) => (props: HTMLProps<HTMLHeadingElement>) => (
    <CustomHeading
      Comp={type}
      {...props}
      className={`${props.className ?? ''} block`}
    />
  )

const MarkdownIframe = React.memo(function MarkdownIframe(
  props: HTMLProps<HTMLIFrameElement>,
) {
  return <iframe {...props} className="w-full" title="Embedded Content" />
})

const markdownComponents: Record<string, React.FC> = {
  a: MarkdownLink,
  pre: CodeBlock,
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
  code: InlineCode,
  iframe: MarkdownIframe,
  img: MarkdownImg,
}

const options: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (domNode instanceof Element && domNode.attribs) {
      if (domNode.name === 'md-comment-component') {
        const componentName = domNode.attribs['data-component']
        const rawAttributes = domNode.attribs['data-attributes']
        const attributes: Record<string, any> = {}
        try {
          Object.assign(attributes, JSON.parse(rawAttributes))
        } catch {
          // ignore JSON parse errors and fall back to empty props
        }

        switch (componentName?.toLowerCase()) {
          case 'tabs':
            return handleTabsComponent(domNode, attributes, options)
          case 'framework':
            return handleFrameworkComponent(domNode, attributes, options)
          default:
            return <div>{domToReact(domNode.children as any, options)}</div>
        }
      }

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

type MarkdownProps = {
  rawContent?: string
  htmlMarkup?: string
}

export const Markdown = React.memo(function Markdown({
  rawContent,
  htmlMarkup,
}: MarkdownProps) {
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
})
