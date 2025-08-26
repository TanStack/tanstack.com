import { Link } from '@tanstack/react-router'
import type { HTMLProps } from 'react'
import { normalizeMarkdownPath } from '~/utils/normalize-markdown-path'

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
  let [to] = hrefWithoutHash?.split('.md') ?? []
  
  to = normalizeMarkdownPath(to)

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

// function resolveRelativePath(routerHref: string, markdownPath: string): string {
//   let hash = ''
//   let basePath = routerHref
//   let relativePath = markdownPath

//   // Check if the relative path starts with a hash
//   if (relativePath.startsWith('#')) {
//     // If the basePath already has a hash, remove it
//     const hashIndex = basePath.indexOf('#')
//     if (hashIndex !== -1) {
//       basePath = basePath.substring(0, hashIndex)
//     }

//     return basePath + relativePath
//   }

//   // Remove hash from path if it exists, we'll add it back later
//   if (hashIndex !== -1) {
//     hash = relativePath.substring(hashIndex)
//     relativePath = relativePath.substring(0, hashIndex)
//   }

//   // Remove .md extension if it exists
//   if (relativePath.endsWith('.md')) {
//     relativePath = relativePath.substring(0, relativePath.length - 3)
//   } else {
//     // If the path doesn't end with .md, return the path as is
//     return relativePath + hash
//   }

//   const stack = basePath.split('/').filter(Boolean)
//   const parts = relativePath.split('/')

//   let firstDoubleDotEncountered = false // Flag to track the first ".."

//   for (let i = 0; i < parts.length; i++) {
//     const part = parts[i]
//     if (part === '.') {
//       continue
//     }
//     if (part === '..') {
//       if (!firstDoubleDotEncountered) {
//         // First time encountering ".."
//         stack.pop() // First pop
//         stack.pop() // Second pop
//         firstDoubleDotEncountered = true // Set the flag
//       } else {
//         // Subsequent ".."
//         stack.pop()
//       }
//     } else {
//       stack.push(part)
//     }
//   }

//   let resolvedPath = '/' + stack.filter(Boolean).join('/')

//   // Add the hash back
//   resolvedPath += hash

//   return resolvedPath
// }
