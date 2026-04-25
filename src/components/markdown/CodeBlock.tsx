'use client'

import * as React from 'react'
import { CodeBlockView } from './CodeBlockView'
import { MermaidBlock } from './MermaidBlock'
import {
  buildPlainCodeBlockHtml,
  extractCodeBlockData,
  type CodeBlockProps,
  type RenderedCodeBlockData,
} from './codeBlock.shared'
import { fetchRenderedCodeBlock } from '~/utils/codeBlock.functions'

const renderCache = new Map<string, Promise<RenderedCodeBlockData>>()

function getRenderPromise(
  key: string,
  data: { code: string; lang: string; title?: string },
) {
  const cached = renderCache.get(key)

  if (cached) {
    return cached
  }

  const promise = fetchRenderedCodeBlock({ data })
  renderCache.set(key, promise)

  return promise
}

export function CodeBlock(props: CodeBlockProps) {
  const { code, lang, title } = extractCodeBlockData(props)

  if (lang === 'mermaid') {
    return (
      <MermaidBlock
        className={props.className}
        code={code}
        isEmbedded={props.isEmbedded}
        showTypeCopyButton={props.showTypeCopyButton}
        style={props.style}
        title={title}
      />
    )
  }

  return (
    <HighlightedCodeBlock code={code} lang={lang} props={props} title={title} />
  )
}

function HighlightedCodeBlock({
  code,
  lang,
  props,
  title,
}: {
  code: string
  lang: string
  props: CodeBlockProps
  title?: string
}) {
  const [rendered, setRendered] = React.useState<RenderedCodeBlockData | null>(
    null,
  )

  React.useEffect(() => {
    let cancelled = false
    const key = JSON.stringify({ code, lang, title })

    getRenderPromise(key, { code, lang, title }).then((result) => {
      if (!cancelled) {
        setRendered(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [code, lang, title])

  const htmlMarkup = rendered?.htmlMarkup || buildPlainCodeBlockHtml(code)

  return (
    <CodeBlockView
      className={props.className}
      copyText={rendered?.copyText || code.trimEnd()}
      htmlMarkup={htmlMarkup}
      isEmbedded={props.isEmbedded}
      lang={rendered?.lang || lang}
      showTypeCopyButton={props.showTypeCopyButton}
      style={props.style}
      title={rendered?.title || title}
    />
  )
}
