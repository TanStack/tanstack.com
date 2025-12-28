import { isElement } from 'hast-util-is-element'
import type { Element } from 'hast-util-is-element/lib'
import type { Properties } from 'hast'

export const COMPONENT_PREFIX = '::'
export const START_PREFIX = '::start:'
export const END_PREFIX = '::end:'

export const normalizeComponentName = (name: string) => name.toLowerCase()

export function parseDescriptor(descriptor: string) {
  const match = descriptor.match(/^(?<component>[\w-]+)(?<rest>.*)$/)
  if (!match?.groups?.component) {
    return null
  }

  const component = normalizeComponentName(match.groups.component)
  const attributes: Record<string, string> = {}
  const rest = match.groups.rest ?? ''
  const attributePattern = /(\w[\w-]*)(?:="([^"]*)"|='([^']*)'|=([^\s]+))?/g

  let attributeMatch: RegExpExecArray | null
  while ((attributeMatch = attributePattern.exec(rest))) {
    const [, key, doubleQuoted, singleQuoted, bare] = attributeMatch
    const value = doubleQuoted ?? singleQuoted ?? bare ?? ''
    attributes[key] = value
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
