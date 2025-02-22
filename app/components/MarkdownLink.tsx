import { Link, useLocation } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

export function MarkdownLink({ href, ...rest }: HTMLProps<HTMLAnchorElement>) {
  const pathname = useLocation({ select: (s) => s.pathname })

  if (href?.startsWith('http')) {
    return <a {...rest} href={href} />
  }

  // const relativeHref = href?.replace(/([A-Za-z][A-Za-z/_-]+).md/, '../$1')
  const relativeHref = resolveRelativePath(pathname + '/', href ?? '')

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

function resolveRelativePath(routerHref: string, markdownPath: string): string {
  let hash = ''
  let basePath = routerHref
  let relativePath = markdownPath

  // Check if starts with a hash
  if (relativePath.startsWith('#')) {
    // If the basePath already has a hash, remove it
    const hashIndex = basePath.indexOf('#')
    if (hashIndex !== -1) {
      basePath = basePath.substring(0, hashIndex)
    }

    return basePath + relativePath
  }

  // Add a leading "./" if the relative path doesn't start with "./" or "../"
  if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
    relativePath = './' + relativePath
  }

  // Check if there's a hash fragment in the relative path
  const hashIndex = relativePath.indexOf('#')

  // Remove hash from path if it exists, we'll add it back later
  if (hashIndex !== -1) {
    hash = relativePath.substring(hashIndex)
    relativePath = relativePath.substring(0, hashIndex)
  }

  // Remove .md extension if it exists
  if (relativePath.endsWith('.md')) {
    relativePath = relativePath.substring(0, relativePath.length - 3)
  } else {
    // If the path doesn't end with .md, return the path as is
    return relativePath + hash
  }

  const stack = basePath.split('/').filter(Boolean)
  const parts = relativePath.split('/')

  // Custom logic: If relativePath starts with './', always go up one level
  if (relativePath.startsWith('./')) {
    if (stack.length > 0) {
      stack.pop() // Always remove the last segment of the basePath
    }
  }

  // Remove the last element if it's a file, not a directory
  // if (stack.length > 0 && stack[stack.length - 1].indexOf('.') > -1) {
  //   stack.pop()
  // }

  let firstDoubleDotEncountered = false // Flag to track the first ".."

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '.') {
      continue
    }
    if (part === '..') {
      if (!firstDoubleDotEncountered) {
        // First time encountering ".."
        stack.pop() // First pop
        stack.pop() // Second pop
        firstDoubleDotEncountered = true // Set the flag
      } else {
        // Subsequent ".."
        stack.pop()
      }
    } else {
      stack.push(part)
    }
  }

  let resolvedPath = '/' + stack.filter(Boolean).join('/')

  // Add the hash back
  resolvedPath += hash

  return resolvedPath
}
