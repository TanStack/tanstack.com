import * as React from 'react'
import { domToReact, Element } from 'html-react-parser'
import type { HTMLReactParserOptions } from 'html-react-parser'
import { FrameworkContent } from './FrameworkContent'

export function handleFrameworkComponent(
  domNode: Element,
  attributes: Record<string, any>,
  options: HTMLReactParserOptions,
) {
  const frameworkMeta = domNode.attribs['data-framework-meta']
  if (!frameworkMeta) {
    return null
  }

  try {
    const { codeBlocksByFramework } = JSON.parse(frameworkMeta)
    const availableFrameworks = JSON.parse(
      domNode.attribs['data-available-frameworks'] || '[]',
    )

    const panelElements = domNode.children?.filter(
      (child): child is Element =>
        child instanceof Element && child.name === 'md-framework-panel',
    )

    // Build panelsByFramework map
    const panelsByFramework: Record<string, React.ReactNode> = {}
    panelElements?.forEach((panel) => {
      const fw = panel.attribs['data-framework']
      if (fw) {
        panelsByFramework[fw] = domToReact(panel.children as any, options)
      }
    })

    return (
      <FrameworkContent
        codeBlocksByFramework={codeBlocksByFramework}
        availableFrameworks={availableFrameworks}
        panelsByFramework={panelsByFramework}
      />
    )
  } catch {
    return null
  }
}
