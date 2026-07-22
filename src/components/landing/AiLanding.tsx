import { Microphone, Plug, Radio, Robot } from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const aiLandingConfig = {
  libraryId: 'ai',
  headline: 'Own the AI stack between your UI and your models.',
  description:
    'AI is an open-source SDK for building provider-portable AI features with AG-UI-compatible clients, server helpers, typed tools, media generation, and observable runtime primitives without a hosted gateway in the middle.',
  distinction: 'Protocol-first, gateway-free AI',
  hero: {
    label: 'agent runtime',
    actionLabel: 'Run',
    detailTitle: 'One observable interaction',
    detailBody:
      'Provider events, typed tools, approvals, structured output, and media jobs stay visible from request to render.',
    items: [
      {
        key: 'chat.stream',
        title: 'AG-UI event stream',
        badge: 'live',
        activity: 92,
      },
      {
        key: 'tool.chargeCard',
        title: 'Waiting for approval',
        badge: 'hold',
        activity: 68,
      },
      {
        key: 'output.invoice',
        title: 'Structured output ready',
        badge: 'done',
        activity: 84,
      },
    ],
    facts: [
      { label: 'protocol', value: 'AG-UI' },
      { label: 'provider', value: 'portable adapter' },
      { label: 'tool approval', value: 'explicit' },
      { label: 'output', value: 'schema matched' },
    ],
  },
  features: [
    {
      icon: Radio,
      label: 'Protocol',
      title: 'Protocol first, gateway never required.',
      body: 'Clients and servers speak AG-UI-compatible requests and event streams, so teams can own their transport, runtime, and deployment shape.',
    },
    {
      icon: Plug,
      label: 'Providers',
      title: 'Providers are adapters, not the architecture.',
      body: 'Use OpenRouter, OpenAI, Anthropic, Gemini, Ollama, Groq, Grok/xAI, ElevenLabs, and fal.ai without making the app proprietary to one vendor.',
    },
    {
      icon: Robot,
      label: 'Tools',
      title: 'Tools stay typed where they run.',
      body: 'Define client, server, isomorphic, and provider-native tools with input/output types, approvals, and runtime boundaries that remain visible.',
    },
    {
      icon: Microphone,
      label: 'Media',
      title: 'Media is part of the same SDK story.',
      body: 'Text, structured output, reasoning streams, image, speech, transcription, realtime voice, and video can share provider-aware primitives.',
    },
  ],
  lifecycle: {
    label: 'Runtime pipeline',
    title: 'From UI intent to model output, every hop stays visible.',
    body: 'AI features are distributed systems wearing a chat box. The SDK gives each hop a typed place to live so the app can stream, tool call, approve, retry, observe, and render intentionally.',
    steps: [
      {
        label: 'Client',
        body: 'A headless client or framework hook starts the interaction from your UI.',
      },
      {
        label: 'Protocol',
        body: 'AG-UI request and event streams keep client/server interop explicit.',
      },
      {
        label: 'Provider',
        body: 'Adapters translate into model-specific capabilities and options.',
      },
      {
        label: 'Observe',
        body: 'Devtools, middleware, logs, and hooks make the runtime explainable.',
      },
    ],
  },
  flow: {
    label: 'Observable runtime',
    title: 'Debug the interaction, not just the final answer.',
    body: 'Tool calls, approvals, model options, provider events, structured output, middleware, and media jobs remain inspectable throughout the run.',
    steps: [
      { label: 'Client', code: 'headless client' },
      { label: 'Protocol', code: 'AG-UI events' },
      { label: 'Provider', code: 'portable adapter' },
      { label: 'Tool gate', code: 'approval: explicit' },
    ],
  },
  prompt: [
    'Build a TanStack AI feature for a TypeScript app.',
    'Use the headless client or framework adapter, AG-UI-compatible request/event streams, provider adapters, typed client/server tools, structured output, and observable runtime state without routing traffic through a hosted gateway.',
    'Show provider portability, tool approval, streaming UI, and media/realtime capabilities where useful.',
  ].join(' '),
  promptLabel: 'Copy AI prompt',
} satisfies LibraryLandingConfig

export default function AiLanding() {
  return <LibraryLanding config={aiLandingConfig} />
}
