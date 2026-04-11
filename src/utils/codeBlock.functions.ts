import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as React from 'react'
import * as v from 'valibot'

export const fetchRenderedCodeBlock = createServerFn({ method: 'POST' })
  .inputValidator(
    v.object({
      code: v.string(),
      lang: v.string(),
      title: v.optional(v.string()),
    }),
  )
  .handler(async ({ data }) => {
    const { renderCodeBlockData } = await import(
      '~/components/markdown/renderCodeBlock.server'
    )

    return renderCodeBlockData(data)
  })

export const fetchRenderedCodeFile = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({
      branch: v.string(),
      filePath: v.string(),
      repo: v.string(),
    }),
  )
  .handler(async ({ data }) => {
    const [{ fetchFile }, { CodeBlock }, { getCodeBlockLanguageFromFilePath }] =
      await Promise.all([
        import('~/utils/docs.functions'),
        import('~/components/markdown/CodeBlock.server'),
        import('~/components/markdown/codeBlock.shared'),
      ])

    const code = await fetchFile({ data })
    const lang = getCodeBlockLanguageFromFilePath(data.filePath)
    const contentRsc = await renderServerComponent(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          CodeBlock,
          {
            className: 'h-full border-0',
            isEmbedded: true,
            showTypeCopyButton: false,
          },
          React.createElement('code', { className: `language-${lang}` }, code),
        ),
      ),
    )

    return {
      contentRsc,
    }
  })
