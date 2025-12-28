import { transformerNotationDiff } from '@shikijs/transformers'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import { createHighlighter } from 'shiki'
import type { HighlighterGeneric, Lang, ThemeInput } from 'shiki'

const DEFAULT_THEMES: ThemeInput[] = ['github-light', 'tokyo-night']
const DEFAULT_LANGS: Lang[] = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'bash',
  'json',
  'html',
  'css',
  'markdown',
  'plaintext',
]

const LANG_ALIASES: Record<string, Lang> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  console: 'bash',
  zsh: 'bash',
  md: 'markdown',
  txt: 'plaintext',
  text: 'plaintext',
}

let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null
const fragmentParser = unified().use(rehypeParse, { fragment: true })

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      langs: DEFAULT_LANGS,
      themes: DEFAULT_THEMES,
    })
  }
  return highlighterPromise
}

async function renderMermaid(code: string): Promise<string> {
  const mermaid = await import('mermaid')
  const { svg } = await mermaid.default.render(`mermaid-${Math.random()}`, code)
  return svg
}

export const rehypeShikiHighlight = () => {
  return async (tree: Root) => {
    const highlighter = await getHighlighter()

    const highlightTasks: Array<Promise<void>> = []

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') return
      const codeNode = node.children?.[0]
      if (!codeNode || codeNode.type !== 'element' || codeNode.tagName !== 'code') {
        return
      }

      const classNames = codeNode.properties?.className
      const className = Array.isArray(classNames)
        ? classNames.find((cls) => cls.startsWith('language-'))
        : typeof classNames === 'string'
          ? classNames
          : undefined

      const langRaw = className?.replace('language-', '') ?? 'plaintext'
      const codeText = codeNode.children?.[0]?.value
      if (typeof codeText !== 'string') {
        return
      }

      highlightTasks.push(
        (async () => {
          const normalizedLang = LANG_ALIASES[langRaw] ?? (langRaw as Lang)
          const effectiveLang = normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

          if (
            !highlighter
              .getLoadedLanguages()
              .includes(effectiveLang as unknown as Lang)
          ) {
            try {
              await highlighter.loadLanguage(effectiveLang as unknown as Lang)
            } catch {
              // stick with plaintext fallback
            }
          }

          node.tagName = 'div'
          const existingClasses = Array.isArray(node.properties?.className)
            ? (node.properties?.className as string[])
            : typeof node.properties?.className === 'string'
              ? String(node.properties.className).split('\n')
              : []

          node.properties = {
            ...node.properties,
            className: [...existingClasses, 'shiki-wrapper'],
            'data-language': normalizedLang,
          }

          if (normalizedLang === 'mermaid') {
            const svg = await renderMermaid(codeText)
            const mermaidTree = fragmentParser.parse(
              `<div class="mermaid-diagram py-4 bg-neutral-50 dark:bg-gray-900">${svg}</div>`,
            ) as Root

            node.children = mermaidTree.children
            return
          }

          const htmlFragments = await Promise.all(
            DEFAULT_THEMES.map((theme) =>
              highlighter.codeToHtml(codeText, {
                lang: effectiveLang,
                theme,
                transformers: [transformerNotationDiff()],
              }),
            ),
          )

          const fragmentTrees = htmlFragments.map((fragment) =>
            fragmentParser.parse(fragment) as Root,
          )

          node.children = fragmentTrees.flatMap((fragmentTree) => fragmentTree.children)
        })(),
      )
    })

    await Promise.all(highlightTasks)
  }
}
