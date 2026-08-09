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
  isExampleEnvironment,
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
    const first = readGroupCode(nested[index])
    if (!first) {
      transformed.push(nested[index])
      index += 1
      continue
    }

    const group = [first]
    let cursor = index + 1

    while (cursor < nested.length) {
      const next = readGroupCode(nested[cursor])
      if (!next || next.group !== first.group) break
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

function readGroupCode(block: BlockNode | undefined) {
  if (block?.type !== 'code' || !block.meta) return undefined

  const attributes = parseAttributes(block.meta)
  const group = attributes.group

  if (group === undefined) return undefined

  return {
    attributes,
    attributeNames: readAttributeNames(block.meta),
    group,
    node: block,
  }
}

function createLiveComponent(
  group: Array<{
    attributes: Record<string, string>
    attributeNames: Array<string>
    group: string
    node: CodeBlockNode
  }>,
): ComponentNode | undefined {
  const first = group[0]
  if (!first || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(first.group)) {
    return undefined
  }

  const files: Record<string, string> = {}
  const collapsedIndexes: Array<number> = []
  const entryItems: Array<(typeof group)[number]> = []
  const environmentItems: Array<(typeof group)[number]> = []

  for (const [index, item] of group.entries()) {
    const { attributes, attributeNames } = item
    const file = attributes.file
    const entry = attributes.entry
    const collapsed = attributes.collapsed
    const environment = attributes.env

    if (
      countAttribute(attributeNames, 'group') !== 1 ||
      countAttribute(attributeNames, 'file') !== 1 ||
      countAttribute(attributeNames, 'entry') > 1 ||
      countAttribute(attributeNames, 'collapsed') > 1 ||
      countAttribute(attributeNames, 'env') > 1 ||
      !file ||
      !isCanonicalExamplePath(file) ||
      (entry !== undefined && entry !== 'true') ||
      (collapsed !== undefined && collapsed !== 'true') ||
      (environment !== undefined && !isExampleEnvironment(environment)) ||
      files[file] !== undefined
    ) {
      return undefined
    }

    files[file] = item.node.value
    if (entry === 'true') entryItems.push(item)
    if (environment !== undefined) environmentItems.push(item)
    if (collapsed === 'true') collapsedIndexes.push(index)
  }

  const entryItem = entryItems[0]
  const environmentItem = environmentItems[0]
  if (
    entryItems.length !== 1 ||
    environmentItems.length !== 1 ||
    !entryItem ||
    entryItem !== environmentItem ||
    entryItem.attributes.collapsed !== undefined
  ) {
    return undefined
  }

  const entry = entryItem.attributes.file
  const environment = entryItem.attributes.env
  if (!entry || !environment || !isExampleEnvironment(environment)) {
    return undefined
  }

  const workspace = createExampleWorkspace({ entry, environment, files })

  return {
    type: 'component',
    name: 'live-example',
    tagName: 'md-live-example',
    attributes: { id: first.group },
    properties: {
      'data-example-group': first.group,
      'data-collapsed-indexes': JSON.stringify(collapsedIndexes),
      'data-workspace': serializeExampleWorkspace(workspace),
    },
    children: group.map(({ node }) => node),
  }
}

function readAttributeNames(meta: string) {
  const names: Array<string> = []
  const pattern = /([A-Za-z_][\w:-]*)(?:=(?:"[^"]*"|'[^']*'|[^\s"']+))?/g

  for (const match of meta.matchAll(pattern)) {
    const name = match[1]
    if (name) names.push(name)
  }

  return names
}

function countAttribute(names: Array<string>, name: string) {
  return names.filter((candidate) => candidate === name).length
}
