import { Link, useLocation } from '@tanstack/react-router'
import type { HTMLProps } from 'react'

function resolveRelativePath(routerHref: string, relativePath: string): string {
  let hash = ''
  let basePath = routerHref

  // Check if there's a hash fragment in the relative path
  const hashIndex = relativePath.indexOf('#')
  if (hashIndex !== -1) {
    hash = relativePath.substring(hashIndex)
    relativePath = relativePath.substring(0, hashIndex) // Remove hash from path
  }

  // Remove .md extension if it exists
  if (relativePath.endsWith('.md')) {
    relativePath = relativePath.substring(0, relativePath.length - 3)
  }

  // Check if the last segment is "index" and remove it
  const stackBeforeIndexCheck = basePath.split('/').filter(Boolean)
  if (
    stackBeforeIndexCheck.length > 0 &&
    stackBeforeIndexCheck[stackBeforeIndexCheck.length - 1] === 'index'
  ) {
    if (basePath.endsWith('/')) {
      basePath = basePath.substring(0, basePath.length - 1)
    }
    basePath = basePath.substring(0, basePath.length - 'index'.length)
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

export function MarkdownLink({ href, ...rest }: HTMLProps<HTMLAnchorElement>) {
  const pathname = useLocation({ select: (s) => s.href })
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
