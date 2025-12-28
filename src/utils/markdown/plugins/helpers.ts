import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import { isElement } from 'hast-util-is-element'
import type { Element } from 'hast-util-is-element/lib'

export const COMPONENT_PREFIX = '::'
export const START_PREFIX = '::start:'
export const END_PREFIX = '::end:'

const componentParser = unified().use(rehypeParse, { fragment: true })

export const normalizeComponentName = (name: string) => name.toLowerCase()

export function parseDescriptor(descriptor: string) {
  const tree = componentParser.parse(`<${descriptor} />`)
  const node = tree.children[0]
  if (!node || node.type !== 'element') {
    return null
  }

  const component = node.tagName
  const attributes: Record<string, string> = {}
  const properties = node.properties ?? {}
  for (const [key, value] of Object.entries(properties)) {
    if (Array.isArray(value)) {
      attributes[key] = value.join(' ')
    } else if (value != null) {
      attributes[key] = String(value)
    }
  }

  return { component, attributes }
}

export const isCommentNode = (value: unknown): value is { value: string } =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'type' in value &&
      value.type === 'comment',
  )

export const slugify = (value: string, fallback: string) => {
  if (!value) {
    return fallback
  }

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

export const isHeading = (node: unknown): node is Element =>
  isElement(node) && /^h[1-6]$/.test(node.tagName)

export const headingLevel = (node: Element) => Number(node.tagName.substring(1))
