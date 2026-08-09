import { createFileRoute } from '@tanstack/react-router'
import { setLlmsTxtResponseHeaders } from '~/utils/llms'
import { generateNotebookLlmsTxt } from '~/utils/notebook-environment'

export const Route = createFileRoute('/notebook_/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        setLlmsTxtResponseHeaders()

        return new Response(generateNotebookLlmsTxt())
      },
    },
  },
})
