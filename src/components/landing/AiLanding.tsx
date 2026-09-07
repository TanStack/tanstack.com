import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowsDownUpIcon,
  ArrowsLeftRightIcon,
  BracketsCurlyIcon,
  BugIcon,
  CodeIcon,
  CubeIcon,
  DatabaseIcon,
  HardDrivesIcon,
  LayoutIcon,
  MicrophoneIcon,
  PlugIcon,
  RadioIcon,
  RobotIcon,
  ScalesIcon,
  TerminalIcon,
  WaveformIcon,
  type Icon,
} from '@phosphor-icons/react'

import { getLibrary } from '~/libraries'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const aiPrompt = [
  'Build me a TanStack Start app using TanStack AI as its driver to showcase AI features, if run inside of an existing app then add a single new page and endpoint to showcase the power of TanStack AI.',
  'Drive the agent loop with chat(): isomorphic tools via toolDefinition().server() / .client(), add at least 1 tool on the server and on the client, use the headless UI features to build the UI, add a tool that needs approval.',
  'Reach for the rest of the stack only when the task needs it: Code Mode in an isolate for multi-tool orchestration, a sandboxed coding-agent harness, @tanstack/ai-mcp for MCP servers, memoryMiddleware for cross-session recall, @tanstack/ai-persistence for durable threads and resumable streams.',
  'Never introduce a hosted gateway, a prescribed UI kit, or a provider-specific wire format. Keep provider capabilities honest: model options, tool support, and modality-specific results stay typed at the adapter boundary, and media or realtime primitives appear only where the selected model supports them.',
].join(' ')

const providers = [
  {
    name: 'OpenRouter',
    model: 'any of 300+ models',
    capabilities: ['text', 'reasoning', 'tools', 'image'],
  },
  {
    name: 'OpenAI',
    model: 'gpt-5',
    capabilities: ['text', 'reasoning', 'tools', 'image'],
  },
  {
    name: 'Anthropic',
    model: 'claude-sonnet-4',
    capabilities: ['text', 'reasoning', 'tools'],
  },
  {
    name: 'Gemini',
    model: 'gemini-2.5-pro',
    capabilities: ['text', 'reasoning', 'tools', 'media'],
  },
  {
    name: 'Ollama',
    model: 'local model',
    capabilities: ['text', 'tools'],
  },
]

type AiHeroServer = {
  detail?: string
  dotted?: boolean
  kind?: 'tanstack'
  label: string
}

type GraphNodePosition = {
  height: number
  label: string
  width: number
  x: number
  y: number
}

type GraphPoint = {
  x: number
  y: number
}

const aiHeroClients = [
  'Vanilla',
  'React',
  'Vue',
  'Solid',
  'Svelte',
  'Preact',
  'Angular',
  'Octane',
]
const aiHeroServers: Array<AiHeroServer> = [
  { label: 'TanStack AI', detail: 'Server', kind: 'tanstack' },
  { label: 'Python', dotted: true },
  { label: 'Go', dotted: true },
  { label: 'PHP', dotted: true },
]
const aiHeroProviders = ['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini']
// ponytail: 8 clients on a fixed 4x2 grid; recompute the columns if the list changes length
const graphClientNodes = aiHeroClients.map((label, index) => ({
  label,
  x: [10, 112, 214, 316][index % 4] ?? 112,
  y: index < 4 ? 36 : 84,
  width: 94,
  height: 36,
}))
const graphAgUiNode: GraphNodePosition & {
  kind: 'tanstack'
} = {
  label: 'TanStack AI Client',
  kind: 'tanstack',
  x: 142,
  y: 138,
  width: 136,
  height: 58,
}
const graphServerNodes = aiHeroServers.map((server, index) => ({
  ...server,
  x: [38, 178, 254, 326][index] ?? 178,
  y: index === 0 ? 254 : 260,
  width: index === 0 ? 124 : 56,
  height: index === 0 ? 54 : 42,
}))
const graphProviderNodes = aiHeroProviders.map((label, index) => ({
  label,
  x: 18 + index * 98,
  y: 352,
  width: 78,
  height: 34,
}))
const aiHeroMessages = [
  {
    user: 'Build the invoice agent on our stack, not yours.',
    assistant:
      'Done. Headless client in your app, the agent loop on your server, AG-UI between them. No gateway, no hosted state.',
  },
  {
    user: 'It should ask before it charges a card.',
    assistant:
      'chargeCard is marked needsApproval, so the run ends as an interrupt. Resolve it and the loop continues from that exact step.',
  },
  {
    user: 'And if we move off this provider?',
    assistant:
      'Swap the adapter. Your tools, events, and UI never learn the difference.',
  },
]

// ponytail: the shared --landing-accent-ink is pure black, which reads badly on the
// orange accent fill. Darken the fill instead and use white text on it.
const accentFillClass =
  'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--landing-accent)_84%,black),color-mix(in_srgb,var(--landing-accent)_52%,black))] text-white'

function AdapterDocsLink() {
  const { version } = useParams({ strict: false })
  const library = getLibrary('ai')

  return (
    <Link
      to="/$libraryId/$version/docs/$"
      params={{
        libraryId: library.id,
        version: version ?? library.latestVersion,
        _splat: 'getting-started/overview',
      }}
      className="text-[var(--landing-accent-bright)] underline decoration-[color:rgb(var(--landing-glow)/0.45)] underline-offset-2 hover:decoration-[var(--landing-accent-bright)]"
    >
      See the adapter docs for more.
    </Link>
  )
}

type AiHeroChatMessage = {
  assistant: string
  id: string
  isStreaming: boolean
  user: string
}

export default function AiLanding() {
  return (
    <LibraryLandingShell
      libraryId="ai"
      headline="We build the parts you shouldn't. You own the parts you must."
      description="TanStack AI gives you composable building blocks for everything you should not write yourself: the agent loop, provider adapters, durability, interrupts, sandboxes, and tools. It leaves you everything a one-size-fits-all framework gets wrong the moment you are past a prototype: your server, your database, your UI."
      hero={<AiGraphChatHero />}
      prompt={aiPrompt}
      promptLabel="Copy AI prompt"
    >
      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Who owns what"
          icon={<ScalesIcon aria-hidden="true" size={15} />}
          title="One rule decides every API."
          body="If it is hard to get right and identical in every app, we own it. If it stops fitting the day your app is no longer a prototype, you own it and we hand you typed helpers. Nothing here is a wrapper around a service we run."
        />
        <OwnershipMap />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="You own the server"
            icon={<TerminalIcon aria-hidden="true" size={15} />}
            title="One call, one Response, any framework."
            body="chat() takes messages and returns a stream. Turn it into a Response and return it from whatever route you already have. Auth, rate limits, and the deploy target stay in your code, where you can see them."
          />
          <ServerRoutes />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="You own persistence"
          icon={<DatabaseIcon aria-hidden="true" size={15} />}
          title="Your database. Your schema. Two functions."
          body="A framework that owns your tables is great until you need soft delete, archiving, or a column it never imagined. So the core never sees your schema. Load a thread, save a thread, and the transcript, run status, and pending approvals land wherever you point them."
        />
        <PersistenceContract />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Durability you can move"
            icon={<HardDrivesIcon aria-hidden="true" size={15} />}
            title="A stream survives the reload. The log is yours."
            body="Every chunk is written to a log before it is delivered. Drop the socket, refresh the page, open a second tab, and the client replays from its last offset instead of paying for the model again. Start in memory, move to a hosted log, or write five methods against the store you already run."
          />
          <DurabilityTiers />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <MessageParts />
          <LandingSectionIntro
            eyebrow="You own the UI"
            icon={<LayoutIcon aria-hidden="true" size={15} />}
            title="Typed parts, honest states, no components to fight."
            body="A message is a list of parts, and every part carries its own lifecycle. Text streams, a tool call moves through input, approval, and result, and an error is a state rather than an exception you missed. Render them yourself or register one component per part type."
          />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="We handle tools"
            icon={<BracketsCurlyIcon aria-hidden="true" size={15} />}
            title="Define a tool once. Run it on either side."
            body="One schema gives you the input and output types on the server and the client. The loop calls the tool, pauses for approval when you ask it to, applies the user's edits, and feeds the result back to the model."
          />
          <ToolBoundary />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <ProviderWorkbench />
          <LandingSectionIntro
            eyebrow="We handle providers"
            icon={<PlugIcon aria-hidden="true" size={15} />}
            title="Swap the model. Keep the types."
            body={
              <>
                Connect directly to OpenAI, Anthropic, Gemini, Bedrock, Ollama,
                and the rest, or through the gateway you choose, and
                openaiCompatible covers any endpoint with the same shape.{' '}
                <AdapterDocsLink /> Each model's options, modalities, and native
                tools are typed, so an unsupported option fails at compile time.
              </>
            }
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Open protocol"
          icon={<RadioIcon aria-hidden="true" size={15} />}
          title="AG-UI in both directions."
          body="The client speaks AG-UI with no proprietary stream format in between, so the agent on the other end is replaceable: point it at a Python, Go, or PHP runtime and it keeps working. SSE, HTTP streams, XHR, RPC, or a fetcher you wrote. No TanStack service sits in the request path."
        />
        <ProtocolMap />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <LandingSectionIntro
            eyebrow="We handle the hard parts"
            icon={<CubeIcon aria-hidden="true" size={15} />}
            title="Sandboxes, Code Mode, MCP, memory, compaction."
            body="Each one is a separate package with the same shape as the core. Reach for it when the task needs it, and leave it out of the bundle when it does not."
          />
          <FeatureRail items={agentStack} />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <LandingSectionIntro
            eyebrow="Beyond chat"
            icon={<MicrophoneIcon aria-hidden="true" size={15} />}
            title="Images, video, speech, and realtime voice."
            body="The same adapters and the same persistence cover every modality, with progress updates and cost tracking built in."
          />
          <FeatureRail items={modalities} />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
          <LandingSectionIntro
            eyebrow="Devtools"
            icon={<BugIcon aria-hidden="true" size={15} />}
            title="See every action on both sides."
            body="Every tool call, interrupt, memory recall, and finish reason, on the server and in the client, in one timeline."
          />
          <DevtoolsPanel />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Start here"
          icon={<ArrowRightIcon aria-hidden="true" size={15} />}
          title="Pick the page that matches your next hour."
          body="Each one is a short guide with copyable code, not a tour."
        />
        <StartingPoints />
      </LandingSection>
    </LibraryLandingShell>
  )
}

const codeWindowClass =
  'm-0 min-w-0 rounded-none border-0 [&>div:first-child]:rounded-none [&_pre]:max-h-[26rem] [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs'

function CodeTabs({
  label,
  samples,
}: {
  label: string
  samples: Array<{ code: string; file: string; name: string }>
}) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const sample = samples[activeIndex] ?? samples[0]

  return (
    <LandingWindow label={label}>
      <div
        className="flex gap-1 border-b border-border-subtle p-2"
        role="tablist"
      >
        {samples.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className="rounded-lg px-3 py-1.5 text-ds-label-sm text-text-primary/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-selected:bg-[color:rgb(var(--landing-glow)/0.14)] aria-selected:text-[var(--landing-accent-bright)]"
            onClick={() => setActiveIndex(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <CodeBlock
        key={sample.file}
        dataCodeTitle={sample.file}
        className={codeWindowClass}
        showTypeCopyButton={false}
      >
        <code className="language-ts">{sample.code}</code>
      </CodeBlock>
    </LandingWindow>
  )
}

const ownership = {
  handled: [
    {
      label: 'Agent loop',
      body: 'Tool calls, stop conditions, and every model round-trip. Easy to start, wrong in a hundred small ways.',
    },
    {
      label: 'Providers',
      body: 'Every major provider behind one call, each model typed down to its options and modalities.',
    },
    {
      label: 'Durability',
      body: 'A dropped socket, a reload, or a restart replays from a log. The model is never re-run.',
    },
    {
      label: 'Interrupts',
      body: 'A run pauses for a human, then resumes at the exact step with their edits applied.',
    },
    {
      label: 'Sandboxes',
      body: 'Coding agents and Code Mode run in an isolate or a container. Their activity is ordinary events.',
    },
    {
      label: 'Tools',
      body: 'One schema, typed on both ends, executed on the server or the client.',
    },
  ],
  owned: [
    {
      label: 'Server',
      body: 'Any route, any runtime. Your auth check sits next to the call, not behind a config flag.',
    },
    {
      label: 'Persistence',
      body: 'Your database and your schema. Two store functions are the whole contract.',
    },
    {
      label: 'UI',
      body: 'Typed messages, parts, and states. You render them.',
    },
    {
      label: 'Deploy',
      body: 'Your requests, credentials, and data never pass through TanStack.',
    },
  ],
}

function OwnershipMap() {
  return (
    <div className="mt-14 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <OwnershipColumn
        eyebrow="TanStack AI handles"
        items={ownership.handled}
        note="Hard to get right, the same in every app, and a bug in any of them costs you a user or a bill."
      />
      <OwnershipColumn
        eyebrow="You own"
        items={ownership.owned}
        note="A framework managing these feels great in a prototype and becomes a wall the day you need one thing it did not anticipate."
      />
    </div>
  )
}

function OwnershipColumn({
  eyebrow,
  items,
  note,
}: {
  eyebrow: string
  items: Array<{ body: string; label: string }>
  note: string
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border-default bg-background-surface">
      <p className="border-b border-border-subtle px-5 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
        {eyebrow}
      </p>
      <ul className="grid flex-1 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="border-b border-border-subtle p-5 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:border-r"
          >
            <p className="text-ds-label-md text-text-primary">{item.label}</p>
            <p className="mt-1.5 text-ds-body-xs text-text-primary/45">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-border-subtle px-5 py-3 text-ds-body-xs text-text-primary/35">
        {note}
      </p>
    </div>
  )
}

const serverRoutes = [
  {
    name: 'TanStack Start',
    file: 'routes/api.chat.ts',
    code: `import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import { createFileRoute } from '@tanstack/react-router'
import { lookupInvoice } from './tools'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = await request.json()

        const stream = chat({
          adapter: openRouterText('anthropic/claude-sonnet-4.5'),
          messages,
          tools: [lookupInvoice],
        })

        return toServerSentEventsResponse(stream)
      },
    },
  },
})`,
  },
  {
    name: 'Next.js',
    file: 'app/api/chat/route.ts',
    code: `import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import { lookupInvoice } from './tools'

export async function POST(request: Request) {
  const { messages } = await request.json()

  const stream = chat({
    adapter: openRouterText('anthropic/claude-sonnet-4.5'),
    messages,
    tools: [lookupInvoice],
  })

  return toServerSentEventsResponse(stream)
}`,
  },
  {
    name: 'Hono',
    file: 'server.ts',
    code: `import { Hono } from 'hono'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import { lookupInvoice } from './tools'

const app = new Hono()

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()

  const stream = chat({
    adapter: openRouterText('anthropic/claude-sonnet-4.5'),
    messages,
    tools: [lookupInvoice],
  })

  return toServerSentEventsResponse(stream)
})`,
  },
]

function ServerRoutes() {
  return <CodeTabs label="your route" samples={serverRoutes} />
}

const persistenceContract = `import { defineAIPersistence, defineMessageStore } from '@tanstack/ai-persistence'
import { db } from './db'

// The whole contract. Your tables, your columns, your types.
export const persistence = defineAIPersistence({
  stores: {
    messages: defineMessageStore({
      loadThread: (threadId) => db.threads.messages(threadId),
      saveThread: (threadId, messages) => db.threads.save(threadId, messages),
    }),
  },
})

// chat({ ..., middleware: [withPersistence(persistence)] })`

const persistenceStores = [
  'Postgres',
  'MySQL',
  'SQLite',
  'MongoDB',
  'Cloudflare D1',
  'Redis',
  'Drizzle',
  'Prisma',
  'localStorage',
  'IndexedDB',
]

function PersistenceContract() {
  return (
    <div className="mt-14 flex flex-col items-center gap-6">
      <ul
        className="flex flex-wrap justify-center gap-2"
        aria-label="Works with"
      >
        {persistenceStores.map((store) => (
          <li
            key={store}
            className="rounded-full border border-border-subtle px-3 py-1.5 font-ds-mono text-ds-mono-2xs text-text-primary/45"
          >
            {store}
          </li>
        ))}
      </ul>
      <LandingWindow className="w-full max-w-[46rem]" label="persistence.ts">
        <CodeBlock className={codeWindowClass} showTypeCopyButton={false}>
          <code className="language-ts">{persistenceContract}</code>
        </CodeBlock>
      </LandingWindow>
      <p className="max-w-[40rem] text-center text-ds-body-xs text-text-primary/35">
        Add a runs store to rejoin a run after a reload and an interrupts store
        to hold an approval for days. Start with memoryPersistence() on the
        server or localStoragePersistence() in the browser, and swap it out
        without touching the route.
      </p>
    </div>
  )
}

const durabilityTiers = [
  {
    name: 'In memory',
    file: 'routes/api.chat.ts',
    code: `import { memoryStream, toServerSentEventsResponse } from '@tanstack/ai'

// Development and single-process apps. Zero setup.
export async function POST(request: Request) {
  const stream = chat({ /* ... */ })

  return toServerSentEventsResponse(stream, {
    durability: { adapter: memoryStream(request) },
  })
}`,
  },
  {
    name: 'Hosted log',
    file: 'routes/api.chat.ts',
    code: `import { toServerSentEventsResponse } from '@tanstack/ai'
import { durableStream } from '@tanstack/ai-durable-stream'

// Many processes, many regions. The route does not change.
export async function POST(request: Request) {
  const stream = chat({ /* ... */ })

  return toServerSentEventsResponse(stream, {
    durability: {
      adapter: durableStream(request, { server: process.env.DURABLE_STREAMS_URL }),
    },
  })
}`,
  },
  {
    name: 'Your store',
    file: 'redis-stream.ts',
    code: `import type { StreamDurability } from '@tanstack/ai'

// Five methods against anything: Redis, Postgres, a queue.
// Offsets are opaque strings. Core never reads your store.
export function redisStream(request: Request): StreamDurability {
  const key = runKey(request)

  return {
    resumeFrom: () => resumeOffset(request),
    append: (chunks) => appendAll(key, chunks),
    read: (offset, signal) => readAfter(key, offset, signal),
    snapshot: () => readAll(key),
    close: () => markDone(key),
  }
}`,
  },
]

function DurabilityTiers() {
  return <CodeTabs label="stream durability" samples={durabilityTiers} />
}

const toolCallStates = [
  'awaiting-input',
  'input-streaming',
  'input-complete',
  'approval-requested',
  'approval-responded',
  'complete',
] as const

function MessageParts() {
  const [stateIndex, setStateIndex] = React.useState(toolCallStates.length - 1)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const intervalId = window.setInterval(() => {
      setStateIndex((current) => (current + 1) % toolCallStates.length)
    }, 1400)

    return () => window.clearInterval(intervalId)
  }, [])

  const toolState = toolCallStates[stateIndex] ?? 'complete'
  const parts = [
    {
      type: 'thinking',
      detail: 'Checking the invoice before answering.',
      state: 'complete',
    },
    {
      type: 'tool-call',
      detail: 'lookup_invoice({ id: "inv_2231" })',
      state: toolState,
    },
    // The result and the reply only exist once the call is complete.
    ...(toolState === 'complete'
      ? [
          {
            type: 'tool-result',
            detail: '{ total: 1240, status: "paid" }',
            state: 'complete',
          },
          {
            type: 'text',
            detail: 'Invoice 2231 was paid in full on',
            state: 'streaming',
          },
        ]
      : []),
  ]

  return (
    <LandingWindow label="message.parts">
      <ul className="divide-y divide-border-subtle" aria-live="polite">
        {parts.map((part) => (
          <li
            key={part.type}
            className="grid gap-1 p-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4"
          >
            <span className="font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
              {part.type}
            </span>
            <span className="truncate font-ds-mono text-ds-mono-xs text-text-primary/70">
              {part.detail}
              {part.state === 'streaming' ? (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-[var(--landing-accent-bright)] align-middle motion-reduce:animate-none" />
              ) : null}
            </span>
            <span
              className={
                part.state === 'complete'
                  ? 'rounded-full border border-border-subtle px-2.5 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/35'
                  : 'rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] px-2.5 py-1 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]'
              }
            >
              {part.state}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border-subtle p-4">
        <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
          tool-call lifecycle
        </p>
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {toolCallStates.map((state, index) => (
            <li
              key={state}
              className={
                index === stateIndex
                  ? 'rounded-md bg-[color:rgb(var(--landing-glow)/0.18)] px-2 py-1 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]'
                  : index < stateIndex
                    ? 'rounded-md px-2 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/45'
                    : 'rounded-md px-2 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/20'
              }
            >
              {state}
            </li>
          ))}
          <li className="rounded-md px-2 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/20">
            error
          </li>
        </ol>
      </div>
    </LandingWindow>
  )
}

function AiGraphChatHero() {
  const [activeClient, setActiveClient] = React.useState(0)
  const [activeServer, setActiveServer] = React.useState(0)
  const [activeProvider, setActiveProvider] = React.useState(0)
  const [chatMessages, setChatMessages] = React.useState<
    Array<AiHeroChatMessage>
  >([])
  const [typingUserMessage, setTypingUserMessage] = React.useState('')
  const activeServerNode = graphServerNodes[activeServer] ?? graphServerNodes[0]
  const chatScrollRef = React.useRef<HTMLDivElement>(null)
  const chatLockedToBottomRef = React.useRef(true)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const clientIntervalId = window.setInterval(() => {
      setActiveClient((current) => (current + 1) % aiHeroClients.length)
    }, 2300)
    const serverIntervalId = window.setInterval(() => {
      setActiveServer((current) => (current + 1) % aiHeroServers.length)
    }, 3300)
    const providerIntervalId = window.setInterval(() => {
      setActiveProvider((current) => (current + 1) % aiHeroProviders.length)
    }, 4100)

    return () => {
      window.clearInterval(clientIntervalId)
      window.clearInterval(serverIntervalId)
      window.clearInterval(providerIntervalId)
    }
  }, [])

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const message = aiHeroMessages[0]

      setChatMessages([
        {
          ...message,
          id: 'reduced-motion-example',
          isStreaming: false,
        },
      ])
      return
    }

    let cancelled = false
    const timeouts: Array<number> = []

    const addTimeout = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(callback, delay)
      timeouts.push(timeoutId)
    }

    const streamAssistantResponse = (
      id: string,
      response: string,
      onComplete: () => void,
    ) => {
      let currentIndex = 0

      const streamChunk = () => {
        if (cancelled) {
          return
        }

        if (currentIndex < response.length) {
          const chunkSize = 2 + Math.floor(Math.random() * 7)
          const nextIndex = Math.min(currentIndex + chunkSize, response.length)
          const nextText = response.slice(0, nextIndex)

          setChatMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === id
                ? { ...message, assistant: nextText, isStreaming: true }
                : message,
            ),
          )

          currentIndex = nextIndex
          addTimeout(streamChunk, 22 + Math.floor(Math.random() * 58))
          return
        }

        setChatMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === id ? { ...message, isStreaming: false } : message,
          ),
        )
        addTimeout(onComplete, 1600)
      }

      addTimeout(streamChunk, 450)
    }

    const typeUserMessage = (
      messageIndex: number,
      onComplete: (id: string) => void,
    ) => {
      const message = aiHeroMessages[messageIndex]
      let currentIndex = 0

      setTypingUserMessage('')

      const typeChar = () => {
        if (cancelled) {
          return
        }

        if (currentIndex < message.user.length) {
          currentIndex += 1
          setTypingUserMessage(message.user.slice(0, currentIndex))
          addTimeout(typeChar, 30 + Math.floor(Math.random() * 40))
          return
        }

        addTimeout(() => {
          const id = `${messageIndex}-${Date.now()}`

          setTypingUserMessage('')
          setChatMessages((currentMessages) => [
            ...currentMessages.slice(-1),
            {
              assistant: '',
              id,
              isStreaming: true,
              user: message.user,
            },
          ])
          onComplete(id)
        }, 320)
      }

      typeChar()
    }

    const playMessage = (messageIndex: number) => {
      if (cancelled) {
        return
      }

      const nextMessageIndex = messageIndex % aiHeroMessages.length
      const message = aiHeroMessages[nextMessageIndex]

      typeUserMessage(nextMessageIndex, (id) => {
        streamAssistantResponse(id, message.assistant, () => {
          playMessage(nextMessageIndex + 1)
        })
      })
    }

    addTimeout(() => playMessage(0), 700)

    return () => {
      cancelled = true
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [])

  React.useEffect(() => {
    const element = chatScrollRef.current
    if (!element) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight

      chatLockedToBottomRef.current = distanceFromBottom < 72
    }

    element.addEventListener('scroll', handleScroll, { passive: true })
    return () => element.removeEventListener('scroll', handleScroll)
  }, [])

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const element = chatScrollRef.current

      if (element && chatLockedToBottomRef.current) {
        element.scrollTop = element.scrollHeight
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [chatMessages])

  return (
    <div className="grid w-full min-w-0 max-w-full items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <span className="sr-only">
        A client graph shows eight UI adapters converging on the TanStack AI
        Client over AG-UI, then reaching an agent runtime in TypeScript, Python,
        Go, or PHP, and interchangeable model providers.
      </span>

      <LandingWindow label="client graph">
        <div
          aria-hidden="true"
          className="relative h-[23rem] overflow-hidden bg-background-default [container-type:inline-size] sm:h-[26rem]"
        >
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgb(var(--landing-glow)/0.18)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--landing-glow)/0.18)_1px,transparent_1px)] [background-size:28px_28px]" />
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 420 420"
          >
            {graphClientNodes.map((node, index) => (
              <GraphLine
                key={`client-${node.label}`}
                active={activeClient === index}
                d={curveBetween(
                  bottomAnchor(node),
                  topAnchor(graphAgUiNode),
                  0.45,
                )}
              />
            ))}
            {graphServerNodes.map((node, index) => (
              <GraphLine
                key={`server-${node.label}`}
                active={index === activeServer}
                d={curveBetween(
                  bottomAnchor(graphAgUiNode),
                  topAnchor(node),
                  0.5,
                )}
              />
            ))}
            {graphProviderNodes.map((node, index) => (
              <GraphLine
                key={`provider-${node.label}`}
                active={activeProvider === index}
                d={curveBetween(
                  bottomAnchor(activeServerNode),
                  topAnchor(node),
                  0.55,
                )}
              />
            ))}
          </svg>

          <GraphLabel x={18} y={24}>
            client
          </GraphLabel>
          <GraphLabel x={50} y={236}>
            server / runtime
          </GraphLabel>
          <GraphLabel x={18} y={328}>
            provider
          </GraphLabel>

          {graphClientNodes.map((node, index) => (
            <GraphNode
              key={node.label}
              active={index === activeClient}
              label={node.label}
              node={node}
            />
          ))}
          <GraphNode
            active
            kind={graphAgUiNode.kind}
            label={graphAgUiNode.label}
            node={graphAgUiNode}
          />
          {graphServerNodes.map((node, index) => (
            <GraphNode
              key={node.label}
              active={index === activeServer}
              detail={node.detail}
              dotted={node.dotted}
              kind={node.kind}
              label={node.label}
              node={node}
            />
          ))}
          {graphProviderNodes.map((node, index) => (
            <GraphNode
              key={node.label}
              active={index === activeProvider}
              label={node.label}
              node={node}
            />
          ))}
        </div>
      </LandingWindow>

      <LandingWindow label="chat runtime">
        <div
          aria-hidden="true"
          className="flex h-[23rem] min-w-0 flex-col bg-background-default sm:h-[26rem]"
        >
          <div
            ref={chatScrollRef}
            className="fade-y fade-size-y-sm min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-h-full flex-col justify-end gap-2.5 p-4">
              {chatMessages.map((message) => (
                <React.Fragment key={message.id}>
                  <div
                    className={`ml-auto max-w-[86%] rounded-xl px-3 py-2 text-ds-body-xs shadow-sm ${accentFillClass}`}
                  >
                    {message.user}
                  </div>
                  {message.assistant || message.isStreaming ? (
                    <div className="max-w-[90%] rounded-xl border border-border-default bg-background-subtle px-3 py-2 text-ds-body-xs text-text-primary/65 shadow-sm">
                      {message.assistant}
                      {message.isStreaming ? (
                        <span className="ml-1 inline-block h-3.5 w-1 rounded-sm bg-[var(--landing-accent)] align-[-0.2rem] motion-safe:animate-pulse" />
                      ) : null}
                    </div>
                  ) : null}
                </React.Fragment>
              ))}
              <div className="grid gap-2 pt-2 font-ds-mono text-ds-mono-2xs sm:grid-cols-2">
                {[
                  ['event', 'text content'],
                  ['tool', 'approval gate'],
                  ['provider', aiHeroProviders[activeProvider]],
                  [
                    'runtime',
                    aiHeroServers[activeServer]?.label ?? 'TanStack AI',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-background-subtle px-3 py-2"
                  >
                    <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                      {label}
                    </p>
                    <p className="mt-1 truncate text-[var(--landing-accent-bright)]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border-subtle p-4">
            <div
              className={
                typingUserMessage
                  ? 'rounded-lg border border-[var(--landing-accent)] bg-background-subtle px-3 py-2 text-ds-body-xs text-text-primary ring-1 ring-[color:rgb(var(--landing-glow)/0.3)]'
                  : 'rounded-lg border border-border-default bg-background-subtle px-3 py-2 text-ds-body-xs text-text-primary/30'
              }
            >
              {typingUserMessage || 'Type a message...'}
              {typingUserMessage ? (
                <span className="ml-1 inline-block h-4 w-1 rounded-sm bg-[var(--landing-accent)] align-[-0.2rem] motion-safe:animate-pulse" />
              ) : null}
            </div>
          </div>
        </div>
      </LandingWindow>
    </div>
  )
}

function topAnchor(node: GraphNodePosition): GraphPoint {
  return {
    x: node.x + node.width / 2,
    y: node.y,
  }
}

function bottomAnchor(node: GraphNodePosition): GraphPoint {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height,
  }
}

function curveBetween(start: GraphPoint, end: GraphPoint, bend = 0.5): string {
  if (Math.abs(end.y - start.y) > Math.abs(end.x - start.x)) {
    const controlY = start.y + (end.y - start.y) * bend

    return `M ${start.x} ${start.y} C ${start.x} ${controlY}, ${end.x} ${controlY}, ${end.x} ${end.y}`
  }

  const controlX = start.x + (end.x - start.x) * bend
  return `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`
}

function graphStyle(node: GraphNodePosition): React.CSSProperties {
  return {
    height: `${(node.height / 420) * 100}%`,
    left: `${(node.x / 420) * 100}%`,
    top: `${(node.y / 420) * 100}%`,
    width: `${(node.width / 420) * 100}%`,
  }
}

function GraphLine({ active, d }: { active?: boolean; d: string }) {
  return (
    <path
      d={d}
      fill="none"
      strokeLinecap="round"
      strokeWidth={active ? 3 : 1.5}
      className={
        active
          ? 'stroke-[var(--landing-accent-bright)] transition-all duration-500 motion-reduce:transition-none'
          : 'stroke-text-primary/15 transition-all duration-500 motion-reduce:transition-none'
      }
      style={{
        filter: active
          ? 'drop-shadow(0 0 4px rgb(var(--landing-glow) / 0.72))'
          : undefined,
      }}
    />
  )
}

function GraphLabel({
  children,
  x,
  y,
}: {
  children: React.ReactNode
  x: number
  y: number
}) {
  return (
    <div
      className="absolute z-10 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25"
      style={{
        left: `${(x / 420) * 100}%`,
        top: `${(y / 420) * 100}%`,
      }}
    >
      {children}
    </div>
  )
}

function GraphNode({
  active,
  detail,
  dotted,
  kind,
  label,
  node,
}: {
  active?: boolean
  detail?: string
  dotted?: boolean
  kind?: 'tanstack'
  label: string
  node: GraphNodePosition
}) {
  const isTanStack = kind === 'tanstack'
  const className = isTanStack
    ? active
      ? `absolute z-20 flex flex-col items-center justify-center rounded-lg border-2 border-[var(--landing-accent)] px-2 text-center font-ds-mono text-ds-mono-2xs shadow-[0_12px_28px_rgb(var(--landing-glow)/0.28)] ring-2 ring-[color:rgb(var(--landing-glow)/0.24)] transition-all duration-500 motion-reduce:transition-none ${accentFillClass}`
      : 'absolute z-20 flex flex-col items-center justify-center rounded-lg border-2 border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.15)] px-2 text-center font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)] transition-all duration-500 motion-reduce:transition-none'
    : active
      ? 'absolute z-20 flex flex-col items-center justify-center rounded-lg border border-text-primary bg-text-primary px-2 text-center font-ds-mono text-ds-mono-2xs text-background-default shadow-sm transition-all duration-500 motion-reduce:transition-none'
      : dotted
        ? 'absolute z-20 flex flex-col items-center justify-center rounded-lg border border-dashed border-text-primary/25 bg-background-subtle/80 px-2 text-center font-ds-mono text-ds-mono-2xs text-text-primary/30 transition-all duration-500 motion-reduce:transition-none'
        : 'absolute z-20 flex flex-col items-center justify-center rounded-lg border border-border-default bg-background-subtle/90 px-2 text-center font-ds-mono text-ds-mono-2xs text-text-primary/40 transition-all duration-500 motion-reduce:transition-none'

  return (
    <div style={graphStyle(node)} className={className}>
      <span>{label}</span>
      {detail ? (
        <span className="mt-0.5 block font-ds-mono text-ds-mono-caps-xs uppercase opacity-65">
          {detail}
        </span>
      ) : null}
    </div>
  )
}

function ToolBoundary() {
  const [boundary, setBoundary] = React.useState<'client' | 'server'>('server')
  const boundaries: Array<'client' | 'server'> = ['client', 'server']

  return (
    <LandingWindow label="tool contract">
      <div className="p-5 sm:p-6">
        <div
          className="flex gap-2"
          role="group"
          aria-label="Tool execution boundary"
        >
          {boundaries.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={boundary === option}
              className="flex-1 rounded-lg border border-border-default px-3 py-2 text-ds-label-sm capitalize text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setBoundary(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs text-white/65">
          <p>
            <span className="text-pink-300">const</span> lookupInvoice =
            toolDefinition({'{'}
          </p>
          <p>&nbsp;&nbsp;name: 'lookup_invoice',</p>
          <p>
            &nbsp;&nbsp;inputSchema: z.object({'{'} id: z.string() {'}'}),
          </p>
          <p>&nbsp;&nbsp;outputSchema: invoiceSchema,</p>
          <p>&nbsp;&nbsp;needsApproval: true,</p>
          <p>{'}'})</p>
          {boundary === 'client' ? (
            <>
              <p className="text-[var(--landing-accent-bright)]">
                lookupInvoice.client(async ({'{'} id {'}'}) =&gt; {'{'}
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;
                {`const url = new URL(\`/invoices/\${id}\`, window.location.origin)`}
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;window.history.pushState({'{'} id {'}'}, '', url)
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;return {'{'} id, href: url.pathname {'}'}
              </p>
              <p className="text-[var(--landing-accent-bright)]">{'})'}</p>
            </>
          ) : (
            <>
              <p className="text-[var(--landing-accent-bright)]">
                lookupInvoice.server(async ({'{'} id {'}'}) =&gt; {'{'}
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;return db.invoices.update({'{'}
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;&nbsp;&nbsp;where: {'{'} id {'}'},
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;&nbsp;&nbsp;data: {'{'} lastViewedAt: new Date(){' '}
                {'}'},
              </p>
              <p className="text-[var(--landing-accent-bright)]">
                &nbsp;&nbsp;{'}'})
              </p>
              <p className="text-[var(--landing-accent-bright)]">{'})'}</p>
            </>
          )}
        </div>
        <p
          className="mt-4 text-ds-body-xs text-text-primary/35"
          aria-live="polite"
        >
          {boundary === 'client'
            ? 'The client implementation uses the typed id to call a browser API. The loop waits for it and feeds the result back to the model.'
            : 'The server implementation uses the same typed id to update a row in your database. The model never sees your credentials.'}
        </p>
      </div>
    </LandingWindow>
  )
}

function ProviderWorkbench() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const provider = providers[activeIndex] ?? providers[0]

  return (
    <LandingWindow label="provider capability types">
      <div className="grid sm:grid-cols-[10rem_1fr]">
        <div className="border-border-subtle p-3 sm:border-r">
          {providers.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === activeIndex}
              className="mb-1 block w-full rounded-lg px-3 py-2 text-left text-ds-label-sm text-text-primary/35 hover:bg-text-primary/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="p-5" aria-live="polite">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
            selected model
          </p>
          <p className="mt-2 font-ds-mono text-ds-mono-xs text-text-primary">
            {provider.model}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['text', 'reasoning', 'tools', 'image', 'media'].map(
              (capability) => {
                const supported = provider.capabilities.includes(capability)
                return (
                  <span
                    key={capability}
                    className={
                      supported
                        ? 'rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] px-3 py-1.5 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]'
                        : 'rounded-full border border-border-subtle px-3 py-1.5 font-ds-mono text-ds-mono-2xs text-text-primary/20 line-through'
                    }
                  >
                    {capability}
                  </span>
                )
              },
            )}
          </div>
          <p className="mt-6 text-ds-body-xs text-text-primary/35">
            Types narrow to this exact model: its options, its capabilities, its
            input modalities. Pass an image to a text-only model and it fails at
            compile time, not in production.
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function ProtocolMap() {
  const nodes = [
    { label: 'CLIENT', detail: 'your web app', highlight: false },
    { label: 'AG-UI', detail: 'communication protocol', highlight: true },
    { label: 'Server', detail: 'your ai endpoint', highlight: false },
    { label: 'Provider', detail: 'openai, anthropic', highlight: false },
  ]

  return (
    <>
      <p className="sr-only">
        AG-UI sits between your web app and your AI endpoint, with traffic in
        both directions. The server then talks to a provider such as OpenAI or
        Anthropic.
      </p>
      <div className="mx-auto mt-14 flex max-w-[68rem] flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
        {nodes.map((node, index) => (
          <React.Fragment key={node.label}>
            <ProtocolCard highlight={node.highlight} node={node} />
            {index < nodes.length - 1 ? (
              <ProtocolConnector bidirectional={index < 2} />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </>
  )
}

function ProtocolCard({
  highlight,
  node,
}: {
  highlight: boolean
  node: { detail: string; label: string }
}) {
  if (highlight) {
    return (
      <div className="relative min-w-0 flex-1 md:flex-[1.2]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-2xl bg-[var(--landing-accent)] opacity-40 blur-md motion-safe:animate-pulse motion-reduce:hidden"
        />
        <div
          className={`relative rounded-xl border-2 border-[var(--landing-accent)] p-6 text-center shadow-[0_12px_28px_rgb(var(--landing-glow)/0.28)] ring-2 ring-[color:rgb(var(--landing-glow)/0.24)] ${accentFillClass}`}
        >
          <p className="text-ds-heading-4">{node.label}</p>
          <p className="mt-2 font-ds-mono text-ds-mono-2xs opacity-80">
            {node.detail}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-background-subtle p-5 text-center">
      <p className="text-ds-heading-4 text-text-primary">{node.label}</p>
      <p className="mt-2 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
        {node.detail}
      </p>
    </div>
  )
}

function ProtocolConnector({ bidirectional }: { bidirectional: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 items-center justify-center text-[var(--landing-accent)] md:h-auto md:w-12"
    >
      {bidirectional ? (
        <>
          <ArrowsDownUpIcon className="md:hidden" size={22} weight="bold" />
          <ArrowsLeftRightIcon
            className="hidden md:block"
            size={22}
            weight="bold"
          />
        </>
      ) : (
        <>
          <ArrowDownIcon className="md:hidden" size={20} weight="bold" />
          <ArrowRightIcon className="hidden md:block" size={20} weight="bold" />
        </>
      )}
    </div>
  )
}

type RailItem = {
  body: string
  detail: string
  icon: Icon
  label: string
}

const agentStack: Array<RailItem> = [
  {
    label: 'Code Mode',
    detail: '@tanstack/ai-code-mode',
    body: 'You provide a special tool to the LLM provider that allows it to chain tools (functions) into a single executable script and call it in a local or remote isolate, producing results that it further processes. It writes code and calls it.',
    icon: CodeIcon,
  },
  {
    label: 'Coding-agent harnesses',
    detail: '@tanstack/ai-sandbox',
    body: 'Run Claude Code, Codex, OpenCode, Grok Build, or any ACP agent as a chat backend, inside a local process, Docker, Daytona, Vercel, Sprites, or Cloudflare sandbox. Their tool activity streams back as AG-UI events your UI already renders.',
    icon: TerminalIcon,
  },
  {
    label: 'MCP + MCP Apps',
    detail: '@tanstack/ai-mcp',
    body: 'A host-side MCP client with a type-generating CLI, provider-routed mcpTool(), and interactive ui:// widgets rendered from tool results across multiple servers.',
    icon: CubeIcon,
  },
  {
    label: 'Memory + compaction',
    detail: '@tanstack/ai-memory · @tanstack/ai-compaction',
    body: 'memoryMiddleware recalls across sessions through Redis, mem0, Honcho, or Hindsight adapters. Compaction keeps long threads inside the model window so the agent does not lose the thread as context grows.',
    icon: DatabaseIcon,
  },
  {
    label: 'Durability + persistence',
    detail: '@tanstack/ai-persistence · @tanstack/ai-durable-stream',
    body: 'Persistence keeps an authoritative server thread, resumes a stream through a dropped connection, and survives a reload. Durability lets a run continue after a process restart.',
    icon: HardDrivesIcon,
  },
]

const modalities: Array<RailItem> = [
  {
    label: 'Text, objects, reasoning',
    detail: 'chat · outputSchema · summarize',
    body: 'Generate an output from an AI that matches your validation schema exactly using structured output.',
    icon: RobotIcon,
  },
  {
    label: 'Speech, transcription, music',
    detail: 'generateSpeech · generateTranscription · generateAudio',
    body: 'Six speech formats with speed control, transcription with word timestamps and diarization, plus music and sound effects.',
    icon: MicrophoneIcon,
  },
  {
    label: 'Realtime voice',
    detail: 'openaiRealtimeToken · RealtimeClient',
    body: 'OpenAI, Grok, and ElevenLabs with VAD modes and tool calling inside a live session.',
    icon: WaveformIcon,
  },
  {
    label: 'Images + video',
    detail: 'generateImage · generateVideo',
    body: 'Generate images and videos, edit existing generations and show progress updates to your users with ease.',
    icon: RadioIcon,
  },
]

const devtoolsHooks = [
  { detail: 'useChat · 12 msgs', name: 'Support Chat', selected: true },
  { detail: 'useGenerateImage', name: 'Image Studio' },
  { detail: 'useObject', name: 'Invoice Extract' },
  { detail: 'useTranscription', name: 'Call Notes' },
]

const devtoolsTimeline: Array<{
  detail: string
  label: string
  tone: 'accent' | 'muted' | 'warn'
}> = [
  {
    label: 'user turn',
    detail: '"refund the duplicate charge"',
    tone: 'muted',
  },
  {
    label: 'memory recall',
    detail: '3 facts injected · 214 tokens',
    tone: 'accent',
  },
  {
    label: 'tool call',
    detail: 'lookupInvoice { id: "inv_8841" }',
    tone: 'accent',
  },
  {
    label: 'tool result',
    detail: '{ total: 4200, status: "paid" }',
    tone: 'accent',
  },
  {
    label: 'interrupt',
    detail: 'chargeCard · awaiting approval',
    tone: 'warn',
  },
  {
    label: 'finish reason',
    detail: 'interrupt · run resumable',
    tone: 'muted',
  },
]

function DevtoolsPanel() {
  return (
    <LandingWindow label="tanstack devtools · ai">
      <div className="grid bg-background-default sm:grid-cols-[11rem_1fr]">
        <div className="border-border-subtle p-3 sm:border-r">
          <p className="px-2 pb-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
            hooks
          </p>
          {devtoolsHooks.map((hook) => (
            <div
              key={hook.name}
              className={
                hook.selected
                  ? 'mb-1 rounded-lg bg-[color:rgb(var(--landing-glow)/0.14)] px-3 py-2'
                  : 'mb-1 rounded-lg px-3 py-2'
              }
            >
              <p
                className={
                  hook.selected
                    ? 'text-ds-label-sm text-[var(--landing-accent-bright)]'
                    : 'text-ds-label-sm text-text-primary/40'
                }
              >
                {hook.name}
              </p>
              <p className="mt-0.5 font-ds-mono text-ds-mono-2xs text-text-primary/25">
                {hook.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
              run timeline
            </p>
            <p className="font-ds-mono text-ds-mono-2xs text-text-primary/25">
              thread_7f2 · run_3
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            {devtoolsTimeline.map((event) => (
              <div
                key={event.label}
                className="grid gap-1 rounded-lg bg-background-subtle px-3 py-2 sm:grid-cols-[8.5rem_1fr] sm:items-baseline"
              >
                <span
                  className={
                    event.tone === 'accent'
                      ? 'font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]'
                      : event.tone === 'warn'
                        ? 'font-ds-mono text-ds-mono-caps-xs uppercase text-amber-500'
                        : 'font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30'
                  }
                >
                  {event.label}
                </span>
                <span className="truncate font-ds-mono text-ds-mono-2xs text-text-primary/50">
                  {event.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function FeatureRail({ items }: { items: Array<RailItem> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <div
            key={item.label}
            className="grid gap-3 border-b border-border-subtle p-5 last:border-b-0 sm:grid-cols-[3rem_1fr] sm:items-start"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[color:rgb(var(--landing-glow)/0.18)] text-[var(--landing-accent-bright)]">
              <Icon aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-ds-label-md text-text-primary">{item.label}</p>
              <p className="mt-1 font-ds-mono text-ds-mono-2xs text-text-primary/30">
                {item.detail}
              </p>
              <p className="mt-2 text-ds-body-xs text-text-primary/45">
                {item.body}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const startingPoints = [
  { label: 'Build streaming chat', to: 'getting-started/quick-start' },
  {
    label: 'Start from a server route',
    to: 'getting-started/quick-start-server',
  },
  { label: 'Add persistence', to: 'persistence/overview' },
  { label: 'Compare with Vercel AI SDK', to: 'comparison/vercel-ai-sdk' },
]

function StartingPoints() {
  const { version } = useParams({ strict: false })
  const library = getLibrary('ai')

  return (
    <ul className="mx-auto mt-10 grid max-w-[52rem] gap-3 sm:grid-cols-2">
      {startingPoints.map((point) => (
        <li key={point.to}>
          <Link
            to="/$libraryId/$version/docs/$"
            params={{
              libraryId: library.id,
              version: version ?? library.latestVersion,
              _splat: point.to,
            }}
            className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-background-surface px-5 py-4 text-ds-label-md text-text-primary transition-colors hover:border-[var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          >
            {point.label}
            <ArrowRightIcon aria-hidden="true" size={16} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
