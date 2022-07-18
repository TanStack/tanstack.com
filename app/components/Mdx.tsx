import { MDXComponents } from 'mdx/types'
import { getMDXComponent } from 'mdx-bundler/client'
import * as React from 'react'
import { CodeBlock } from './CodeBlock'
import { MarkdownLink } from './MarkdownLink'

const CustomHeading = ({
  Comp,
  id,
  ...props
}: React.HTMLProps<HTMLHeadingElement> & {
  Comp: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}) => {
  if (id) {
    return (
      <a href={`#${id}`} className={`anchor-heading`}>
        <Comp id={id} {...props} />
      </a>
    )
  }
  return <Comp {...props} />
}

const makeHeading =
  (type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  (props: React.HTMLProps<HTMLHeadingElement>) =>
    (
      <CustomHeading
        Comp={type}
        {...props}
        className={`${props.className ?? ''} inline-block`}
      />
    )

const markdownComponents = {
  a: MarkdownLink,
  pre: CodeBlock,
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
  code: (props: React.HTMLProps<HTMLElement>) => {
    return (
      <code
        {...props}
        className={`border border-gray-500 border-opacity-20 bg-gray-500 bg-opacity-10 rounded p-1 ${props.className}`}
      />
    )
  },
}

export function Mdx({
  code,
  components,
}: {
  code: string
  components?: MDXComponents
}) {
  const Doc = React.useMemo(() => getMDXComponent(code), [code])

  return <Doc components={{ ...markdownComponents, ...components }} />
}
