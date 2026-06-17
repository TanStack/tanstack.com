import { CodeBlockView } from './CodeBlockView'
import { MermaidBlock } from './MermaidBlock'
import type { CodeBlockProps } from './codeBlock.shared'
import { extractCodeBlockData } from './codeBlock.shared'
import { renderCodeBlockData } from './renderCodeBlock.server'

export async function CodeBlock(props: CodeBlockProps) {
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

  const rendered = await renderCodeBlockData({
    code,
    lang,
    title,
  })

  return (
    <CodeBlockView
      className={props.className}
      copyText={rendered.copyText}
      htmlMarkup={rendered.htmlMarkup}
      isEmbedded={props.isEmbedded}
      lang={rendered.lang}
      showTypeCopyButton={props.showTypeCopyButton}
      style={props.style}
      title={rendered.title}
    />
  )
}
