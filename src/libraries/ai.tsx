import { Library } from '.'
import { Plug, Zap } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { CogsIcon } from '~/components/icons/CogsIcon'
import { ai } from './libraries'

const textStyles = `text-pink-600 dark:text-pink-500`

export const aiProject = {
  ...ai,
  description: `A powerful, open-source AI SDK with a unified interface across multiple providers. No vendor lock-in, no proprietary formats, just clean TypeScript and honest open source.`,
  ogImage: 'https://github.com/tanstack/ai/raw/main/media/repo-header.png',
  latestBranch: 'main',
  bgRadial: 'from-pink-500 via-pink-700/50 to-transparent',
  textColor: `text-pink-700`,
  defaultDocs: 'getting-started/overview',
  featureHighlights: [
    {
      title: 'Multi-Provider Support',
      icon: <Plug className={twMerge(textStyles)} />,
      description: (
        <div>
          Support for OpenAI, Anthropic, Ollama, and Google Gemini. Switch
          providers at runtime without code changes. No vendor lock-in, just
          clean TypeScript.
        </div>
      ),
    },
    {
      title: 'Unified API',
      icon: <Zap className={twMerge(textStyles)} />,
      description: (
        <div>
          Same interface across all providers. Standalone functions with
          automatic type inference from adapters. Framework-agnostic client for
          any JavaScript environment.
        </div>
      ),
    },
    {
      title: 'Tool/Function Calling',
      icon: <CogsIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Automatic execution loop with no manual tool management needed.
          Type-safe tool definitions with structured outputs and streaming
          support.
        </div>
      ),
    },
  ],
} satisfies Library
