import { Library } from '.'
import { Plug, Lightning, Gear } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { ai } from './libraries'

const textStyles = `text-pink-600 dark:text-pink-500`

export const aiProject = {
  ...ai,
  description: `A powerful, open-source AI SDK with a unified interface across multiple providers. No vendor lock-in, no proprietary formats, just clean TypeScript and honest open source.`,
  latestBranch: 'main',
  bgRadial: 'from-pink-500 via-pink-700/50 to-transparent',
  textColor: `text-pink-700`,
  defaultDocs: 'getting-started/overview',
  featureHighlights: [
    {
      title: 'Provider Agnostic',
      icon: <Plug className={twMerge(textStyles)} />,
      description: (
        <div>
          Official adapters for OpenRouter, OpenAI, Anthropic, Gemini, Ollama,
          Groq, Grok/xAI, ElevenLabs, and fal.ai. Import only the adapters your
          app needs.
        </div>
      ),
    },
    {
      title: 'AG-UI Native Clients',
      icon: <Lightning className={twMerge(textStyles)} />,
      description: (
        <div>
          A headless client plus React, Vue, Solid, Svelte, and Preact bindings
          all speak the same AG-UI request and event protocol.
        </div>
      ),
    },
    {
      title: 'Typed Tools & Media',
      icon: <Gear className={twMerge(textStyles)} />,
      description: (
        <div>
          Type-safe client/server tools, provider-native tools, structured
          output, reasoning streams, image, speech, transcription, realtime
          voice, and video generation.
        </div>
      ),
    },
  ],
} satisfies Library
