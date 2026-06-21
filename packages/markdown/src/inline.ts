import type { InlineNode, ParseOptions } from './types.js'
import { sanitizeUrl } from './utils.js'

export function parseInline(
  value: string,
  options: ParseOptions = {},
): InlineNode[] {
  const nodes = parseInlineRaw(value, options)
  let result = mergeText(nodes)

  for (const extension of options.extensions ?? []) {
    result = extension.transformInline?.(result, { options }) ?? result
  }

  return result
}

function parseInlineRaw(value: string, options: ParseOptions): InlineNode[] {
  const nodes: InlineNode[] = []
  let index = 0
  let text = ''

  const pushText = () => {
    if (text) {
      nodes.push({ type: 'text', value: text })
      text = ''
    }
  }

  while (index < value.length) {
    const char = value[index]!
    const next = value[index + 1]

    if (char === '\\') {
      if (next === '\n') {
        pushText()
        nodes.push({ type: 'break' })
        index += 2
        continue
      }

      if (next && /[\\`*_[\]{}()#+\-.!|~>]/.test(next)) {
        text += next
        index += 2
        continue
      }
    }

    if (char === '`') {
      const tickCount = countRun(value, index, '`')
      const close = findClosingRun(value, index + tickCount, '`', tickCount)
      if (close !== -1) {
        pushText()
        nodes.push({
          type: 'inlineCode',
          value: value
            .slice(index + tickCount, close)
            .replace(/\s+/g, ' ')
            .trim(),
        })
        index = close + tickCount
        continue
      }
    }

    if (char === '!' && next === '[') {
      const parsed = parseLinkish(value, index + 1)
      if (parsed) {
        pushText()
        nodes.push({
          type: 'image',
          src: sanitizeUrl(parsed.href),
          alt: textFromMarkdown(parsed.label),
          ...(parsed.title ? { title: parsed.title } : {}),
        })
        index = parsed.end
        continue
      }
    }

    if (char === '[') {
      const parsed = parseLinkish(value, index)
      if (parsed) {
        const href = sanitizeUrl(parsed.href)
        pushText()
        if (href) {
          nodes.push({
            type: 'link',
            href,
            ...(parsed.title ? { title: parsed.title } : {}),
            children: parseInlineRaw(parsed.label, options),
          })
        } else {
          nodes.push(...parseInlineRaw(parsed.label, options))
        }
        index = parsed.end
        continue
      }
    }

    if ((char === '*' && next === '*') || (char === '_' && next === '_')) {
      const close = findDelimiter(value, index + 2, char + char)
      if (close !== -1) {
        pushText()
        nodes.push({
          type: 'strong',
          children: parseInlineRaw(value.slice(index + 2, close), options),
        })
        index = close + 2
        continue
      }
      text += char + next
      index += 2
      continue
    }

    if (char === '~' && next === '~') {
      const close = findDelimiter(value, index + 2, '~~')
      if (close !== -1) {
        pushText()
        nodes.push({
          type: 'strike',
          children: parseInlineRaw(value.slice(index + 2, close), options),
        })
        index = close + 2
        continue
      }
      text += '~~'
      index += 2
      continue
    }

    if (char === '*' || char === '_') {
      const close = findDelimiter(value, index + 1, char)
      if (close !== -1 && !isIntrawordUnderscore(value, index, close, char)) {
        pushText()
        nodes.push({
          type: 'emphasis',
          children: parseInlineRaw(value.slice(index + 1, close), options),
        })
        index = close + 1
        continue
      }
    }

    if (char === '<' && options.allowHtml) {
      const element = parseInlineElement(value, index, options)
      if (element) {
        pushText()
        nodes.push(element.node)
        index = element.end
        continue
      }

      const close = value.indexOf('>', index + 1)
      if (close !== -1) {
        pushText()
        nodes.push({ type: 'inlineHtml', value: value.slice(index, close + 1) })
        index = close + 1
        continue
      }
    }

    text += char
    index++
  }

  pushText()
  return nodes
}

interface ParsedLink {
  label: string
  href: string
  title?: string
  end: number
}

function parseLinkish(value: string, open: number): ParsedLink | undefined {
  const closeBracket = findBalanced(value, open, '[', ']')
  if (closeBracket === -1 || value[closeBracket + 1] !== '(') return undefined

  const closeParen = findBalanced(value, closeBracket + 1, '(', ')')
  if (closeParen === -1) return undefined

  const label = value.slice(open + 1, closeBracket)
  const destination = value.slice(closeBracket + 2, closeParen).trim()
  const parsed = parseDestination(destination)
  if (!parsed.href) return undefined

  return {
    label,
    href: parsed.href,
    ...(parsed.title ? { title: parsed.title } : {}),
    end: closeParen + 1,
  }
}

function parseDestination(value: string): { href: string; title?: string } {
  const match = value.match(/^(\S+)(?:\s+["']([^"']*)["'])?$/)
  if (!match) return { href: value }
  return {
    href: match[1]!.replace(/^<|>$/g, ''),
    ...(match[2] ? { title: match[2] } : {}),
  }
}

function findBalanced(
  value: string,
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0
  for (let index = openIndex; index < value.length; index++) {
    if (value[index - 1] === '\\') continue
    if (value[index] === open) depth++
    if (value[index] === close) {
      depth--
      if (depth === 0) return index
    }
  }
  return -1
}

function countRun(value: string, index: number, char: string): number {
  let count = 0
  while (value[index + count] === char) count++
  return count
}

function findClosingRun(
  value: string,
  start: number,
  char: string,
  count: number,
): number {
  for (let index = start; index < value.length; index++) {
    if (value[index] !== char) continue
    if (countRun(value, index, char) >= count) return index
  }
  return -1
}

function findDelimiter(
  value: string,
  start: number,
  delimiter: string,
): number {
  for (let index = start; index < value.length; index++) {
    if (value[index - 1] === '\\') continue
    if (value.startsWith(delimiter, index)) return index
  }
  return -1
}

function isIntrawordUnderscore(
  value: string,
  open: number,
  close: number,
  delimiter: string,
): boolean {
  if (delimiter !== '_') return false
  return /\w/.test(value[open - 1] ?? '') && /\w/.test(value[close + 1] ?? '')
}

function textFromMarkdown(value: string): string {
  return parseInlineRaw(value, {})
    .map((node) =>
      node.type === 'text' || node.type === 'inlineCode'
        ? node.value
        : 'children' in node
          ? textFromMarkdownFromNodes(node.children)
          : node.type === 'image'
            ? node.alt
            : '',
    )
    .join('')
}

function textFromMarkdownFromNodes(nodes: InlineNode[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' || node.type === 'inlineCode'
        ? node.value
        : 'children' in node
          ? textFromMarkdownFromNodes(node.children)
          : node.type === 'image'
            ? node.alt
            : '',
    )
    .join('')
}

interface ParsedInlineElement {
  node: InlineNode
  end: number
}

const voidHtmlTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const inlineHtmlTags = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'ins',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
])

function parseInlineElement(
  value: string,
  index: number,
  options: ParseOptions,
): ParsedInlineElement | undefined {
  const opening = parseOpeningHtmlTag(value, index)
  if (!opening || !inlineHtmlTags.has(opening.tagName)) return undefined

  if (opening.void || voidHtmlTags.has(opening.tagName)) {
    return {
      node: {
        type: 'inlineElement',
        tagName: opening.tagName,
        attributes: opening.attributes,
        children: [],
        void: true,
      },
      end: opening.end,
    }
  }

  const closing = findClosingHtmlTag(value, opening.end, opening.tagName)
  if (!closing) return undefined

  return {
    node: {
      type: 'inlineElement',
      tagName: opening.tagName,
      attributes: opening.attributes,
      children: parseInlineRaw(
        value.slice(opening.end, closing.start),
        options,
      ),
      void: false,
    },
    end: closing.end,
  }
}

interface ParsedOpeningHtmlTag {
  tagName: string
  attributes: Record<string, string>
  end: number
  void: boolean
}

function parseOpeningHtmlTag(
  value: string,
  index: number,
): ParsedOpeningHtmlTag | undefined {
  const match = value
    .slice(index)
    .match(/^<([A-Za-z][\w:-]*)([^<>]*?)\s*(\/?)>/)

  if (!match) return undefined

  const tagName = match[1]!.toLowerCase()
  const rawAttributes = match[2] ?? ''
  const raw = match[0]!

  return {
    tagName,
    attributes: parseHtmlAttributes(rawAttributes),
    end: index + raw.length,
    void: Boolean(match[3]),
  }
}

interface ClosingHtmlTag {
  start: number
  end: number
}

function findClosingHtmlTag(
  value: string,
  start: number,
  tagName: string,
): ClosingHtmlTag | undefined {
  const pattern = new RegExp(
    `<\\s*/?\\s*${escapeRegex(tagName)}(?:\\s[^>]*)?>`,
    'gi',
  )
  pattern.lastIndex = start

  let depth = 1
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    const raw = match[0]!
    const isClosing = /^<\s*\//.test(raw)
    const isSelfClosing = /\/\s*>$/.test(raw)

    if (isClosing) {
      depth--
      if (depth === 0) {
        return {
          start: match.index,
          end: pattern.lastIndex,
        }
      }
      continue
    }

    if (!isSelfClosing && !voidHtmlTags.has(tagName)) depth++
  }

  return undefined
}

function parseHtmlAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const pattern =
    /([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  for (const match of value.matchAll(pattern)) {
    const name = match[1]!
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? ''
  }

  return attributes
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mergeText(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = []
  for (const node of nodes) {
    const previous = result.at(-1)
    if (previous?.type === 'text' && node.type === 'text') {
      previous.value += node.value
    } else {
      result.push(node)
    }
  }
  return result
}
