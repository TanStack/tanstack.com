import type { InlineNode } from './types.js'

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function normalizeInput(value: string): string {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => htmlEscapes[char]!)
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

export function isBlank(value: string): boolean {
  return /^\s*$/.test(value)
}

export function stripIndent(value: string, size: number): string {
  let index = 0
  while (index < value.length && index < size && value[index] === ' ') index++
  return value.slice(index)
}

export function plainText(nodes: InlineNode[]): string {
  let value = ''
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'inlineCode') value += node.value
    else if ('children' in node) value += plainText(node.children)
    else if (node.type === 'image') value += node.alt
  }
  return value
}

export function createSlugger() {
  const seen = new Map<string, number>()

  return (value: string) => {
    const base =
      value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&[a-z0-9#]+;/gi, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'section'

    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }
}

export function sanitizeUrl(value: string): string {
  const trimmed = Array.from(value.trim())
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code > 0x1f && code !== 0x7f && !/\s/.test(char)
    })
    .join('')
  if (!trimmed) return ''
  if (/^(#|\/|\.\/|\.\.\/)/.test(trimmed)) return trimmed
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return ''
  return trimmed
}

export function splitLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}
