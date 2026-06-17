import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as React from 'react'
import {
  renderMarkdownToJsx,
  type MarkdownRenderOptions,
} from './processor.rsc'

export async function renderMarkdownToRsc(
  content: string,
  options?: MarkdownRenderOptions,
) {
  const { content: contentJsx, headings } = await renderMarkdownToJsx(
    content,
    options,
  )
  const contentRsc = await renderServerComponent(
    React.createElement(React.Fragment, null, contentJsx),
  )

  return {
    contentRsc,
    headings,
  }
}
