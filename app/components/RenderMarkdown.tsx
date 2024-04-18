import { useMemo } from 'react'
import { getMDXComponent } from 'mdx-bundler/client'
import { CodeBlock } from '~/components/CodeBlock'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { HTMLProps } from 'react'

const CustomHeading = ({
  Comp,
  id,
  ...props
}: HTMLProps<HTMLHeadingElement> & {
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
  (props: HTMLProps<HTMLHeadingElement>) =>
    (
      <CustomHeading
        Comp={type}
        {...props}
        className={`${props.className ?? ''} inline-block`}
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
  code: (props: HTMLProps<HTMLElement>) => {
    const { className, children } = props
    if (typeof children === 'string') {
      // For inline code, this adds a background and outline
      return (
        <code
          {...props}
          className={`border border-gray-500 border-opacity-20 bg-gray-500 bg-opacity-10 rounded p-1${
            className ?? ` ${className}`
          }`}
        />
      )
    } else {
      // For Shiki code blocks, this does nothing
      return <code {...props} />
    }
  },
  iframe: (props) => (
    <iframe {...props} className="w-full" title="Embedded Content" />
  ),
}

export function Mdx({
  code,
  components,
}: {
  code: string
  components?: Record<string, React.FC>
}) {
  const Doc = useMemo(() => getMDXComponent(code), [code])

  return <Doc components={{ ...markdownComponents, ...components }} />
}
