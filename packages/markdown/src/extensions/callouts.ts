import type { CalloutNode, MarkdownExtension } from '../types.js'

export function calloutsExtension(): MarkdownExtension {
  return {
    name: 'callouts',
    parseBlock: parseCalloutBlock,
  }
}

export function parseCalloutBlock(
  context: Parameters<NonNullable<MarkdownExtension['parseBlock']>>[0],
): CalloutNode | undefined {
  const first = context.lines[context.index] ?? ''
  const match = first.match(/^ {0,3}>\s*\[!([A-Za-z]+)\](?:\s+(.*))?$/)
  if (!match) return undefined

  const kind = match[1]!.toLowerCase()
  const title = match[2]?.trim() || titleCase(kind)
  const body: string[] = []
  let cursor = context.index + 1

  while (cursor < context.lines.length) {
    const line = context.lines[cursor] ?? ''
    if (/^\s*$/.test(line)) {
      body.push('')
      cursor++
      continue
    }

    const quoted = line.match(/^ {0,3}>\s?(.*)$/)
    if (!quoted) break
    body.push(quoted[1]!)
    cursor++
  }

  context.consume(cursor - context.index)
  return {
    type: 'callout',
    kind,
    title,
    children: context.parseBlocks(body.join('\n')),
  }
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase()
}
