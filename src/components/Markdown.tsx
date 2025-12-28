import * as React from 'react'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { HTMLProps } from 'react'
import parse, {
  attributesToProps,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser'
import type { Mermaid } from 'mermaid'
import { useToast } from '~/components/ToastProvider'
import { twMerge } from 'tailwind-merge'
import { useMarkdownHeadings } from '~/components/MarkdownHeadingContext'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'
import { Tabs } from '~/components/Tabs'
import { Copy } from 'lucide-react'
import type {
  MarkdownHeading,
  MarkdownRenderResult,
} from '~/utils/markdown/processor'

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

const CustomHeading = ({
  Comp,
  id,
  children,
  ...props
}: HTMLProps<HTMLHeadingElement> & {
  Comp: HeadingLevel
}) => {
  // Convert children to array and strip any inner anchor (native 'a' or MarkdownLink)
  const childrenArray = React.Children.toArray(children)
  const sanitizedChildren = childrenArray.map((child) => {
    if (
      React.isValidElement(child) &&
      (child.type === 'a' || child.type === MarkdownLink)
    ) {
      // replace anchor child with its own children so outer anchor remains the only link
      return (child.props as any).children ?? null
    }
    return child
  })

  const heading = (
    <Comp id={id} {...props}>
      {sanitizedChildren}
    </Comp>
  )

  if (id) {
    return (
      <a
        href={`#${id}`}
        className={`anchor-heading *:scroll-my-20 *:lg:scroll-my-4`}
      >
        {heading}
      </a>
    )
  }

  return heading
}

const makeHeading =
  (type: HeadingLevel) => (props: HTMLProps<HTMLHeadingElement>) => (
    <CustomHeading
      Comp={type}
      {...props}
      className={`${props.className ?? ''} block`}
    />
  )

const markdownComponents: Record<string, React.FC> = {
  a: MarkdownLink,
  pre: CodeBlock,
  h1: makeHeading('h1'),
  h2: makeHeading('h2'),
  h3: makeHeading('h3'),
  h4: makeHeading('h4'),
  h5: makeHeading('h5'),
  h6: makeHeading('h6'),
  code: function Code({ className, ...rest }: HTMLProps<HTMLElement>) {
    return (
      <span
        className={`border border-gray-500/20 bg-gray-500/10 rounded px-1 py-0.5${
          className ? ` ${className}` : ''
        }`}
        {...rest}
      />
    )
  },
  iframe: (props) => (
    <iframe {...props} className="w-full" title="Embedded Content" />
  ),
  img: ({
    alt,
    src,
    className,
    children: _,
    ...props
  }: HTMLProps<HTMLImageElement>) => (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      className={`max-w-full h-auto rounded-lg shadow-md ${className ?? ''}`}
      loading="lazy"
      decoding="async"
    />
  ),
}

export function extractPreAttributes(html: string): {
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

const genSvgMap = new Map<string, string>()

// Lazy load mermaid only when needed
let mermaidInstance: Mermaid | null = null
async function getMermaid(): Promise<Mermaid> {
  if (!mermaidInstance) {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
    mermaidInstance = mermaid
  }
  return mermaidInstance
}

export function CodeBlock({
  isEmbedded,
  showTypeCopyButton = true,
  ...props
}: React.HTMLProps<HTMLPreElement> & {
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
}) {
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
      const themes = ['github-light', 'tokyo-night']
      const normalizedLang = LANG_ALIASES[lang] || lang
      const effectiveLang =
        normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

      const highlighter = await getHighlighter(lang)

      const htmls = await Promise.all(
        themes.map(async (theme) => {
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
          // className={`m-0 text-sm rounded-md w-full border border-gray-500/20 dark:border-gray-500/30`}
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

// Language aliases mapping
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

// Lazy highlighter singleton
let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null

async function getHighlighter(language: string) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'tokyo-night'],
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

  // Load language if not already loaded
  if (!highlighter.getLoadedLanguages().includes(langToLoad as any)) {
    try {
      await highlighter.loadLanguage(langToLoad as any)
    } catch {
      console.warn(`Shiki: Language "${langToLoad}" not found, using plaintext`)
    }
  }

  return highlighter
}

const options: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (domNode instanceof Element && domNode.attribs) {
      if (domNode.name === 'md-comment-component') {
        const componentName = domNode.attribs['data-component']
        const rawAttributes = domNode.attribs['data-attributes']
        const attributes: Record<string, any> = {}
        try {
          Object.assign(attributes, JSON.parse(rawAttributes))
        } catch {
          // ignore JSON parse errors and fall back to empty props
        }

        switch (componentName?.toLowerCase()) {
          case 'tabs': {
            const tabs = attributes.tabs
            const id =
              attributes.id || `tabs-${Math.random().toString(36).slice(2, 9)}`
            const panelElements = domNode.children?.filter(
              (child): child is Element =>
                child instanceof Element && child.name === 'md-tab-panel',
            )

            const children = panelElements?.map((panel) =>
              domToReact(panel.children as any, options),
            )

            return <Tabs id={id} tabs={tabs} children={children as any} />
          }
          default:
            return <div>{domToReact(domNode.children as any, options)}</div>
        }
      }

      const replacer = markdownComponents[domNode.name]
      if (replacer) {
        return React.createElement(
          replacer,
          attributesToProps(domNode.attribs),
          domToReact(domNode.children as any, options),
        )
      }
    }

    return
  },
}

type MarkdownProps = {
  htmlMarkup: string
  headingsOverride?: MarkdownHeading[]
  rawContent?: string
}

export function Markdown({
  rawContent,
  htmlMarkup,
  headingsOverride,
}: MarkdownProps) {
  const { setHeadings } = useMarkdownHeadings()

  const fallbackRender = React.useMemo(() => {
    if (!rawContent) {
      return null
    }

    return renderMarkdown(rawContent)
  }, [rawContent])

  const markup = React.useMemo(() => {
    if (htmlMarkup) {
      return htmlMarkup
    }

    return fallbackRender?.markup ?? ''
  }, [fallbackRender?.markup, htmlMarkup])

  const headings = React.useMemo(() => {
    if (headingsOverride) {
      return headingsOverride
    }

    return fallbackRender?.headings ?? []
  }, [fallbackRender?.headings, headingsOverride])

  React.useEffect(() => {
    setHeadings(headings)
  }, [headings, setHeadings])

  const parsed = React.useMemo(() => {
    if (!markup) {
      return null
    }

    return parse(markup, options)
  }, [markup])

  return parsed
}
