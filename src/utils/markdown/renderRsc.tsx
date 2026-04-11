import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as React from 'react'
import { renderMarkdownToJsx } from './processor.rsc'

export async function renderMarkdownToRsc(content: string) {
  const { content: contentJsx, headings } = await renderMarkdownToJsx(content)
  const contentRsc = await renderServerComponent(
    React.createElement(React.Fragment, null, contentJsx),
  )

  return {
    contentRsc,
    headings,
  }
}
