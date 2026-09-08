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
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
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

// ponytail: the shared --landing-accent-ink is pure black, which reads badly on the
// orange accent fill. Darken the fill instead and use white text on it.
const accentFillClass =
  'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--landing-accent)_84%,black),color-mix(in_srgb,var(--landing-accent)_52%,black))] text-white'

export default function AiLanding() {
  return (
    <LibraryLandingShell
      libraryId="ai"
      headline="AI building blocks for TypeScript. We build the hard parts, you keep the stack."
      description="TanStack AI gives you composable building blocks for everything you should not write yourself: the agent loop, provider adapters, durability, interrupts, sandboxes, and tools. It leaves you everything a one-size-fits-all framework gets wrong the moment you are past a prototype: your server, your database, your UI."
      hero={<WriteOnceHero />}
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
        <RequestPath />
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
            title="The types know which model you picked."
            body="Select a model and TypeScript narrows its options, capabilities, and input modalities. Pass an image to a text-only model and it fails in the editor, not in production. Connect directly to the provider or through the gateway you choose."
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Open protocol"
          icon={<RadioIcon aria-hidden="true" size={15} />}
          title="AG-UI compliant, in both directions."
          body="The client sends AG-UI requests and consumes AG-UI events, with no proprietary stream format and no translation layer in between. That is what makes the agent on the other end replaceable: point the same client at a Python, Go, or PHP AG-UI runtime and it keeps working. The transport is yours too, whether that is SSE, HTTP streams, XHR, RPC, a raw async iterable, or a fetcher you wrote. Nothing to sign up for, no key to hand over, no traffic through us."
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
  preHeightClass,
  label,
  samples,
}: {
  label: string
  samples: Array<{ code: string; file: string; name: string }>
  preHeightClass: string
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
        className={`${codeWindowClass} ${preHeightClass}`}
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
  return (
    <CodeTabs
      preHeightClass="[&_pre]:h-[26rem]"
      label="your route"
      samples={serverRoutes}
    />
  )
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
  return (
    <CodeTabs
      preHeightClass="[&_pre]:h-[19rem]"
      label="stream durability"
      samples={durabilityTiers}
    />
  )
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
    // The result and the reply only exist once the call is complete. Keep
    // their rows mounted so the list never changes height.
    {
      type: 'tool-result',
      detail: '{ total: 1240, status: "paid" }',
      state: toolState === 'complete' ? 'complete' : 'pending',
    },
    {
      type: 'text',
      detail: 'Invoice 2231 was paid in full on',
      state: toolState === 'complete' ? 'streaming' : 'pending',
    },
  ]

  return (
    <LandingWindow label="message.parts">
      <ul className="divide-y divide-border-subtle" aria-live="polite">
        {parts.map((part) => (
          <li
            key={part.type}
            className={
              part.state === 'pending'
                ? 'grid gap-1 p-4 opacity-25 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4'
                : 'grid gap-1 p-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4'
            }
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
                part.state === 'complete' || part.state === 'pending'
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
        <div className="mt-5 min-h-[13rem] overflow-x-auto rounded-lg bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs text-white/65">
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
          className="mt-4 min-h-[2.5rem] text-ds-body-xs text-text-primary/35"
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
const heroTools = `import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const lookupInvoice = toolDefinition({
  name: 'lookup_invoice',
  description: 'Find an invoice by id',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    total: z.number(),
    status: z.enum(['draft', 'sent', 'paid']),
  }),
})`

const heroProviders = [
  {
    name: 'OpenAI',
    pkg: '@tanstack/ai-openai',
    call: "openaiText('gpt-5.5')",
  },
  {
    name: 'Anthropic',
    pkg: '@tanstack/ai-anthropic',
    call: "anthropicText('claude-sonnet-4-5')",
  },
  {
    name: 'Gemini',
    pkg: '@tanstack/ai-gemini',
    call: "geminiText('gemini-3-flash-preview')",
  },
  {
    name: 'Ollama',
    pkg: '@tanstack/ai-ollama',
    call: "ollamaText('llama3')",
  },
]

type HeroProvider = (typeof heroProviders)[number]

const heroServers = [
  {
    name: 'TanStack Start',
    file: 'routes/api.chat.ts',
    code: (
      provider: HeroProvider,
    ) => `import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { ${provider.call.split('(')[0]} } from '${provider.pkg}'
import { createFileRoute } from '@tanstack/react-router'
import { lookupInvoice } from './tools'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = await request.json()
        const stream = chat({
          adapter: ${provider.call},
          messages,
          tools: [lookupInvoice.server(findInvoice)],
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
    code: (
      provider: HeroProvider,
    ) => `import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { ${provider.call.split('(')[0]} } from '${provider.pkg}'
import { lookupInvoice } from './tools'

export async function POST(request: Request) {
  const { messages } = await request.json()
  const stream = chat({
    adapter: ${provider.call},
    messages,
    tools: [lookupInvoice.server(findInvoice)],
  })
  return toServerSentEventsResponse(stream)
}`,
  },
  {
    name: 'Hono',
    file: 'server.ts',
    code: (provider: HeroProvider) => `import { Hono } from 'hono'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { ${provider.call.split('(')[0]} } from '${provider.pkg}'
import { lookupInvoice } from './tools'

const app = new Hono()

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()
  const stream = chat({
    adapter: ${provider.call},
    messages,
    tools: [lookupInvoice.server(findInvoice)],
  })
  return toServerSentEventsResponse(stream)
})`,
  },
]

const heroClients = [
  {
    name: 'React',
    file: 'chat.tsx',
    lang: 'tsx',
    code: `import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import { lookupInvoice } from './tools'

export function Chat() {
  const { messages, sendMessage } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    tools: [lookupInvoice.client(openInvoice)],
  })

  return messages.map((message) => (
    <Bubble key={message.id} {...message} />
  ))
}`,
  },
  {
    name: 'Vue',
    file: 'Chat.vue',
    lang: 'html',
    code: `<script setup lang="ts">
import { useChat, fetchServerSentEvents } from '@tanstack/ai-vue'
import { lookupInvoice } from './tools'

const { messages, sendMessage } = useChat({
  connection: fetchServerSentEvents('/api/chat'),
  tools: [lookupInvoice.client(openInvoice)],
})
</script>

<template>
  <Bubble v-for="message in messages" :key="message.id" v-bind="message" />
</template>`,
  },
  {
    name: 'Solid',
    file: 'chat.tsx',
    lang: 'tsx',
    code: `import { useChat, fetchServerSentEvents } from '@tanstack/ai-solid'
import { lookupInvoice } from './tools'

export function Chat() {
  const chat = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    tools: [lookupInvoice.client(openInvoice)],
  })

  return <For each={chat.messages}>{(message) => <Bubble {...message} />}</For>
}`,
  },
  {
    name: 'Svelte',
    file: 'Chat.svelte',
    lang: 'html',
    code: `<script lang="ts">
  import { createChat, fetchServerSentEvents } from '@tanstack/ai-svelte'
  import { lookupInvoice } from './tools'

  const chat = createChat({
    connection: fetchServerSentEvents('/api/chat'),
    tools: [lookupInvoice.client(openInvoice)],
  })
</script>

{#each chat.messages as message (message.id)}
  <Bubble {...message} />
{/each}`,
  },
]

// One selector changes per tick so the eye can follow what moved.
const heroMoves: Array<
  | { kind: 'client'; index: number }
  | { kind: 'provider'; index: number }
  | { kind: 'server'; index: number }
> = [
  { kind: 'server', index: 1 },
  { kind: 'provider', index: 1 },
  { kind: 'client', index: 1 },
  { kind: 'server', index: 2 },
  { kind: 'provider', index: 2 },
  { kind: 'client', index: 2 },
  { kind: 'server', index: 0 },
  { kind: 'provider', index: 3 },
  { kind: 'client', index: 3 },
  { kind: 'provider', index: 0 },
  { kind: 'client', index: 0 },
]

const heroChipClass =
  'rounded-md px-2 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/40 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.16)] aria-pressed:text-[var(--landing-accent-bright)]'

function WriteOnceHero() {
  const reducedMotion = usePrefersReducedMotion()
  const [side, setSide] = React.useState<'client' | 'server'>('server')
  const [serverIndex, setServerIndex] = React.useState(0)
  const [clientIndex, setClientIndex] = React.useState(0)
  const [providerIndex, setProviderIndex] = React.useState(0)
  const [pinned, setPinned] = React.useState(false)

  React.useEffect(() => {
    if (pinned || reducedMotion !== false) {
      return
    }

    let step = 0
    const intervalId = window.setInterval(() => {
      const move = heroMoves[step % heroMoves.length]
      step += 1
      if (!move) {
        return
      }
      if (move.kind === 'provider') {
        setSide('server')
        setProviderIndex(move.index)
      } else if (move.kind === 'server') {
        setSide('server')
        setServerIndex(move.index)
      } else {
        setSide('client')
        setClientIndex(move.index)
      }
    }, 2600)

    return () => window.clearInterval(intervalId)
  }, [pinned, reducedMotion])

  const pin = (update: () => void) => {
    setPinned(true)
    update()
  }

  const server = heroServers[serverIndex] ?? heroServers[0]
  const client = heroClients[clientIndex] ?? heroClients[0]
  const provider = heroProviders[providerIndex] ?? heroProviders[0]
  const sample =
    side === 'server'
      ? { file: server.file, lang: 'ts', code: server.code(provider) }
      : { file: client.file, lang: client.lang, code: client.code }

  return (
    <div className="grid w-full min-w-0 max-w-full items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <LandingWindow
        className="ring-2 ring-[color:rgb(var(--landing-glow)/0.35)]"
        label="tools.ts · written once"
      >
        <CodeBlock className={codeWindowClass} showTypeCopyButton={false}>
          <code className="language-ts">{heroTools}</code>
        </CodeBlock>
        <p className="border-t border-border-subtle px-4 py-3 text-ds-body-xs text-text-primary/40">
          This file never changes. Everything on the right is a destination for
          it.
        </p>
      </LandingWindow>

      <LandingWindow label="runs anywhere">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle p-3">
          <div className="flex gap-1" role="group" aria-label="Side">
            {(['server', 'client'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={side === option}
                className={heroChipClass}
                onClick={() => pin(() => setSide(option))}
              >
                {option}
              </button>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-border-subtle sm:block" />
          {side === 'server' ? (
            <div
              className="flex gap-1"
              role="group"
              aria-label="Server framework"
            >
              {heroServers.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={index === serverIndex}
                  className={heroChipClass}
                  onClick={() => pin(() => setServerIndex(index))}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1" role="group" aria-label="UI framework">
              {heroClients.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={index === clientIndex}
                  className={heroChipClass}
                  onClick={() => pin(() => setClientIndex(index))}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          className={
            side === 'server'
              ? 'flex flex-wrap items-center gap-1 border-b border-border-subtle px-3 py-2'
              : 'flex flex-wrap items-center gap-1 border-b border-border-subtle px-3 py-2 opacity-40'
          }
        >
          <span className="mr-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
            provider
          </span>
          {heroProviders.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === providerIndex}
              className={heroChipClass}
              onClick={() =>
                pin(() => {
                  setSide('server')
                  setProviderIndex(index)
                })
              }
            >
              {item.name}
            </button>
          ))}
        </div>
        <CodeBlock
          key={`${sample.file}-${provider.name}`}
          dataCodeTitle={sample.file}
          className={`${codeWindowClass} [&_pre]:h-[19rem]`}
          showTypeCopyButton={false}
        >
          <code className={`language-${sample.lang}`}>{sample.code}</code>
        </CodeBlock>
      </LandingWindow>
    </div>
  )
}

const compilerModels = [
  {
    name: 'gpt-5.5',
    adapter: "openaiText('gpt-5.5')",
    pkg: '@tanstack/ai-openai',
    input: ['text', 'image', 'document'],
  },
  {
    name: 'claude-sonnet-4-5',
    adapter: "anthropicText('claude-sonnet-4-5')",
    pkg: '@tanstack/ai-anthropic',
    input: ['text', 'image', 'document'],
  },
  {
    name: 'gemini-3-flash-preview',
    adapter: "geminiText('gemini-3-flash-preview')",
    pkg: '@tanstack/ai-gemini',
    input: ['text', 'image', 'audio', 'video', 'document'],
  },
  {
    name: 'gpt-4o-audio',
    adapter: "openaiText('gpt-4o-audio')",
    pkg: '@tanstack/ai-openai',
    input: ['text', 'audio'],
  },
  {
    name: 'llama-3.3-70b-versatile',
    adapter: "groqText('llama-3.3-70b-versatile')",
    pkg: '@tanstack/ai-groq',
    input: ['text'],
  },
]

// ponytail: the code surface is always dark, so these use fixed token colors.
function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-pink-300">{children}</span>
}

function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-300">{children}</span>
}

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-300">{children}</span>
}

function ProviderWorkbench() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const model = compilerModels[activeIndex] ?? compilerModels[0]
  const acceptsImage = model.input.includes('image')

  return (
    <LandingWindow label="the types know the model">
      <div className="grid sm:grid-cols-[12rem_1fr]">
        <div
          className="border-border-subtle p-3 sm:border-r"
          role="group"
          aria-label="Model"
        >
          {compilerModels.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === activeIndex}
              className="mb-1 block w-full rounded-lg px-3 py-2 text-left font-ds-mono text-ds-mono-2xs text-text-primary/35 hover:bg-text-primary/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <div className="overflow-x-auto bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs leading-relaxed text-white/70">
            <p>
              <Kw>import</Kw> {'{ '}
              {model.adapter.split('(')[0]}
              {' }'} <Kw>from</Kw> <Str>'{model.pkg}'</Str>
            </p>
            <p>&nbsp;</p>
            <p>
              <Kw>const</Kw> stream = <Fn>chat</Fn>({'{'}
            </p>
            <p>
              &nbsp;&nbsp;adapter: <Fn>{model.adapter.split('(')[0]}</Fn>(
              <Str>'{model.name}'</Str>),
            </p>
            <p>&nbsp;&nbsp;messages: [{'{'}</p>
            <p>
              &nbsp;&nbsp;&nbsp;&nbsp;role: <Str>'user'</Str>,
            </p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;content: [</p>
            <p>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'{ '}type: <Str>'text'</Str>,
              content: <Str>'What is on this receipt?'</Str>
              {' }'},
            </p>
            <p
              className={
                acceptsImage
                  ? ''
                  : 'underline decoration-red-400 decoration-wavy underline-offset-4'
              }
            >
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{'{ '}type: <Str>'image'</Str>
              , source: {'{ '}type: <Str>'url'</Str>, value: receiptUrl{' }'}
              {' }'},
            </p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;],</p>
            <p>&nbsp;&nbsp;{'}'}],</p>
            <p>{'})'}</p>
          </div>
          <div className="border-t border-border-subtle p-4">
            <div className="flex flex-wrap gap-2">
              {['text', 'image', 'audio', 'video', 'document'].map(
                (modality) => {
                  const supported = model.input.includes(modality)
                  return (
                    <span
                      key={modality}
                      className={
                        supported
                          ? 'rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] px-3 py-1 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]'
                          : 'rounded-full border border-border-subtle px-3 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/20 line-through'
                      }
                    >
                      {modality}
                    </span>
                  )
                },
              )}
            </div>
            {acceptsImage ? (
              <p className="mt-4 min-h-[2.5rem] font-ds-mono text-ds-mono-2xs text-emerald-400/80">
                ✓ no errors. {model.name} accepts image input.
              </p>
            ) : (
              <p className="mt-4 min-h-[2.5rem] font-ds-mono text-ds-mono-2xs text-red-400/90">
                error TS2322: Type 'ImagePart' is not assignable to type
                'TextPart'. {model.name} accepts {model.input.join(', ')} input
                only.
              </p>
            )}
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

const requestPathNodes = [
  { label: 'Your UI', detail: 'React, Vue, Solid, Svelte…' },
  { label: 'Your server', detail: 'any route, any runtime' },
  { label: 'Provider or gateway', detail: 'direct, or one you choose' },
]

function RequestPath() {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className="mt-14 rounded-xl border border-border-default bg-background-surface p-5 sm:p-6">
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {requestPathNodes.map((node, index) => (
          <React.Fragment key={node.label}>
            {index > 0 ? <PathLink animate={reducedMotion === false} /> : null}
            <div className="rounded-lg border border-border-subtle px-4 py-3 text-center">
              <p className="text-ds-label-md text-text-primary">{node.label}</p>
              <p className="mt-1 font-ds-mono text-ds-mono-2xs text-text-primary/35">
                {node.detail}
              </p>
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-5 text-center text-ds-body-xs text-text-primary/40">
        That is the whole path. TanStack ships the library and does not sit in
        it, so your requests, credentials, and data never pass through us.
      </p>
    </div>
  )
}

function PathLink({ animate }: { animate: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="mx-auto h-10 w-10 rotate-90 text-[var(--landing-accent-bright)] sm:h-6 sm:w-16 sm:rotate-0"
      viewBox="0 0 64 24"
    >
      <path
        d="M2 12 H62"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {animate ? (
        <>
          <circle r="3" fill="currentColor">
            <animateMotion
              dur="1.6s"
              repeatCount="indefinite"
              path="M2 12 H62"
            />
          </circle>
          <circle r="2" fill="currentColor" fillOpacity="0.6">
            <animateMotion
              dur="1.6s"
              begin="0.8s"
              repeatCount="indefinite"
              path="M62 12 H2"
            />
          </circle>
        </>
      ) : (
        <circle cx="32" cy="12" r="3" fill="currentColor" />
      )}
    </svg>
  )
}
