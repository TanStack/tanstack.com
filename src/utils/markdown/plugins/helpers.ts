import { isElement } from 'hast-util-is-element'

type HastElement = {
  type: string
  tagName: string
  properties?: Record<string, unknown>
  children?: unknown[]
}

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

export const isHeading = (node: unknown): node is HastElement =>
  isElement(node as any) && /^h[1-6]$/.test((node as HastElement).tagName)

export const headingLevel = (node: HastElement) =>
  Number(node.tagName.substring(1))
