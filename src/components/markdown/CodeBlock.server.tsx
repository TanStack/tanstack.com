import { CodeBlockView } from './CodeBlockView'
import type { CodeBlockProps } from './codeBlock.shared'
import { extractCodeBlockData } from './codeBlock.shared'
import { renderCodeBlockData } from './renderCodeBlock.server'

export async function CodeBlock(props: CodeBlockProps) {
  const { code, lang, title } = extractCodeBlockData(props)
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
