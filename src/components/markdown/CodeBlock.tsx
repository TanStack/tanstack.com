import { defaultHighlighter } from '@tanstack/highlight'
import { renderCodeFence } from '@tanstack/highlight/markdown'
import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { CodeBlockView } from './CodeBlockView'
import {
  buildPlainCodeBlockHtml,
  extractCodeBlockData,
  type CodeBlockProps,
} from './codeBlock.shared'

const LazyMermaidBlock = React.lazy(() =>
  import('./MermaidBlock').then((m) => ({ default: m.MermaidBlock })),
)

export function CodeBlock(props: CodeBlockProps) {
  const { code, lang, title } = extractCodeBlockData(props)

  if (lang === 'mermaid') {
    const fallback = (
      <CodeBlockView
        className={props.className}
        copyText={code.trimEnd()}
        htmlMarkup={buildPlainCodeBlockHtml(code)}
        isEmbedded={props.isEmbedded}
        lang="mermaid"
        onCopySuccess={props.onCopySuccess}
        showTypeCopyButton={props.showTypeCopyButton}
        style={props.style}
        title={title}
      />
    )

    return (
      <ClientOnly fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <LazyMermaidBlock
            className={props.className}
            code={code}
            style={props.style}
            title={title}
          />
        </React.Suspense>
      </ClientOnly>
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
  const rendered = React.useMemo(() => {
    return renderCodeFence({ code, lang, title }, defaultHighlighter)
  }, [code, lang, title])

  return (
    <CodeBlockView
      className={props.className}
      copyText={rendered.copyText}
      htmlMarkup={rendered.htmlMarkup}
      isEmbedded={props.isEmbedded}
      lang={rendered.lang}
      onCopySuccess={props.onCopySuccess}
      showTypeCopyButton={props.showTypeCopyButton}
      style={props.style}
      title={rendered.title}
    />
  )
}
