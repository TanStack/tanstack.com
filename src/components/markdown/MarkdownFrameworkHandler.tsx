import * as React from 'react'
import { domToReact, Element } from 'html-react-parser'
import type { HTMLReactParserOptions } from 'html-react-parser'

// Helper to resolve different module shapes (named export vs default)
function resolveModuleDefault(mod: any, key: string): React.ComponentType<any> {
  if (!mod) return undefined as any
  if (mod[key] && typeof mod[key] === 'function') return mod[key]
  if (mod.default) {
    if (mod.default[key] && typeof mod.default[key] === 'function')
      return mod.default[key]
    if (typeof mod.default === 'function') return mod.default
  }
  if (typeof mod === 'function') return mod
  return (mod as any).default ?? (mod as any)
}

const FrameworkContent = React.lazy<React.ComponentType<any>>(() =>
  import('./FrameworkContent').then((mod) => ({
    default: resolveModuleDefault(mod, 'FrameworkContent'),
  })),
)

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
    const id =
      attributes.id || `framework-${Math.random().toString(36).slice(2, 9)}`

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
      <React.Suspense fallback={<div>Loading...</div>}>
        <FrameworkContent
          id={id}
          codeBlocksByFramework={codeBlocksByFramework}
          availableFrameworks={availableFrameworks}
          panelsByFramework={panelsByFramework}
        />
      </React.Suspense>
    )
  } catch {
    return null
  }
}
