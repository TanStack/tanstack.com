import { Link } from '@remix-run/react'
import type { HTMLProps } from 'react'

export function MarkdownLink(props: HTMLProps<HTMLAnchorElement>) {
  if ((props as { href: string }).href?.startsWith('http')) {
    return <a {...props} />
  }

  return <Link to={props.href!} {...props} ref={null} prefetch="intent" />
}
