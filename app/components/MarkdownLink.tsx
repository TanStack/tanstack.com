import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink(props: HTMLProps<HTMLAnchorElement>) {
  if ((props as { href: string }).href?.startsWith('http')) {
    return <a {...props} />
  }

  return (
    <Link
      to={props.href as any}
      params={{}}
      {...props}
      preload={undefined}
      ref={undefined}
    />
  )
}
