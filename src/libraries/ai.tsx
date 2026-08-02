import { Library } from '.'
import { PlugIcon, LightningIcon, GearIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { ai } from './libraries'

const textStyles = `text-category-data`

export const aiProject = {
  ...ai,
  description: `The headless agent framework for TypeScript. TanStack AI runs the agent loop as typed primitives you compose yourself: tool calls, reasoning, human-in-the-loop interrupts, memory, and streaming state. Bring your own UI framework, model provider, server, and transport. Native AG-UI over the wire, MIT licensed, no hosted gateway and no platform to buy into.`,
  latestBranch: 'main',
  defaultDocs: 'getting-started/overview',
  featureHighlights: [
    {
      title: 'A Real Agent Loop',
      icon: <GearIcon className={twMerge(textStyles)} />,
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
      icon: <PlugIcon className={twMerge(textStyles)} />,
      description: (
        <div>
          Your provider, server, transport, auth, and deploy target. Adapters
          for OpenRouter, OpenAI, Anthropic, Gemini, Bedrock, Mistral, Groq,
          Grok/xAI, Ollama, ElevenLabs, and fal.ai, plus{' '}
          <code>openaiCompatible</code> for anything else. Import only what you
          use: every activity is a separate, tree-shakeable module.
        </div>
      ),
    },
    {
      title: 'Headless, Not Opinionated',
      icon: <LightningIcon className={twMerge(textStyles)} />,
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
