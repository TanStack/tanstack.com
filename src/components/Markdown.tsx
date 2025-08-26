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
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import markedAlert from 'marked-alert'

const CustomHeading = ({
  Comp,
  id,
  ...props
}: HTMLProps<HTMLHeadingElement> & {
  Comp: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}) => {
  if (id) {
    return (
      <a
        href={`#${id}`}
        className={`anchor-heading *:scroll-my-20 *:lg:scroll-my-4`}
      >
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

export function CodeBlock({
  isEmbedded,
  ...props
}: React.HTMLProps<HTMLPreElement> & { isEmbedded?: boolean }) {
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

  const code = children?.props.children

  const [codeElement, setCodeElement] = React.useState(
    <>
      <pre ref={ref} className={`shiki github-light h-full`}>
        <code>{code}</code>
      </pre>
      <pre className={`shiki tokyo-night`}>
        <code>{code}</code>
      </pre>
    </>
  )

  React[
    typeof document !== 'undefined' ? 'useLayoutEffect' : 'useEffect'
  ](() => {
    ;(async () => {
      const themes = ['github-light', 'tokyo-night']

      const highlighter = await getHighlighter(lang, themes)

      const htmls = await Promise.all(
        themes.map((theme) =>
          highlighter.codeToHtml(code, {
            lang,
            theme,
            transformers: [transformerNotationDiff()],
          })
        )
      )

      setCodeElement(
        <div
          // className={`m-0 text-sm rounded-md w-full border border-gray-500/20 dark:border-gray-500/30`}
          className={`${
            isEmbedded ? 'h-full [&>pre]:h-full [&>pre]:rounded-none' : ''
          } `}
          dangerouslySetInnerHTML={{ __html: htmls.join('') }}
          ref={ref}
        />
      )
    })()
  }, [code, lang])

  return (
    <div
      className={`${props.className} w-full max-w-full relative not-prose`}
      style={props.style}
    >
      <div
        className={`absolute flex items-stretch bg-white text-sm z-10 border border-gray-500/20 rounded-md ${
          isEmbedded ? 'top-2 right-4' : '-top-3 right-2'
        } dark:bg-gray-800 overflow-hidden divide-x divide-gray-500/20`}
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
          }}
          aria-label="Copy code to clipboard"
        >
          {copied ? <span className="text-xs">Copied!</span> : <FaRegCopy />}
        </button>
      </div>
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

const options: HTMLReactParserOptions = {
  replace: (domNode) => {
    if (domNode instanceof Element && domNode.attribs) {
      const replacer = markdownComponents[domNode.name]
      if (replacer) {
        return React.createElement(
          replacer,
          attributesToProps(domNode.attribs),
          domToReact(domNode.children as any, options)
        )
      }
    }

    return
  },
}

type MarkdownProps = { rawContent?: string; htmlMarkup?: string }

export function Markdown({ rawContent, htmlMarkup }: MarkdownProps) {
  return React.useMemo(() => {
    if (rawContent) {
      const markup = marked.use(
        { gfm: true },
        gfmHeadingId(),
        markedAlert()
      )(rawContent) as string

      return parse(markup, options)
    }

    if (htmlMarkup) {
      return parse(htmlMarkup, options)
    }

    return null
  }, [rawContent, htmlMarkup])
}
