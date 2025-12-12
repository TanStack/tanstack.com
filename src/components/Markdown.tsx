import * as React from 'react'
import { FaRegCopy } from 'react-icons/fa'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { HTMLProps } from 'react'
import { createHighlighter as shikiGetHighlighter } from 'shiki/bundle-web.mjs'
import { transformerNotationDiff } from '@shikijs/transformers'
import parse, {
  attributesToProps,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from 'html-react-parser'
import mermaid from 'mermaid'
import { useToast } from '~/components/ToastProvider'
import { twMerge } from 'tailwind-merge'
import { useMarkdownHeadings } from '~/components/MarkdownHeadingContext'
import { renderMarkdown } from '~/utils/markdown'
import { Tabs } from '~/components/Tabs'

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
      return child.props.children ?? null
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
          className ?? ` ${className}`
        }`}
        {...rest}
      />
    )
  },
  iframe: (props) => (
    <iframe {...props} className="w-full" title="Embedded Content" />
  ),
  img: ({ children, ...props }: HTMLProps<HTMLImageElement>) => (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      {...props}
      className={`max-w-full h-auto rounded-lg shadow-md ${
        props.className ?? ''
      }`}
      // loading="lazy"
      // decoding="async"
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

mermaid.initialize({ startOnLoad: true, securityLevel: 'loose' })

export function CodeBlock({
  isEmbedded,
  showTypeCopyButton = true,
  ...props
}: React.HTMLProps<HTMLPreElement> & {
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
}) {
  // @ts-ignore
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

      const highlighter = await getHighlighter(lang, themes)

      const htmls = await Promise.all(
        themes.map(async (theme) => {
          const output = highlighter.codeToHtml(code, {
            lang: lang === 'mermaid' ? 'plaintext' : lang,
            theme,
            transformers: [transformerNotationDiff()],
          })

          if (lang === 'mermaid') {
            const preAttributes = extractPreAttributes(output)
            let svgHtml = genSvgMap.get(code || '')
            if (!svgHtml) {
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
            className="px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200"
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
            {copied ? <span className="text-xs">Copied!</span> : <FaRegCopy />}
          </button>
        </div>
      ) : null}
      {codeElement}
    </div>
  )
}

const cache = <T extends (...args: any[]) => any>(fn: T) => {
  const cache = new Map<string, any>()
  return async (...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const value = await fn(...args)
    cache.set(key, value)
    return value
  }
}

const highlighterPromise = shikiGetHighlighter({} as any)

const getHighlighter = cache(async (language: string, themes: string[]) => {
  const highlighter = await highlighterPromise

  const loadedLanguages = highlighter.getLoadedLanguages()
  const loadedThemes = highlighter.getLoadedThemes()

  let promises = []
  if (!loadedLanguages.includes(language as any)) {
    promises.push(
      highlighter.loadLanguage(
        language === 'mermaid' ? 'plaintext' : (language as any),
      ),
    )
  }

  for (const theme of themes) {
    if (!loadedThemes.includes(theme as any)) {
      promises.push(highlighter.loadTheme(theme as any))
    }
  }

  await Promise.all(promises)

  return highlighter
})

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
            const panelElements = domNode.children?.filter(
              (child): child is Element =>
                child instanceof Element && child.name === 'md-tab-panel',
            )

            const children = panelElements?.map((panel) =>
              domToReact(panel.children as any, options),
            )

            return <Tabs tabs={tabs} children={children as any} />
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
  rawContent?: string
  htmlMarkup?: string
}

export function Markdown({ rawContent, htmlMarkup }: MarkdownProps) {
  const { setHeadings } = useMarkdownHeadings()

  const rendered = React.useMemo(() => {
    if (rawContent) {
      return renderMarkdown(rawContent)
    }

    if (htmlMarkup) {
      return { markup: htmlMarkup, headings: [] }
    }

    return { markup: '', headings: [] }
  }, [rawContent, htmlMarkup])

  React.useEffect(() => {
    setHeadings(rendered.headings)
  }, [rendered.headings, setHeadings])

  return React.useMemo(() => {
    if (!rendered.markup) {
      return null
    }

    return parse(rendered.markup, options)
  }, [rendered.markup])
}
