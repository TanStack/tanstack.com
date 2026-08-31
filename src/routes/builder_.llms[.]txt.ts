import { createFileRoute } from '@tanstack/react-router'
import { setLlmsTxtResponseHeaders } from '~/utils/llms'
import { generateBuilderLlmsTxt } from '~/utils/builder-environment'

export const Route = createFileRoute('/builder_/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        setLlmsTxtResponseHeaders()

        return new Response(generateBuilderLlmsTxt())
      },
    },
  },
})
