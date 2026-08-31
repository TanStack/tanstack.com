import { Library } from '.'
import { Plug, Lightning, Gear } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { ai } from './libraries'

const textStyles = `text-category-data`

export const aiProject = {
  ...ai,
  description: `TanStack AI is a pluggable AI ecosystem that makes it easy for you to build AI features into your apps. Provide tools to LLMs, interrupt chat for user approval, run agents in sandboxes, build headless chat UI, stream from your server to your client, and connect to any AG-UI compatible server or client. Bring your own infrastructure. We offer the pluggable APIs to build on top of.`,
  latestBranch: 'main',
  defaultDocs: 'getting-started/overview',
  featureHighlights: [
    {
      title: 'A Real Agent Loop',
      icon: <Gear className={twMerge(textStyles)} />,
      description: (
        <div>
          <code>chat()</code> drives the loop and you control every part of it:
          isomorphic tools you place on the client or the server, composable{' '}
          <code>{`(state) => boolean`}</code> stop strategies, and interrupts
          that pause a run for human approval and resume exactly where it
          stopped, with no database required.
        </div>
      ),
    },
    {
      title: 'Bring Your Own Everything',
      icon: <Plug className={twMerge(textStyles)} />,
      description: (
        <div>
          Your provider, server, transport, auth, and deploy target. Official
          adapters for OpenRouter, OpenAI, Anthropic, Gemini, Vertex, Bedrock,
          Mistral, Groq, Grok, Ollama, Cohere, Perplexity, BytePlus, ElevenLabs,
          fal.ai, Lovable, LLM Gateway, and Vercel AI Gateway, plus{' '}
          <code>openaiCompatible</code> for anything else. Import only what you
          use: every activity is a separate, tree-shakeable module.
        </div>
      ),
    },
    {
      title: 'Headless, Not Opinionated',
      icon: <Lightning className={twMerge(textStyles)} />,
      description: (
        <div>
          A framework-free core with React, Vue, Solid, Svelte, Preact, Angular,
          and React Native bindings on top, plus official Octane bindings from
          the Octane team. All of them speak native AG-UI over SSE, HTTP
          streams, XHR, RPC, or your own transport. No components to fight, no
          styles to override.
        </div>
      ),
    },
  ],
} satisfies Library
