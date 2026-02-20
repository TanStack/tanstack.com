import * as React from 'react'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { renderMarkdownToJsx } from './processor'

/**
 * Render markdown content to RSC payload.
 * Optionally wrap the content in a container component.
 */
export async function renderMarkdownRsc(
  content: string,
  options?: {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>
    wrapperProps?: Record<string, unknown>
    className?: string
  },
) {
  if (!content) {
    return { contentRsc: null, headings: [] }
  }

  const { content: jsxContent, headings } = await renderMarkdownToJsx(content)

  let element: React.ReactNode = jsxContent

  // Apply className wrapper if provided
  if (options?.className) {
    element = <div className={options.className}>{element}</div>
  }

  // Apply custom wrapper component if provided
  if (options?.wrapper) {
    const Wrapper = options.wrapper
    element = <Wrapper {...options?.wrapperProps}>{element}</Wrapper>
  }

  const contentRsc = await renderServerComponent(<>{element}</>)

  return { contentRsc, headings }
}
