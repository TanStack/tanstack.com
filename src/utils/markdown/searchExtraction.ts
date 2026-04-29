import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { extractCodeMeta } from './plugins/extractCodeMeta'
import {
  rehypeParseCommentComponents,
  rehypeTransformCommentComponents,
  rehypeTransformFrameworkComponents,
} from './plugins'
import {
  getInstallCommand,
  type InstallMode,
  type PackageManager,
} from './installCommand'

const DEFAULT_PACKAGE_MANAGER: PackageManager = 'npm'

type HeadingContext = {
  anchor?: string
  heading: string
  level: number
}

type SectionBuilder = {
  framework: string
  heading?: HeadingContext
  chunks: Array<string>
}

type TabDescriptor = {
  name: string
  slug: string
}

type PackageManagerMeta = {
  packagesByFramework: Record<string, Array<Array<string>>>
  mode: InstallMode
}

export type MarkdownSearchSection = {
  framework: string
  anchor?: string
  heading?: string
  level?: number
  content: string
}

export type MarkdownSearchExtraction = {
  sections: Array<MarkdownSearchSection>
  frameworks: Array<string>
}

export type MarkdownSearchExtractionOptions = {
  packageManager?: PackageManager
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getTagName(node: unknown) {
  if (!isRecord(node) || node.type !== 'element') {
    return undefined
  }

  return typeof node.tagName === 'string' ? node.tagName : undefined
}

function getChildren(node: unknown) {
  if (!isRecord(node) || !Array.isArray(node.children)) {
    return []
  }

  return node.children
}

function getStringProperty(node: unknown, property: string) {
  if (!isRecord(node)) {
    return undefined
  }

  const properties = node.properties
  if (!isRecord(properties)) {
    return undefined
  }

  const value = properties[property]
  return typeof value === 'string' ? value : undefined
}

function parseJsonObject(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function isHeadingNode(node: unknown) {
  const tagName = getTagName(node)
  if (!tagName || tagName.length !== 2 || tagName[0] !== 'h') {
    return false
  }

  const level = Number(tagName[1])
  return Number.isInteger(level) && level >= 1 && level <= 6
}

function getNodeText(node: unknown): string {
  if (!isRecord(node)) {
    return ''
  }

  if (node.type === 'text' || node.type === 'raw') {
    return typeof node.value === 'string' ? node.value : ''
  }

  const tagName = getTagName(node)
  if (tagName === 'br') {
    return '\n'
  }

  if (tagName === 'img') {
    return getStringProperty(node, 'alt') ?? ''
  }

  return getChildren(node).map(getNodeText).join(' ')
}

function getHeadingContext(node: unknown): HeadingContext | null {
  if (!isHeadingNode(node)) {
    return null
  }

  const tagName = getTagName(node)
  if (!tagName) {
    return null
  }

  const heading = normalizeSearchText(getNodeText(node))
  if (!heading) {
    return null
  }

  return {
    anchor: getStringProperty(node, 'id'),
    heading,
    level: Number(tagName[1]),
  }
}

function createSectionBuilder(
  framework: string,
  heading?: HeadingContext,
): SectionBuilder {
  return {
    framework,
    heading,
    chunks: [],
  }
}

function flushSection(
  sections: Array<MarkdownSearchSection>,
  builder: SectionBuilder,
) {
  const content = normalizeSearchText(builder.chunks.join('\n'))
  if (!content) {
    return
  }

  sections.push({
    framework: builder.framework,
    anchor: builder.heading?.anchor,
    heading: builder.heading?.heading,
    level: builder.heading?.level,
    content,
  })
}

function isCommentComponent(node: unknown, componentName: string) {
  if (getTagName(node) !== 'md-comment-component') {
    return false
  }

  return (
    getStringProperty(node, 'data-component')?.toLowerCase() === componentName
  )
}

function isFrameworkComponent(node: unknown) {
  return isCommentComponent(node, 'framework')
}

function isTabsComponent(node: unknown) {
  return isCommentComponent(node, 'tabs')
}

function isInstallMode(value: string): value is InstallMode {
  return (
    value === 'install' ||
    value === 'dev-install' ||
    value === 'local-install' ||
    value === 'create' ||
    value === 'custom'
  )
}

function parsePackageGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  const groups: Array<Array<string>> = []
  for (const group of value) {
    if (!Array.isArray(group)) {
      return null
    }

    const packages: Array<string> = []
    for (const packageName of group) {
      if (typeof packageName !== 'string') {
        return null
      }
      packages.push(packageName)
    }

    if (packages.length) {
      groups.push(packages)
    }
  }

  return groups.length ? groups : null
}

function parsePackageManagerMeta(node: unknown): PackageManagerMeta | null {
  const parsed = parseJsonObject(
    getStringProperty(node, 'data-package-manager-meta'),
  )
  if (!parsed) {
    return null
  }

  const mode = parsed.mode
  if (typeof mode !== 'string' || !isInstallMode(mode)) {
    return null
  }

  const rawPackagesByFramework = parsed.packagesByFramework
  if (!isRecord(rawPackagesByFramework)) {
    return null
  }

  const packagesByFramework: Record<string, Array<Array<string>>> = {}
  for (const [framework, packageGroups] of Object.entries(
    rawPackagesByFramework,
  )) {
    const parsedPackageGroups = parsePackageGroups(packageGroups)
    if (parsedPackageGroups) {
      packagesByFramework[framework] = parsedPackageGroups
    }
  }

  if (!Object.keys(packagesByFramework).length) {
    return null
  }

  return {
    mode,
    packagesByFramework,
  }
}

function getPackageManagerCommandsByFramework(
  node: unknown,
  packageManager: PackageManager,
) {
  const meta = parsePackageManagerMeta(node)
  if (!meta) {
    return null
  }

  const commandsByFramework: Record<string, string> = {}
  for (const [framework, packageGroups] of Object.entries(
    meta.packagesByFramework,
  )) {
    const commandText = getInstallCommand(
      packageManager,
      packageGroups,
      meta.mode,
    ).join('\n')

    if (commandText) {
      commandsByFramework[framework] = commandText
    }
  }

  return Object.keys(commandsByFramework).length ? commandsByFramework : null
}

function parseTabs(node: unknown): Array<TabDescriptor> {
  const parsed = parseJsonObject(getStringProperty(node, 'data-attributes'))
  if (!parsed || !Array.isArray(parsed.tabs)) {
    return []
  }

  const tabs: Array<TabDescriptor> = []
  for (const tab of parsed.tabs) {
    if (!isRecord(tab)) {
      continue
    }

    if (typeof tab.name !== 'string' || typeof tab.slug !== 'string') {
      continue
    }

    tabs.push({
      name: tab.name,
      slug: tab.slug,
    })
  }

  return tabs
}

function getTabsText(node: unknown, options: RequiredSearchOptions) {
  const tabs = parseTabs(node)
  const panels = getChildren(node).filter(
    (child) => getTagName(child) === 'md-tab-panel',
  )

  return panels
    .map((panel, index) => {
      const tabName = tabs[index]?.name
      const panelText = getChildrenText(getChildren(panel), options)
      return normalizeSearchText([tabName, panelText].filter(Boolean).join(' '))
    })
    .filter(Boolean)
    .join('\n')
}

function getNodeTextForSearch(
  node: unknown,
  options: RequiredSearchOptions,
): string {
  if (isTabsComponent(node)) {
    return getTabsText(node, options)
  }

  if (isFrameworkComponent(node)) {
    return ''
  }

  const packageManagerCommands = getPackageManagerCommandsByFramework(
    node,
    options.packageManager,
  )
  if (packageManagerCommands) {
    return Object.values(packageManagerCommands).join('\n')
  }

  return getNodeText(node)
}

function getChildrenText(
  children: Array<unknown>,
  options: RequiredSearchOptions,
) {
  return children.map((child) => getNodeTextForSearch(child, options)).join('\n')
}

function appendPackageManagerSections(
  sections: Array<MarkdownSearchSection>,
  commandsByFramework: Record<string, string>,
  heading: HeadingContext | undefined,
) {
  for (const [framework, commandText] of Object.entries(commandsByFramework)) {
    const content = normalizeSearchText(commandText)
    if (!content) {
      continue
    }

    sections.push({
      framework,
      anchor: heading?.anchor,
      heading: heading?.heading,
      level: heading?.level,
      content,
    })
  }
}

function collectSectionsFromChildren(
  children: Array<unknown>,
  framework: string,
  options: RequiredSearchOptions,
  inheritedHeading?: HeadingContext,
) {
  const sections: Array<MarkdownSearchSection> = []
  let current = createSectionBuilder(framework, inheritedHeading)

  for (const child of children) {
    const packageManagerCommands = getPackageManagerCommandsByFramework(
      child,
      options.packageManager,
    )

    if (packageManagerCommands) {
      if (current.framework !== 'all') {
        const commandText = packageManagerCommands[current.framework]
        if (commandText) {
          current.chunks.push(commandText)
        }
        continue
      }

      flushSection(sections, current)
      appendPackageManagerSections(
        sections,
        packageManagerCommands,
        current.heading,
      )
      current = createSectionBuilder(framework, current.heading)
      continue
    }

    if (isFrameworkComponent(child)) {
      flushSection(sections, current)

      const heading = current.heading
      for (const panel of getChildren(child)) {
        if (getTagName(panel) !== 'md-framework-panel') {
          continue
        }

        const panelFramework = getStringProperty(panel, 'data-framework')
        if (!panelFramework) {
          continue
        }

        sections.push(
          ...collectSectionsFromChildren(
            getChildren(panel),
            panelFramework,
            options,
            heading,
          ),
        )
      }

      current = createSectionBuilder(framework, heading)
      continue
    }

    const heading = getHeadingContext(child)
    if (heading) {
      flushSection(sections, current)
      current = createSectionBuilder(framework, heading)
      continue
    }

    const text = normalizeSearchText(getNodeTextForSearch(child, options))
    if (text) {
      current.chunks.push(text)
    }
  }

  flushSection(sections, current)
  return sections
}

type RequiredSearchOptions = {
  packageManager: PackageManager
}

async function transformMarkdownForSearch(markdown: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(extractCodeMeta)
    .use(rehypeRaw)
    .use(rehypeParseCommentComponents)
    .use(rehypeSlug)
    .use(rehypeTransformFrameworkComponents)
    .use(rehypeTransformCommentComponents)

  return processor.run(processor.parse(markdown))
}

export async function extractMarkdownSearchSections(
  markdown: string,
  options: MarkdownSearchExtractionOptions = {},
): Promise<MarkdownSearchExtraction> {
  const tree = await transformMarkdownForSearch(markdown)
  const requiredOptions: RequiredSearchOptions = {
    packageManager: options.packageManager ?? DEFAULT_PACKAGE_MANAGER,
  }
  const sections = collectSectionsFromChildren(
    getChildren(tree),
    'all',
    requiredOptions,
  )
  const frameworks = Array.from(
    new Set(sections.map((section) => section.framework)),
  )

  return {
    sections,
    frameworks,
  }
}
