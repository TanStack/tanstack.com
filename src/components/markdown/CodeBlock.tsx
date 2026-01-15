import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'
import { Copy } from 'lucide-react'
import type { Mermaid } from 'mermaid'
import { transformerNotationDiff } from '@shikijs/transformers'
import { createHighlighter, type HighlighterGeneric } from 'shiki'
import { Button } from '~/ui'

// Language aliases mapping
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  console: 'bash',
  zsh: 'bash',
  cmd: 'bash',
  md: 'markdown',
  txt: 'plaintext',
  text: 'plaintext',
  yml: 'yaml',
  json5: 'jsonc',
  eslintrc: 'jsonc',
}

// Lazy highlighter singleton
let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null
let mermaidInstance: Mermaid | null = null
const genSvgMap = new Map<string, string>()
const failedLanguages = new Set<string>()

async function getHighlighter(language: string): Promise<{
  highlighter: HighlighterGeneric<any, any>
  effectiveLang: string
}> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'vitesse-dark'],
      langs: [
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
        'toml',
        'yaml',
        'sql',
        'diff',
        'vue',
        'svelte',
        'scss',
        'jsonc',
        'vue-html',
        'angular-html',
        'angular-ts',
      ],
    })
  }

  const highlighter = await highlighterPromise
  const normalizedLang = LANG_ALIASES[language] || language
  const langToLoad = normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

  // Return plaintext for known failed languages
  if (failedLanguages.has(langToLoad)) {
    return { highlighter, effectiveLang: 'plaintext' }
  }

  // Load language if not already loaded
  if (!highlighter.getLoadedLanguages().includes(langToLoad as any)) {
    try {
      await highlighter.loadLanguage(langToLoad as any)
    } catch {
      console.warn(`Shiki: Language "${langToLoad}" not found, using plaintext`)
      failedLanguages.add(langToLoad)
      return { highlighter, effectiveLang: 'plaintext' }
    }
  }

  return { highlighter, effectiveLang: langToLoad }
}

// Lazy load mermaid only when needed
async function getMermaid(): Promise<Mermaid> {
  if (!mermaidInstance) {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
    mermaidInstance = mermaid
  }
  return mermaidInstance
}

function extractPreAttributes(html: string): {
  class: string | null
  style: string | null
} {
  const match = html.match(/<pre\b([^>]*)>/i)
  if (!match) {
    return { class: null, style: null }
  }

  const attributes = match[1]

  const classMatch = attributes.match(/\bclass\s*=\s*["']([^"']*)["']/i)
  const styleMatch = attributes.match(/\bstyle\s*=\s*["']([^"']*)["']/i)

  return {
    class: classMatch ? classMatch[1] : null,
    style: styleMatch ? styleMatch[1] : null,
  }
}

export function CodeBlock({
  isEmbedded,
  showTypeCopyButton = true,
  ...props
}: React.HTMLProps<HTMLPreElement> & {
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
  dataCodeTitle?: string
}) {
  // Extract title from data-code-title attribute, handling both camelCase and kebab-case
  const rawTitle = ((props as any)?.dataCodeTitle ||
    (props as any)?.['data-code-title']) as string | undefined

  // Filter out "undefined" strings, null, and empty strings
  const title =
    rawTitle && rawTitle !== 'undefined' && rawTitle.trim().length > 0
      ? rawTitle.trim()
      : undefined

  const childElement = props.children as
    | undefined
    | { props?: { className?: string; children?: string } }
  const lang = childElement?.props?.className?.replace('language-', '')

  const children = props.children as
    | undefined
    | {
        props: {
          children: string
        }
      }

  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<any>(null)
  const { notify } = useToast()

  const code = children?.props.children

  const [codeElement, setCodeElement] = React.useState(
    <pre ref={ref} className={`shiki h-full github-light dark:vitesse-dark`}>
      <code>{lang === 'mermaid' ? <svg /> : code}</code>
    </pre>,
  )

  React[
    typeof document !== 'undefined' ? 'useLayoutEffect' : 'useEffect'
  ](() => {
    ;(async () => {
      const themes = ['github-light', 'vitesse-dark']
      const langStr = lang || 'plaintext'

      const { highlighter, effectiveLang } = await getHighlighter(langStr)
      // Trim trailing newlines to prevent empty lines at end of code block
      const trimmedCode = (code || '').trimEnd()

      const htmls = await Promise.all(
        themes.map(async (theme) => {
          const output = highlighter.codeToHtml(trimmedCode, {
            lang: effectiveLang,
            theme,
            transformers: [transformerNotationDiff()],
          })

          if (lang === 'mermaid') {
            const preAttributes = extractPreAttributes(output)
            let svgHtml = genSvgMap.get(trimmedCode)
            if (!svgHtml) {
              const mermaid = await getMermaid()
              const { svg } = await mermaid.render('foo', trimmedCode)
              genSvgMap.set(trimmedCode, svg)
              svgHtml = svg
            }
            return `<div class='${preAttributes.class} py-4 bg-neutral-50'>${svgHtml}</div>`
          }

          return output
        }),
      )

      setCodeElement(
        <div
          className={twMerge(
            isEmbedded ? 'h-full [&>pre]:h-full [&>pre]:rounded-none' : '',
          )}
          dangerouslySetInnerHTML={{ __html: htmls.join('') }}
          ref={ref}
        />,
      )
    })()
  }, [code, lang])

  return (
    <div
      className={twMerge(
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md [&_pre]:rounded-md',
        props.className,
      )}
      style={props.style}
    >
      {(title || showTypeCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {title || (lang?.toLowerCase() === 'bash' ? 'sh' : (lang ?? ''))}
          </div>

          <Button
            variant="ghost"
            size="xs"
            className={twMerge('border-0 rounded-md transition-opacity')}
            onClick={() => {
              let copyContent =
                typeof ref.current?.innerText === 'string'
                  ? ref.current.innerText
                  : ''

              if (copyContent.endsWith('\n')) {
                copyContent = copyContent.slice(0, -1)
              }

              navigator.clipboard.writeText(copyContent)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
              notify(
                <div className="flex flex-col">
                  <span className="font-medium">Copied code</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    Code block copied to clipboard
                  </span>
                </div>,
              )
            }}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <span className="text-xs">Copied!</span>
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
      {codeElement}
    </div>
  )
}
