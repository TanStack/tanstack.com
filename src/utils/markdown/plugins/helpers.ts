import { isElement } from 'hast-util-is-element'
import type { Element } from 'hast-util-is-element/lib'

export const normalizeComponentName = (name: string) => name.toLowerCase()

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