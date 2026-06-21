import { renderCodeBlockData, type RenderedCodeBlockData } from './index'

export type HighlightedCodeBlockProps = RenderedCodeBlockData & {
  className?: string
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
  style?: unknown
}

export type CreateHighlightedCodeBlockPropsOptions = {
  className?: string
  code: string
  isEmbedded?: boolean
  lang?: string
  showTypeCopyButton?: boolean
  style?: unknown
  title?: string
}

export function createHighlightedCodeBlockProps({
  className,
  code,
  isEmbedded,
  lang,
  showTypeCopyButton,
  style,
  title,
}: CreateHighlightedCodeBlockPropsOptions): HighlightedCodeBlockProps {
  return {
    ...renderCodeBlockData({ code, lang, title }),
    className,
    isEmbedded,
    showTypeCopyButton,
    style,
  }
}
