import type { ComponentNode, MarkdownExtension } from '../types.js'

export interface CommentComponentOptions {
  transformComponent?: (node: ComponentNode) => ComponentNode
}

export interface ComponentComment {
  block: boolean
  name: string
  attributes: Record<string, string>
}

export function commentComponentsExtension(
  options: CommentComponentOptions = {},
): MarkdownExtension {
  return {
    name: 'comment-components',
    parseBlock: (context) => parseCommentComponentBlock(context, options),
  }
}

export function parseCommentComponentBlock(
  context: Parameters<NonNullable<MarkdownExtension['parseBlock']>>[0],
  options: CommentComponentOptions = {},
): ComponentNode | undefined {
  const line = context.lines[context.index] ?? ''
  const start = parseComponentComment(line)
  if (!start) return undefined

  if (!start.block) {
    context.consume(1)
    return transform(
      {
        type: 'component',
        name: start.name,
        attributes: start.attributes,
        children: [],
      },
      options,
    )
  }

  const body: string[] = []
  let cursor = context.index + 1
  let foundEnd = false

  while (cursor < context.lines.length) {
    const candidate = context.lines[cursor] ?? ''
    if (isEndComment(candidate, start.name)) {
      foundEnd = true
      cursor++
      break
    }
    body.push(candidate)
    cursor++
  }

  context.consume(foundEnd ? cursor - context.index : 1)
  return transform(
    {
      type: 'component',
      name: start.name,
      attributes: start.attributes,
      children: foundEnd ? context.parseBlocks(body.join('\n')) : [],
    },
    options,
  )
}

export function parseComponentComment(
  line: string,
): ComponentComment | undefined {
  const match = line.match(
    /^ {0,3}<!--\s*::(start:)?([A-Za-z][\w-]*)(.*?)\s*-->\s*$/,
  )
  if (!match) return undefined
  return {
    block: Boolean(match[1]),
    name: match[2]!.toLowerCase(),
    attributes: parseAttributes(match[3] ?? ''),
  }
}

export function parseAttributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([A-Za-z_][\w:-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g
  for (const match of value.matchAll(regex)) {
    attrs[match[1]!] = match[2] ?? match[3] ?? match[4] ?? 'true'
  }
  return attrs
}

function transform(node: ComponentNode, options: CommentComponentOptions) {
  return options.transformComponent?.(node) ?? node
}

function isEndComment(line: string, name: string): boolean {
  return new RegExp(
    `^ {0,3}<!--\\s*::end:${escapeRegex(name)}\\s*-->\\s*$`,
    'i',
  ).test(line)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
