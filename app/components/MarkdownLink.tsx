import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink({ href, ...rest }: HTMLProps<HTMLAnchorElement>) {
  if (href?.startsWith('http')) {
    return <a {...rest} href={href} />
  }

  const relativeHref = href?.replace(/([A-Za-z][A-Za-z/_-]+).md/, '../$1')

  return (
    <Link
      to={relativeHref}
      params={{}}
      {...rest}
      preload={undefined}
      ref={undefined}
    />
  )
}
