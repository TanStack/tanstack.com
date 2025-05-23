import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink({ href, ...rest }: HTMLProps<HTMLAnchorElement>) {
  if (
    href?.startsWith('http') ||
    href?.startsWith('#') ||
    href?.startsWith('//')
  ) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a {...rest} href={href} />
  }

  const [hrefWithoutHash, hash] = href?.split('#') ?? []
  const [hrefWithoutMd] = hrefWithoutHash?.split('.md') ?? []

  return (
    <Link
      {...rest}
      unsafeRelative="path"
      to={hrefWithoutMd}
      hash={hash}
      preload={undefined}
      ref={undefined}
    />
  )
}
