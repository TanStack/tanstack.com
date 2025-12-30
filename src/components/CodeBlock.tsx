import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'
import { Copy } from 'lucide-react'
import type { Mermaid } from 'mermaid'
import { transformerNotationDiff } from '@shikijs/transformers'
import { createHighlighter, type HighlighterGeneric } from 'shiki'

const THEMES = ['github-light', 'tokyo-night']

const LANG_ALIASES: Record<string, string> = {
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
let mermaidInstance: Mermaid | null = null
const genSvgMap = new Map<string, string>()

async function getHighlighter(language: string) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: THEMES,
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
      ],
    })
  }

  const highlighter = await highlighterPromise
  const normalizedLang = LANG_ALIASES[language] || language
  const langToLoad = normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

  if (!highlighter.getLoadedLanguages().includes(langToLoad as any)) {
    try {
      await highlighter.loadLanguage(langToLoad as any)
    } catch {
      console.warn(`Shiki: Language "${langToLoad}" not found, using plaintext`)
    }
  }

  return highlighter
}

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

export type CodeBlockProps = React.HTMLProps<HTMLPreElement> & {
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
}

export function CodeBlock({
  isEmbedded,
  showTypeCopyButton = true,
  ...props
}: CodeBlockProps) {
  let lang = props?.children?.props?.className?.replace('language-', '')

  if (lang === 'diff') {
    lang = 'plaintext'
  }

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
    <>
      <pre ref={ref} className={`shiki github-light h-full`}>
        <code>{lang === 'mermaid' ? <svg /> : code}</code>
      </pre>
      <pre className={`shiki tokyo-night`}>
        <code>{lang === 'mermaid' ? <svg /> : code}</code>
      </pre>
    </>,
  )

  React[
    typeof document !== 'undefined' ? 'useLayoutEffect' : 'useEffect'
  ](() => {
    ;(async () => {
      const normalizedLang = LANG_ALIASES[lang] || lang
      const effectiveLang =
        normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

      const highlighter = await getHighlighter(lang)

      const htmls = await Promise.all(
        THEMES.map(async (theme) => {
          const output = highlighter.codeToHtml(code, {
            lang: effectiveLang,
            theme,
            transformers: [transformerNotationDiff()],
          })

          if (lang === 'mermaid') {
            const preAttributes = extractPreAttributes(output)
            let svgHtml = genSvgMap.get(code || '')
            if (!svgHtml) {
              const mermaid = await getMermaid()
              const { svg } = await mermaid.render('foo', code || '')
              genSvgMap.set(code || '', svg)
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
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md [&_pre]:rounded-md [*[data-tab]_&]:only:border-0',
        props.className,
      )}
      style={props.style}
    >
      {showTypeCopyButton ? (
        <div
          className={twMerge(
            `absolute flex items-stretch bg-white text-sm z-10 rounded-md`,
            `dark:bg-gray-800 overflow-hidden divide-x divide-gray-500/20`,
            'shadow-md',
            isEmbedded ? 'top-2 right-4' : '-top-3 right-2',
          )}
        >
          {lang ? <div className="px-2">{lang}</div> : null}
          <button
            className="px-2 py-1 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200"
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
                <div>
                  <div className="font-medium">Copied code</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    Code block copied to clipboard
                  </div>
                </div>,
              )
            }}
            aria-label="Copy code to clipboard"
          >
            {copied ? <span className="text-xs">Copied!</span> : <Copy />}
          </button>
        </div>
      ) : null}
      {codeElement}
    </div>
  )
}
