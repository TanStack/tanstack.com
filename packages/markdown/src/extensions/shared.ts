import type { BlockNode, ComponentNode, HeadingNode } from '../types.js'
import { plainText } from '../utils.js'

export interface HeadingSection {
  id?: string
  name: string
  children: BlockNode[]
}

export function blocksToText(blocks: BlockNode[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          return plainText(block.children)
        case 'code':
          return block.value
        case 'list':
          return block.items
            .map((item) => blocksToText(item.children))
            .join('\n')
        case 'blockquote':
        case 'callout':
        case 'component':
          return blocksToText(block.children)
        case 'table':
          return [block.header, ...block.rows]
            .map((row) => row.map((cell) => plainText(cell.children)).join(' '))
            .join('\n')
        default:
          return ''
      }
    })
    .join('\n')
}

export function splitByHeading(
  children: BlockNode[],
  forcedDepth?: number,
): HeadingSection[] {
  const headings = children.filter(
    (child): child is HeadingNode => child.type === 'heading',
  )
  const depth =
    forcedDepth ?? Math.min(...headings.map((heading) => heading.depth))
  if (!Number.isFinite(depth)) return []

  const sections: HeadingSection[] = []
  let current: HeadingSection | undefined

  for (const child of children) {
    if (child.type === 'heading' && child.depth === depth) {
      current = {
        name: plainText(child.children),
        children: [],
      }
      if (child.id) current.id = child.id
      sections.push(current)
      continue
    }
    if (current) current.children.push(child)
  }

  return sections
}

export function slugify(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || fallback
  )
}

export function markFrameworkHeadings(
  blocks: BlockNode[],
  framework: string,
): BlockNode[] {
  return blocks.map((block) => {
    if (block.type === 'heading' && block.depth > 1) {
      return {
        ...block,
        framework,
      }
    }

    if (block.type === 'blockquote' || block.type === 'callout') {
      return {
        ...block,
        children: markFrameworkHeadings(block.children, framework),
      }
    }

    if (block.type === 'list') {
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: markFrameworkHeadings(item.children, framework),
        })),
      }
    }

    if (block.type === 'component') {
      return {
        ...block,
        children: markFrameworkHeadings(block.children, framework),
      }
    }

    return block
  })
}

export function getComponentName(node: ComponentNode) {
  return node.name.toLowerCase()
}
