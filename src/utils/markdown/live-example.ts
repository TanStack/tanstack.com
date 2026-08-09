import { parseAttributes } from '@tanstack/markdown/extensions/comment-components'
import type {
  BlockNode,
  CodeBlockNode,
  ComponentNode,
  MarkdownExtension,
} from '@tanstack/markdown'
import {
  createExampleWorkspace,
  isCanonicalExamplePath,
  serializeExampleWorkspace,
} from '~/utils/example-workspace'

export function liveExamplesExtension(): MarkdownExtension {
  return {
    name: 'live-examples',
    transformDocument(document) {
      return {
        ...document,
        children: transformBlocks(document.children),
      }
    },
  }
}

function transformBlocks(blocks: Array<BlockNode>): Array<BlockNode> {
  const nested = blocks.map(transformNestedBlocks)
  const transformed: Array<BlockNode> = []
  let index = 0

  while (index < nested.length) {
    const first = readLiveCode(nested[index])
    if (!first) {
      transformed.push(nested[index])
      index += 1
      continue
    }

    const group = [first]
    let cursor = index + 1

    while (cursor < nested.length) {
      const next = readLiveCode(nested[cursor])
      if (!next || next.id !== first.id) break
      group.push(next)
      cursor += 1
    }

    const component = createLiveComponent(group)
    if (component) transformed.push(component)
    else transformed.push(...group.map(({ node }) => node))
    index = cursor
  }

  return transformed
}

function transformNestedBlocks(block: BlockNode): BlockNode {
  switch (block.type) {
    case 'blockquote':
    case 'callout':
    case 'component':
      return { ...block, children: transformBlocks(block.children) }
    case 'list':
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: transformBlocks(item.children),
        })),
      }
    case 'footnotes':
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: transformBlocks(item.children),
        })),
      }
    case 'code':
    case 'heading':
    case 'html':
    case 'paragraph':
    case 'table':
    case 'thematicBreak':
      return block
  }
}

function readLiveCode(block: BlockNode | undefined) {
  if (block?.type !== 'code' || !block.meta) return undefined

  const attributes = parseAttributes(block.meta)
  const entry = attributes.entry
  const id = attributes.live
  const file = attributes.file

  if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) return undefined
  if (!file || !isCanonicalExamplePath(file)) return undefined
  if (entry && !isCanonicalExamplePath(entry)) return undefined

  return { entry, file, id, node: block }
}

function createLiveComponent(
  group: Array<{
    entry: string | undefined
    file: string
    id: string
    node: CodeBlockNode
  }>,
): ComponentNode | undefined {
  const files: Record<string, string> = {}

  for (const item of group) {
    if (files[item.file] !== undefined) return undefined
    files[item.file] = item.node.value
  }

  const first = group[0]
  if (!first) return undefined

  const explicitEntries = group.flatMap(({ entry }) =>
    entry === undefined ? [] : [entry],
  )
  if (new Set(explicitEntries).size > 1) return undefined

  const entry = explicitEntries[0] ?? first.file
  if (files[entry] === undefined) return undefined

  const workspace = createExampleWorkspace({ entry, files })

  return {
    type: 'component',
    name: 'live-example',
    tagName: 'md-live-example',
    attributes: { id: first.id },
    properties: {
      'data-live-id': first.id,
      'data-workspace': serializeExampleWorkspace(workspace),
    },
    children: group.map(({ node }) => node),
  }
}
