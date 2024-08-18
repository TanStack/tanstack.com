import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink(props: HTMLProps<HTMLAnchorElement>) {
  if (props.href?.startsWith('http')) {
    return <a {...props} />
  }

  const relativeHref = props.href?.replace(/([A-Za-z][A-Za-z/_-]+).md/, '../$1')

  return (
    <Link
      to={relativeHref}
      params={{}}
      {...props}
      preload={undefined}
      ref={undefined}
    />
  )
}
