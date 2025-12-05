import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

function isRelativeLink(link: string) {
  return (
    !link.startsWith(`/`) &&
    !link.startsWith('http://') &&
    !link.startsWith('https://') &&
    !link.startsWith('//') &&
    !link.startsWith('#') &&
    !link.startsWith('mailto:')
  )
}

export function MarkdownLink({
  href: hrefProp,
  ...rest
}: HTMLProps<HTMLAnchorElement>) {
  if (!isRelativeLink(hrefProp ?? '')) {
    return <a {...rest} href={hrefProp} />
  }

  const [hrefWithoutHash, hash] = hrefProp?.split('#') ?? []
  let hrefWithoutMd = hrefWithoutHash.replace('.md', '')

  // Force relative links to resolve one level higher
  if (hrefWithoutMd.startsWith('../')) {
    hrefWithoutMd = hrefWithoutMd.replace(/^\.\.\//gm, '../../')
  } else if (hrefWithoutMd.startsWith('./')) {
    hrefWithoutMd = hrefWithoutMd.replace(/^\.\//gm, '../')
  }

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
