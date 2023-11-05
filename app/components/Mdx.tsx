import * as React from 'react'
import { getMDXComponent } from 'mdx-bundler/client'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { MDXComponents } from 'mdx/types'

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
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
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
