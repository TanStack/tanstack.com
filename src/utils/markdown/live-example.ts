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
import { getExampleEnvironmentProfile } from '~/utils/notebook-environment'

type TransformState = {
  groupOccurrences: Map<string, number>
}

export function liveExamplesExtension(): MarkdownExtension {
  return {
    name: 'live-examples',
    transformDocument(document) {
      return {
        ...document,
        children: transformBlocks(document.children, {
          groupOccurrences: new Map(),
        }),
      }
    },
  }
}

function transformBlocks(
  blocks: Array<BlockNode>,
  state: TransformState,
): Array<BlockNode> {
  const transformed: Array<BlockNode> = []
  let index = 0

  while (index < blocks.length) {
    const first = readGroupCode(blocks[index])
    if (!first) {
      transformed.push(transformNestedBlocks(blocks[index], state))
      index += 1
      continue
    }

    const group = [first]
    let cursor = index + 1

    while (cursor < blocks.length) {
      const next = readGroupCode(blocks[cursor])
      if (!next || next.group !== first.group) break
      group.push(next)
      cursor += 1
    }

    const component = createLiveComponent(group, state)
    if (component) transformed.push(component)
    else transformed.push(...group.map(({ node }) => node))
    index = cursor
  }

  return transformed
}

function transformNestedBlocks(
  block: BlockNode,
  state: TransformState,
): BlockNode {
  switch (block.type) {
    case 'blockquote':
    case 'callout':
    case 'component':
      return { ...block, children: transformBlocks(block.children, state) }
    case 'list':
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: transformBlocks(item.children, state),
        })),
      }
    case 'footnotes':
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          children: transformBlocks(item.children, state),
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

  const { attributes, attributeCounts } = parseFenceAttributes(block.meta)
  const group = attributes.group

  if (group === undefined) return undefined

  return {
    attributes,
    attributeCounts,
    group,
    node: block,
  }
}

function createLiveComponent(
  group: Array<{
    attributes: Record<string, string>
    attributeCounts: Map<string, number>
    group: string
    node: CodeBlockNode
  }>,
  state: TransformState,
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
    const { attributes, attributeCounts } = item
    const file = attributes.file
    const entry = attributes.entry
    const collapsed = attributes.collapsed
    const environment = attributes.env

    if (
      countAttribute(attributeCounts, 'group') !== 1 ||
      countAttribute(attributeCounts, 'file') !== 1 ||
      countAttribute(attributeCounts, 'entry') > 1 ||
      countAttribute(attributeCounts, 'collapsed') > 1 ||
      countAttribute(attributeCounts, 'env') > 1 ||
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

  const profile = getExampleEnvironmentProfile(environment)
  if (files[profile.entryPath] !== undefined) return undefined

  const workspace = createExampleWorkspace({
    entry,
    environment,
    files,
    imports: profile.imports,
  })
  const occurrence = (state.groupOccurrences.get(first.group) ?? 0) + 1
  state.groupOccurrences.set(first.group, occurrence)

  return {
    type: 'component',
    name: 'live-example',
    tagName: 'md-live-example',
    attributes: { id: `${first.group}-${occurrence}` },
    properties: {
      'data-example-group': first.group,
      'data-collapsed-indexes': JSON.stringify(collapsedIndexes),
      'data-workspace': serializeExampleWorkspace(workspace),
    },
    children: group.map(({ node }) => node),
  }
}

function parseFenceAttributes(meta: string) {
  const attributes: Record<string, string> = {}
  const attributeCounts = new Map<string, number>()
  const pattern = /([A-Za-z_][\w:-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g

  for (const match of meta.matchAll(pattern)) {
    const name = match[1]
    if (!name) continue

    attributes[name] = match[2] ?? match[3] ?? match[4] ?? 'true'
    attributeCounts.set(name, (attributeCounts.get(name) ?? 0) + 1)
  }

  return { attributes, attributeCounts }
}

function countAttribute(counts: Map<string, number>, name: string) {
  return counts.get(name) ?? 0
}
