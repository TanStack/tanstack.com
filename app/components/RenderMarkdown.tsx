import * as React from 'react'
import { FaRegCopy } from 'react-icons/fa'
import { MarkdownLink } from '~/components/MarkdownLink'
import type { HTMLProps } from 'react'
import Markdown from 'markdown-to-jsx'
import { getHighlighter as shikiGetHighlighter } from 'shiki/bundle-web.mjs'

const CustomHeading = ({
  Comp,
  id,
  ...props
}: HTMLProps<HTMLHeadingElement> & {
  Comp: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}) => {
  if (id) {
    return (
      <a href={`#${id}`} className={`anchor-heading`}>
        <Comp id={id} {...props} />
      </a>
    )
  }
  return <Comp {...props} />
}

const makeHeading =
  (type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
  (props: HTMLProps<HTMLHeadingElement>) =>
    (
      <CustomHeading
        Comp={type}
        {...props}
        className={`${props.className ?? ''} inline-block`}
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
        className={`border border-gray-500 border-opacity-20 bg-gray-500 bg-opacity-10 rounded p-1${
          className ?? ` ${className}`
        }`}
        {...rest}
      />
    )
  },
  iframe: (props) => (
    <iframe {...props} className="w-full" title="Embedded Content" />
  ),
}

function getLanguageFromChildren(children: any): string | undefined {
  const language = children?.props?.className?.replace('lang-', '')
  return language ? language : undefined
}

function CodeBlock(props: React.HTMLProps<HTMLPreElement>) {
  const lang = getLanguageFromChildren(props.children) || ''

  const children = props.children as
    | undefined
    | {
        props: {
          children: string
        }
      }

  const code = children?.props.children

  const Children = React.useMemo(() => {
    return React.lazy(async () => {
      const themes = ['github-light', 'tokyo-night']

      const highlighter = await getHighlighter(lang, themes)

      const htmls = await Promise.all(
        themes.map((theme) =>
          highlighter.codeToHtml(code, {
            lang,
            theme,
          })
        )
      )

      return {
        default: function Pre() {
          const [copied, setCopied] = React.useState(false)
          const ref = React.useRef<HTMLDivElement>(null)

          return (
            <div
              className={`${props.className} w-full max-w-full relative not-prose`}
              style={props.style}
            >
              <div className="absolute flex items-stretch bg-white text-sm z-10 border border-gray-500/20 rounded-md -top-3 right-2 dark:bg-gray-800 overflow-hidden divide-x divide-gray-500/20">
                {lang ? <div className="px-2">{lang}</div> : null}
                <button
                  className="px-2 flex items-center text-gray-500 hover:bg-gray-500 hover:text-gray-100 dark:hover:text-gray-200 transition duration-200"
                  onClick={() => {
                    navigator.clipboard.writeText(ref.current?.innerText || '')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  aria-label="Copy code to clipboard"
                >
                  {copied ? (
                    <span className="text-xs">Copied!</span>
                  ) : (
                    <FaRegCopy />
                  )}
                </button>
              </div>
              <div
                // className={`m-0 text-sm rounded-md w-full border border-gray-500/20 dark:border-gray-500/30`}
                dangerouslySetInnerHTML={{ __html: htmls.join('') }}
                ref={ref}
              />
            </div>
          )
        },
      }
    })
  }, [lang, code, props.className, props.style])

  return (
    <React.Suspense fallback="">
      <Children />
    </React.Suspense>
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
    promises.push(highlighter.loadLanguage(language as any))
  }

  for (const theme of themes) {
    if (!loadedThemes.includes(theme as any)) {
      promises.push(highlighter.loadTheme(theme as any))
    }
  }

  await Promise.all(promises)

  return highlighter
})

export function Mdx({
  code,
  components,
}: {
  code: string
  components?: Record<string, React.FC>
}) {
  return (
    <Markdown
      options={{
        overrides: {
          ...markdownComponents,
          ...components,
        },
      }}
      children={code}
    />
  )
}
