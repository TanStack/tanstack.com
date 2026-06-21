import type { BlockNode, ComponentNode } from '../types.js'
import { blocksToText, slugify, splitByHeading } from './shared.js'

const bundlers = ['vite', 'rsbuild'] as const

export function transformTabsComponent(node: ComponentNode): ComponentNode {
  const variant = node.attributes.variant?.toLowerCase()

  if (variant === 'files') return transformFileTabs(node)
  if (variant === 'package-manager' || variant === 'package-managers')
    return transformPackageManagerTabs(node)
  if (variant === 'bundler') return transformBundlerTabs(node)

  return transformHeadingTabs(node)
}

export function transformFileTabs(node: ComponentNode): ComponentNode {
  const files = node.children.filter(
    (child): child is Extract<BlockNode, { type: 'code' }> =>
      child.type === 'code',
  )
  if (!files.length) return node

  const tabs = files.map((file, index) => ({
    slug: `file-${index}`,
    name: file.title || file.file || 'Untitled',
  }))

  return {
    ...node,
    properties: {
      ...(node.properties ?? {}),
      'data-attributes': JSON.stringify({ tabs }),
      'data-files-meta': JSON.stringify({
        files: files.map((file) => ({
          title: file.title || file.file || 'Untitled',
          code: file.value,
          language: file.lang ?? 'plaintext',
        })),
      }),
    },
    children: files.map(
      (file, index): ComponentNode => ({
        type: 'component',
        name: 'tab-panel',
        tagName: 'md-tab-panel',
        attributes: {},
        properties: {
          'data-tab-slug': `file-${index}`,
          'data-tab-index': String(index),
        },
        children: [file],
      }),
    ),
  }
}

export function transformPackageManagerTabs(
  node: ComponentNode,
): ComponentNode {
  const packagesByFramework: Record<string, string[][]> = {}

  for (const line of blocksToText(node.children).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const framework = trimmed.slice(0, colon).trim().toLowerCase()
    const packages = trimmed
      .slice(colon + 1)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    if (!framework || packages.length === 0) continue
    packagesByFramework[framework] ??= []
    packagesByFramework[framework]!.push(packages)
  }

  if (!Object.keys(packagesByFramework).length) return node

  return {
    ...node,
    properties: {
      ...(node.properties ?? {}),
      'data-package-manager-meta': JSON.stringify({
        packagesByFramework,
        mode: resolveInstallMode(node.attributes.mode),
      }),
    },
    children: [],
  }
}

export function transformBundlerTabs(node: ComponentNode): ComponentNode {
  const sections = splitByHeading(node.children)
  const selected = sections.filter((section) =>
    isBundler(section.name.toLowerCase()),
  )
  if (!selected.length) return node

  const tabs = bundlers
    .map((bundler) =>
      selected.find((section) => section.name.toLowerCase() === bundler),
    )
    .filter((section): section is NonNullable<typeof section> =>
      Boolean(section),
    )
    .map((section) => ({
      slug: section.name.toLowerCase(),
      name: section.name.toLowerCase(),
    }))

  return {
    ...node,
    properties: {
      ...(node.properties ?? {}),
      'data-attributes': JSON.stringify({ tabs }),
      'data-bundler-meta': JSON.stringify({
        bundlers: tabs.map((tab) => tab.slug),
      }),
    },
    children: tabs.map((tab, index): ComponentNode => {
      const section = selected.find(
        (section) => section.name.toLowerCase() === tab.slug,
      )!
      return {
        type: 'component',
        name: 'tab-panel',
        tagName: 'md-tab-panel',
        attributes: {},
        properties: {
          'data-tab-slug': tab.slug,
          'data-tab-index': String(index),
          'data-content':
            section.children.length === 1 &&
            section.children[0]?.type === 'code'
              ? 'code-only'
              : 'mixed',
        },
        children: section.children,
      }
    }),
  }
}

export function transformHeadingTabs(node: ComponentNode): ComponentNode {
  const sections = splitByHeading(node.children)
  if (!sections.length) return node

  const tabs = sections.map((section, index) => ({
    slug: section.id || slugify(section.name, `tab-${index + 1}`),
    name: section.name,
  }))

  return {
    ...node,
    properties: {
      ...(node.properties ?? {}),
      'data-attributes': JSON.stringify({ tabs }),
    },
    children: sections.map(
      (section, index): ComponentNode => ({
        type: 'component',
        name: 'tab-panel',
        tagName: 'md-tab-panel',
        attributes: {},
        properties: {
          'data-tab-slug': tabs[index]?.slug ?? `tab-${index + 1}`,
          'data-tab-index': String(index),
        },
        children: section.children,
      }),
    ),
  }
}

function resolveInstallMode(value: string | undefined): string {
  const mode = value?.toLowerCase()
  if (mode === 'dev-install' || mode === 'local-install') return mode
  return 'install'
}

function isBundler(value: string): value is (typeof bundlers)[number] {
  return bundlers.some((bundler) => bundler === value)
}
