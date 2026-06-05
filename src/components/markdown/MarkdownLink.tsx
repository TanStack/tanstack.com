'use client'

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

function isStaticAssetLink(link: string) {
  const [pathname] = link.split(/[?#]/)
  return /\.[a-z0-9]+$/i.test(pathname) && !pathname.endsWith('.md')
}

function isRoutableInternalLink(link: string) {
  return (
    link.startsWith('/') &&
    !link.startsWith('//') &&
    link !== '/api' &&
    !link.startsWith('/api/') &&
    !isStaticAssetLink(link)
  )
}

export function MarkdownLink({
  href: hrefProp,
  ...rest
}: HTMLProps<HTMLAnchorElement>) {
  const href = hrefProp ?? ''

  if (isRoutableInternalLink(href)) {
    const [hrefWithoutHash, hash] = href.split('#')
    const hrefWithoutMd = hrefWithoutHash.replace('.md', '')

    return (
      <Link
        {...rest}
        to={hrefWithoutMd}
        hash={hash}
        preload={undefined}
        ref={undefined}
      />
    )
  }

  if (!isRelativeLink(href)) {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a {...rest} href={hrefProp} />
  }

  const [hrefWithoutHash, hash] = href.split('#')
  let hrefWithoutMd = hrefWithoutHash.replace('.md', '')

  // Force relative links to resolve one level higher
  if (hrefWithoutMd.startsWith('../')) {
    hrefWithoutMd = hrefWithoutMd.replace(/^\.\.\//gm, '../../')
  } else if (hrefWithoutMd.startsWith('./')) {
    hrefWithoutMd = hrefWithoutMd.replace(/^\.\//gm, '../')
  } else {
    hrefWithoutMd = `../${hrefWithoutMd}`
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
