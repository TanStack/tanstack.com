import {
  renderCodeBlockData,
  tokenize,
  type HighlightLanguage,
  type HighlightToken,
  type RenderedCodeBlockData,
} from './index'

export type CodeFenceInput = {
  code: string
  lang?: string | null
  meta?: string | null
  title?: string | null
}

export type HighlightedCodeFence = RenderedCodeBlockData & {
  tokens: Array<HighlightToken>
}

export type HastText = {
  type: 'text'
  value: string
}

export type HastElement = {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: Array<HastElement | HastText>
}

export function getCodeFenceTitle(meta?: string | null) {
  if (!meta) return undefined

  const match = meta.match(
    /\b(?:title|filename|file|name)=("[^"]*"|'[^']*'|[^\s}]+)/,
  )
  if (!match) return undefined

  const value = match[1]
  const unquoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1)
      : value

  return unquoted.trim() || undefined
}

export function renderCodeFence({
  code,
  lang,
  meta,
  title,
}: CodeFenceInput): HighlightedCodeFence {
  const resolvedTitle = title || getCodeFenceTitle(meta)
  const rendered = renderCodeBlockData({
    code,
    lang: lang || undefined,
    title: resolvedTitle || undefined,
  })
  const tokenized = tokenize(rendered.copyText, { lang: lang || undefined })

  return {
    ...rendered,
    tokens: tokenized.tokens,
  }
}

export function codeFenceToHast(input: CodeFenceInput): HastElement {
  const rendered = renderCodeFence(input)

  return tokensToHast(rendered.tokens, rendered.lang)
}

export function tokensToHast(
  tokens: Array<HighlightToken>,
  lang: HighlightLanguage,
): HastElement {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {
      className: ['th-code', `th-code--${lang}`],
      dataLanguage: lang,
    },
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: tokens.map((token) => {
          if (!token.className) {
            return {
              type: 'text',
              value: token.value,
            }
          }

          return {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['th-token', `th-${token.className}`],
            },
            children: [
              {
                type: 'text',
                value: token.value,
              },
            ],
          }
        }),
      },
    ],
  }
}
