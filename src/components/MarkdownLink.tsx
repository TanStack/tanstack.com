import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink({
  href: hrefProp,
  ...rest
}: HTMLProps<HTMLAnchorElement>) {
  if (
    hrefProp?.startsWith('http') ||
    hrefProp?.startsWith('#') ||
    hrefProp?.startsWith('//')
  ) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a {...rest} href={hrefProp} />
  }

  const [hrefWithoutHash, hash] = hrefProp?.split('#') ?? []
  const [to] = hrefWithoutHash?.split('.md') ?? []

  return (
    <Link
      {...rest}
      unsafeRelative="path"
      to={to}
      hash={hash}
      preload={undefined}
      ref={undefined}
    />
  )
}
