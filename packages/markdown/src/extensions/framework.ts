import type { BlockNode, ComponentNode } from '../types.js'
import { markFrameworkHeadings, splitByHeading } from './shared.js'

export function transformFrameworkComponent(
  node: ComponentNode,
): ComponentNode {
  const sections = splitByHeading(node.children, 1)
  if (!sections.length) return node

  const frameworks = sections.map((section) => section.name.toLowerCase())
  const panels = sections.map((section): ComponentNode => {
    const framework = section.name.toLowerCase()
    return {
      type: 'component',
      name: 'framework-panel',
      tagName: 'md-framework-panel',
      attributes: {},
      properties: {
        'data-framework': framework,
      },
      children: markFrameworkHeadings(section.children, framework),
    }
  })

  return {
    ...node,
    properties: {
      ...(node.properties ?? {}),
      'data-available-frameworks': JSON.stringify(frameworks),
      'data-framework-meta': JSON.stringify({
        codeBlocksByFramework: Object.fromEntries(
          sections.map((section) => [
            section.name.toLowerCase(),
            section.children
              .filter(
                (child): child is Extract<BlockNode, { type: 'code' }> =>
                  child.type === 'code',
              )
              .map((child) => ({
                title: child.title ?? '',
                code: child.value,
                language: child.lang ?? 'plaintext',
              })),
          ]),
        ),
      }),
    },
    children: panels,
  }
}
