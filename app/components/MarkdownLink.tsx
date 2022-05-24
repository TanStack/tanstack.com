import { HTMLProps } from 'react'
import { Link } from 'remix'

export function MarkdownLink(props: HTMLProps<HTMLAnchorElement>) {
  if ((props as { href: string }).href?.startsWith('http')) {
    return <a {...props} />
  }

  return <Link to={props.href!} {...props} ref={null} />
}
