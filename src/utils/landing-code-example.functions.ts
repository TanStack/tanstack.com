import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import * as React from 'react'
import * as v from 'valibot'

export const fetchLandingCodeExample = createServerFn({ method: 'GET' })
  .inputValidator(
    v.object({
      libraryId: v.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { renderLandingCodeExample } = await import(
      '~/components/landing/codeExamples.server'
    )
    const content = renderLandingCodeExample(data.libraryId)

    if (!content) {
      return null
    }

    return {
      contentRsc: await renderServerComponent(
        React.createElement(React.Fragment, null, content),
      ),
    }
  })
