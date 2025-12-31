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
import { getNetlifyImageUrl } from '~/utils/netlifyImage'
import { Tabs } from '~/components/Tabs'

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
      return (child.props as any).children ?? null
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

const markdownComponents: Record<string, React.FC> = {
  a: MarkdownLink,
  pre: CodeBlock,
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
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
  iframe: (props) => (
    <iframe {...props} className="w-full" title="Embedded Content" />
  ),
  img: ({
    alt,
    src,
    className,
    children: _,
    ...props
  }: HTMLProps<HTMLImageElement>) => (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      className={`max-w-full h-auto rounded-lg shadow-md ${className ?? ''}`}
      loading="lazy"
      decoding="async"
    />
  ),
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
          case 'tabs': {
            const tabs = attributes.tabs
            const id =
              attributes.id || `tabs-${Math.random().toString(36).slice(2, 9)}`
            const panelElements = domNode.children?.filter(
              (child): child is Element =>
                child instanceof Element && child.name === 'md-tab-panel',
            )

            const children = panelElements?.map((panel) =>
              domToReact(panel.children as any, options),
            )

            return <Tabs id={id} tabs={tabs} children={children as any} />
          }
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

export function Markdown({ rawContent, htmlMarkup }: MarkdownProps) {
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
