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
  TerminalIcon,
  WaveformIcon,
  type Icon,
} from '@phosphor-icons/react'

import { getLibrary } from '~/libraries'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { LandingPromptBox } from './LandingPromptBox'
import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const aiPrompt =
  'Install the agent skills from the skills folder of https://github.com/TanStack/ai for my user, read them, then ask me what AI features I want to build, or suggest some.'

// ponytail: the shared --landing-accent-ink is pure black, which reads badly on the
// orange accent fill. Darken the fill instead and use white text on it.
const accentFillClass =
  'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--landing-accent)_84%,black),color-mix(in_srgb,var(--landing-accent)_52%,black))] text-white'

export default function AiLanding() {
  return (
    <LibraryLandingShell
      libraryId="ai"
      headline="AI building blocks for TypeScript. We build the hard parts, you keep the stack."
      description="TanStack AI is a TypeScript library for building AI features and agents. It ships the agent loop, provider adapters, durability, interrupts, sandboxes, and tools, and plugs into the server, database, and UI you already have."
      hero={<WriteOnceHero />}
      beforeActions={<LandingPromptBox heading="Skills" prompt={aiPrompt} />}
    >
      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Open protocol"
          icon={<RadioIcon aria-hidden="true" size={15} />}
          title="AG-UI compliant, in both directions."
          body="The client sends AG-UI requests and consumes AG-UI events, so the agent on the other end is replaceable: point the same client at a Python, Go, or PHP runtime and it keeps working. Bring your own transport."
          action={
            <DocsLink to="migration/ag-ui-compliance">
              AG-UI compliance
            </DocsLink>
          }
        />
        <ProtocolMap />
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Typesafe models"
            icon={<PlugIcon aria-hidden="true" size={15} />}
            title="Typed options for every model."
            body="Pick a model and TypeScript narrows the fields to what it supports. Input parts for chat. Pixel sizes on one image model and aspect ratio plus resolution on the next. Durations and tiers for video. Resolution for world models. The wrong value fails in the editor, not in production."
            action={
              <DocsLink to="chat/connection-adapters">
                Connection adapters
              </DocsLink>
            }
          />
          <div className="min-w-0 lg:order-first">
            <ProviderWorkbench />
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="We handle tools"
            icon={<BracketsCurlyIcon aria-hidden="true" size={15} />}
            title="Define a tool once. Run it on either side."
            body="One schema gives you the input and output types on the server and the client. The loop calls the tool, pauses for approval when you ask it to, applies the user's edits, and feeds the result back to the model."
            action={<DocsLink to="tools/tools">Tools</DocsLink>}
          />
          <ToolBoundary />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="You own the UI"
            icon={<LayoutIcon aria-hidden="true" size={15} />}
            title="Typed parts, honest states, no components to fight."
            body="A message is a list of parts, and every part carries its own lifecycle. Render them yourself or register one component per part type."
            action={<DocsLink to="ui/react">UI integrations</DocsLink>}
          />
          <div className="min-w-0 lg:order-first">
            <MessageParts />
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="You own persistence"
          icon={<DatabaseIcon aria-hidden="true" size={15} />}
          title="Your database. Your schema."
          body="Persistence is two functions: load a thread and save a thread. The ai-persistence skill ships with the package, so your coding agent can wire them to your tables and ORM in one pass."
          action={<DocsLink to="persistence/overview">Persistence</DocsLink>}
        />
        <PersistenceContract />
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Durability you can move"
            icon={<HardDrivesIcon aria-hidden="true" size={15} />}
            title="Refresh mid-answer and nothing is lost."
            body="Every chunk is written to a log before it is delivered. Drop the socket or refresh the page and the client replays from its last offset instead of paying for the model again."
            action={
              <DocsLink to="resumable-streams/overview">
                Resumable streams
              </DocsLink>
            }
          />
          <DurabilityTiers />
        </div>
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
            title="Images, video, speech, voice, and live worlds."
            body="The same adapters and the same persistence cover every modality, with progress updates and cost tracking built in."
            action={<DocsLink to="media/generations">Generations</DocsLink>}
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
            action={<DocsLink to="getting-started/devtools">Devtools</DocsLink>}
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
  'm-0 min-w-0 rounded-none border-0 [&>div:first-child]:rounded-none [&_pre]:max-h-104 [&_pre]:overflow-auto [&_pre]:rounded-none [&_pre]:text-[11px] [&_pre]:leading-5 sm:[&_pre]:text-xs'

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
        role="group"
        aria-label={label}
      >
        {samples.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={index === activeIndex}
            className="rounded-lg px-3 py-1.5 text-ds-label-sm text-text-primary/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright) aria-pressed:bg-[rgb(var(--landing-glow)/0.14)] aria-pressed:text-(--landing-accent-bright)"
            onClick={() => setActiveIndex(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <CodeBlock
        key={sample.name}
        dataCodeTitle={sample.file}
        className={`${codeWindowClass} ${preHeightClass}`}
        showTypeCopyButton={false}
      >
        <code className="language-ts">{sample.code}</code>
      </CodeBlock>
    </LandingWindow>
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
      <LandingWindow className="w-full max-w-184" label="persistence.ts">
        <CodeBlock className={codeWindowClass} showTypeCopyButton={false}>
          <code className="language-ts">{persistenceContract}</code>
        </CodeBlock>
      </LandingWindow>
    </div>
  )
}

const durabilityTiers = [
  {
    name: 'In memory',
    file: 'routes/api.chat.ts',
    code: `import { chat, memoryStream, toServerSentEventsResponse } from '@tanstack/ai'

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
    code: `import { chat, toServerSentEventsResponse } from '@tanstack/ai'
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
      preHeightClass="[&_pre]:h-76"
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
      <p className="sr-only">
        A message is a list of parts. A thinking part, then a tool call that
        moves from awaiting input through approval to complete, then the tool
        result and the streamed text reply.
      </p>
      <ul className="divide-y divide-border-subtle" aria-hidden="true">
        {parts.map((part) => (
          <li
            key={part.type}
            className={
              part.state === 'pending'
                ? 'grid gap-1 p-4 opacity-25 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4'
                : 'grid gap-1 p-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center sm:gap-4'
            }
          >
            <span className="font-ds-mono text-ds-mono-2xs text-(--landing-accent-bright)">
              {part.type}
            </span>
            <span className="truncate font-ds-mono text-ds-mono-xs text-text-primary/70">
              {part.detail}
              {part.state === 'streaming' ? (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-(--landing-accent-bright) align-middle motion-reduce:animate-none" />
              ) : null}
            </span>
            <span
              className={
                part.state === 'complete' || part.state === 'pending'
                  ? 'rounded-full border border-border-subtle px-2.5 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/35'
                  : 'rounded-full border border-(--landing-accent) bg-[rgb(var(--landing-glow)/0.14)] px-2.5 py-1 font-ds-mono text-ds-mono-2xs text-(--landing-accent-bright)'
              }
            >
              {part.state}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border-subtle p-4" aria-hidden="true">
        <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
          tool-call lifecycle
        </p>
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {toolCallStates.map((state, index) => (
            <li
              key={state}
              className={
                index === stateIndex
                  ? 'rounded-md bg-[rgb(var(--landing-glow)/0.18)] px-2 py-1 font-ds-mono text-ds-mono-2xs text-(--landing-accent-bright)'
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
              className="flex-1 rounded-lg border border-border-default px-3 py-2 text-ds-label-sm capitalize text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright) aria-pressed:border-(--landing-accent) aria-pressed:bg-[rgb(var(--landing-glow)/0.14)] aria-pressed:text-(--landing-accent-bright)"
              onClick={() => setBoundary(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-5 min-h-52 overflow-x-auto rounded-lg bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs text-white/65">
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
              <p className="text-(--landing-accent-bright)">
                lookupInvoice.client(async ({'{'} id {'}'}) =&gt; {'{'}
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;
                {`const url = new URL(\`/invoices/\${id}\`, window.location.origin)`}
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;window.history.pushState({'{'} id {'}'}, '', url)
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;return {'{'} id, href: url.pathname {'}'}
              </p>
              <p className="text-(--landing-accent-bright)">{'})'}</p>
            </>
          ) : (
            <>
              <p className="text-(--landing-accent-bright)">
                lookupInvoice.server(async ({'{'} id {'}'}) =&gt; {'{'}
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;return db.invoices.update({'{'}
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;&nbsp;&nbsp;where: {'{'} id {'}'},
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;&nbsp;&nbsp;data: {'{'} lastViewedAt: new Date(){' '}
                {'}'},
              </p>
              <p className="text-(--landing-accent-bright)">
                &nbsp;&nbsp;{'}'})
              </p>
              <p className="text-(--landing-accent-bright)">{'})'}</p>
            </>
          )}
        </div>
        <p
          className="mt-4 min-h-10 text-ds-body-xs text-text-primary/35"
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
      <div className="mx-auto mt-14 flex max-w-272 flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
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
          className="pointer-events-none absolute -inset-2 rounded-2xl bg-(--landing-accent) opacity-40 blur-md motion-safe:animate-pulse motion-reduce:hidden"
        />
        <div
          className={`relative rounded-xl border-2 border-(--landing-accent) p-6 text-center shadow-[0_12px_28px_rgb(var(--landing-glow)/0.28)] ring-2 ring-[rgb(var(--landing-glow)/0.24)] ${accentFillClass}`}
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
    <div className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--landing-glow)/0.45)] bg-background-subtle p-5 text-center">
      <p className="text-ds-heading-4 text-text-primary">{node.label}</p>
      <p className="mt-2 font-ds-mono text-ds-mono-2xs text-(--landing-accent-bright)">
        {node.detail}
      </p>
    </div>
  )
}

function ProtocolConnector({ bidirectional }: { bidirectional: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 items-center justify-center text-(--landing-accent) md:h-auto md:w-12"
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
  to: string
}

const agentStack: Array<RailItem> = [
  {
    label: 'Code Mode',
    detail: '@tanstack/ai-code-mode',
    to: 'code-mode/code-mode',
    body: 'The model chains your tools into one script and runs it in an isolate, instead of one round-trip per call.',
    icon: CodeIcon,
  },
  {
    label: 'Coding-agent harnesses',
    detail: '@tanstack/ai-sandbox',
    to: 'sandbox/overview',
    body: 'Run Claude Code, Codex, or any ACP agent as a chat backend in a local process or a sandbox. Its activity streams back as events your UI already renders.',
    icon: TerminalIcon,
  },
  {
    label: 'MCP + MCP Apps',
    detail: '@tanstack/ai-mcp',
    to: 'tools/mcp',
    body: 'A typed MCP client with a CLI that generates the types, plus interactive widgets rendered from tool results.',
    icon: CubeIcon,
  },
  {
    label: 'Memory + compaction',
    detail: '@tanstack/ai-memory · @tanstack/ai-compaction',
    to: 'memory/overview',
    body: 'Recall across sessions through Redis, mem0, Honcho, or Hindsight. Compaction keeps long threads inside the model window.',
    icon: DatabaseIcon,
  },
]

const modalities: Array<RailItem> = [
  {
    label: 'Text, objects, reasoning',
    detail: 'chat · outputSchema · summarize',
    to: 'chat/structured-outputs',
    body: 'Structured output that matches your schema exactly.',
    icon: RobotIcon,
  },
  {
    label: 'Speech, transcription, music',
    detail: 'generateSpeech · generateTranscription · generateAudio',
    to: 'media/text-to-speech',
    body: 'Transcription with word timestamps and diarization, plus music and sound effects.',
    icon: MicrophoneIcon,
  },
  {
    label: 'Realtime voice',
    detail: 'openaiRealtimeToken · RealtimeClient',
    to: 'media/realtime-chat',
    body: 'OpenAI, Grok, and ElevenLabs with VAD modes and tool calling inside a live session.',
    icon: WaveformIcon,
  },
  {
    label: 'Images + video',
    detail: 'generateImage · generateVideo',
    to: 'media/video-generation',
    body: 'Generate, edit, and stream progress to the user.',
    icon: RadioIcon,
  },
  {
    label: 'World models + live video',
    detail: 'generateWorld · generateLiveVideo',
    to: 'media/world-generation',
    body: 'Mint a session on the server and stream an explorable world or live video into the browser over WebRTC.',
    icon: CubeIcon,
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
                  ? 'mb-1 rounded-lg bg-[rgb(var(--landing-glow)/0.14)] px-3 py-2'
                  : 'mb-1 rounded-lg px-3 py-2'
              }
            >
              <p
                className={
                  hook.selected
                    ? 'text-ds-label-sm text-(--landing-accent-bright)'
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
                      ? 'font-ds-mono text-ds-mono-caps-xs uppercase text-(--landing-accent-bright)'
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
            <span className="flex size-10 items-center justify-center rounded-full bg-[rgb(var(--landing-glow)/0.18)] text-(--landing-accent-bright)">
              <Icon aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-ds-label-md text-text-primary">
                <DocsLink to={item.to} plain>
                  {item.label}
                </DocsLink>
              </p>
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

function DocsLink({
  children,
  plain = false,
  to,
}: {
  children: React.ReactNode
  plain?: boolean
  to: string
}) {
  const { version } = useParams({ strict: false })
  const library = getLibrary('ai')

  return (
    <Link
      to="/$libraryId/$version/docs/$"
      params={{
        libraryId: library.id,
        version: version ?? library.latestVersion,
        _splat: to,
      }}
      className={
        plain
          ? 'hover:text-(--landing-accent-bright) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)'
          : 'inline-flex items-center gap-1.5 text-ds-label-sm text-(--landing-accent-bright) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)'
      }
    >
      {children}
      {plain ? null : <ArrowRightIcon aria-hidden="true" size={14} />}
    </Link>
  )
}

function StartingPoints() {
  const { version } = useParams({ strict: false })
  const library = getLibrary('ai')

  return (
    <ul className="mx-auto mt-10 grid max-w-208 gap-3 sm:grid-cols-2">
      {startingPoints.map((point) => (
        <li key={point.to}>
          <Link
            to="/$libraryId/$version/docs/$"
            params={{
              libraryId: library.id,
              version: version ?? library.latestVersion,
              _splat: point.to,
            }}
            className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-background-surface px-5 py-4 text-ds-label-md text-text-primary transition-colors hover:border-(--landing-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)"
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
  'rounded-md px-2 py-1 font-ds-mono text-ds-mono-2xs text-text-primary/40 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright) aria-pressed:bg-[rgb(var(--landing-glow)/0.16)] aria-pressed:text-(--landing-accent-bright)'

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
      ? {
          name: server.name,
          file: server.file,
          lang: 'ts',
          code: server.code(provider),
        }
      : {
          name: client.name,
          file: client.file,
          lang: client.lang,
          code: client.code,
        }

  return (
    <div className="grid w-full min-w-0 max-w-full items-start gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <LandingWindow
        className="ring-2 ring-[rgb(var(--landing-glow)/0.35)]"
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
          key={`${sample.name}-${provider.name}`}
          dataCodeTitle={sample.file}
          className={`${codeWindowClass} [&_pre]:h-76`}
          showTypeCopyButton={false}
        >
          <code className={`language-${sample.lang}`}>{sample.code}</code>
        </CodeBlock>
      </LandingWindow>
    </div>
  )
}

// Each model shows one field the types narrow per model. `picked` is what the
// snippet passes; when it is not in `allowed` the snippet shows a type error.
const compilerModels = [
  {
    name: 'gpt-6-astra',
    pkg: '@tanstack/ai-openai',
    fn: 'chat',
    adapter: "openaiText('gpt-6-astra')",
    setup: [],
    line: (value: string) =>
      `messages: [{ role: 'user', content: [{ type: '${value}', source: receiptUrl }] }]`,
    field: 'input',
    allowed: ['text', 'image'],
    picked: 'image',
    note: 'Input parts are typed per model.',
  },
  {
    name: 'claude-fable-5-1',
    pkg: '@tanstack/ai-anthropic',
    fn: 'chat',
    adapter: "anthropicText('claude-fable-5-1')",
    setup: [],
    line: (value: string) =>
      `messages: [{ role: 'user', content: [{ type: '${value}', source: invoicePdf }] }]`,
    field: 'input',
    allowed: ['text', 'image', 'document'],
    picked: 'document',
    note: 'PDFs go in as document parts on models that read them.',
  },
  {
    name: 'llama-3.3-70b-versatile',
    pkg: '@tanstack/ai-groq',
    fn: 'chat',
    adapter: "groqText('llama-3.3-70b-versatile')",
    setup: [],
    line: (value: string) =>
      `messages: [{ role: 'user', content: [{ type: '${value}', source: receiptUrl }] }]`,
    field: 'input',
    allowed: ['text'],
    picked: 'image',
    note: 'Text-only model, so the image part fails to type.',
  },
  {
    name: 'gpt-image-2',
    pkg: '@tanstack/ai-openai',
    fn: 'generateImage',
    adapter: "openaiImage('gpt-image-2')",
    setup: ["prompt: 'A neon city at night'"],
    line: (value: string) => `size: '${value}'`,
    field: 'size',
    allowed: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
    picked: '1536x1024',
    note: 'OpenAI sizes are pixels, width by height.',
  },
  {
    name: 'grok-imagine-image-2.0',
    pkg: '@tanstack/ai-grok',
    fn: 'generateImage',
    adapter: "grokImage('grok-imagine-image-2.0')",
    setup: ["prompt: 'A neon city at night'"],
    line: (value: string) => `size: '${value}'`,
    field: 'size',
    allowed: ['1:1', '16:9', '9:16', '3:2', 'auto', '16:9_1k', '16:9_2k'],
    picked: '16:9_2k',
    note: 'Grok sizes are an aspect ratio, or ratio_resolution. Fourteen ratios at 1k or 2k, all typed.',
  },
  {
    name: 'gemini-omni-1.1-flash',
    pkg: '@tanstack/ai-gemini',
    fn: 'generateVideo',
    adapter: "geminiVideo('gemini-omni-1.1-flash')",
    setup: [
      'prompt: [',
      "  { type: 'image', source: { type: 'url', value: firstFrame } }",
      "  { type: 'text', content: 'Slow push in, rain on neon' }",
      ']',
    ],
    line: (value: string) => `size: '${value}'`,
    field: 'size',
    allowed: ['16:9', '9:16', '16:9_720p', '16:9_1080p', '16:9_4k'],
    picked: '16:9_4k',
    note: 'Image and video parts in the prompt. Same ratio_resolution template, with tiers up to 4k, and any duration from 3 to 10 seconds.',
  },
  {
    name: 'dreamina-seedance-2-5-260628',
    pkg: '@tanstack/ai-byteplus',
    fn: 'generateVideo',
    adapter: "byteplusVideo('dreamina-seedance-2-5-260628')",
    setup: [
      'prompt: [',
      "  { type: 'image', role: 'reference', source: { type: 'url', value: heroShot } }",
      "  { type: 'audio', source: { type: 'url', value: beatUrl } }",
      "  { type: 'text', content: 'Cut on the beat, keep the outfit' }",
      ']',
    ],
    line: (value: string) => `size: '${value}'`,
    field: 'size',
    allowed: ['16:9', '9:16', '1:1', '21:9', '16:9_720p', '16:9_1080p'],
    picked: '16:9_4k',
    note: 'Reference image and audio parts in the prompt, and video parts too. Seedance 2.5 stops at 1080p. The 4k tier only exists on Seedance 2.0, and the types know that.',
  },
  {
    name: 'visko-orbis-stable',
    pkg: '@tanstack/ai-reactor',
    fn: 'generateWorld',
    adapter: "reactorWorld('visko-orbis-stable')",
    setup: ["prompt: 'A neon city at night'"],
    line: (value: string) => `modelOptions: { resolution: '${value}' }`,
    field: 'resolution',
    allowed: ['1080p', '2k', '4k'],
    picked: '4k',
    note: 'World models stream over WebRTC. Resolution is a delivery tier.',
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
  const valid = model.allowed.includes(model.picked)
  const adapterName = model.adapter.split('(')[0]

  return (
    <LandingWindow label="the types know the model">
      <div className="grid sm:grid-cols-[13rem_1fr]">
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
              className="mb-1 block w-full rounded-lg px-3 py-2 text-left font-ds-mono text-ds-mono-2xs text-text-primary/35 hover:bg-text-primary/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright) aria-pressed:bg-[rgb(var(--landing-glow)/0.14)] aria-pressed:text-(--landing-accent-bright)"
              onClick={() => setActiveIndex(index)}
            >
              {item.name}
              <span className="mt-0.5 block text-text-primary/25">
                {item.fn}
              </span>
            </button>
          ))}
        </div>
        <div aria-live="polite" className="min-w-0">
          <div className="overflow-x-auto bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs leading-relaxed text-white/70">
            <p>
              <Kw>import</Kw> {'{ '}
              {adapterName}
              {' }'} <Kw>from</Kw> <Str>'{model.pkg}'</Str>
            </p>
            <p>&nbsp;</p>
            <p>
              <Kw>const</Kw> result = <Kw>await</Kw> <Fn>{model.fn}</Fn>({'{'}
            </p>
            <p>
              &nbsp;&nbsp;adapter: <Fn>{adapterName}</Fn>(
              <Str>'{model.name}'</Str>),
            </p>
            {model.setup.map((line) => (
              <p key={line} className="whitespace-pre">
                {'  '}
                {line}
                {line.endsWith('[') ? '' : ','}
              </p>
            ))}
            <p
              className={
                valid
                  ? ''
                  : 'underline decoration-red-400 decoration-wavy underline-offset-4'
              }
            >
              &nbsp;&nbsp;{model.line(model.picked)},
            </p>
            <p>{'})'}</p>
          </div>
          <div className="border-t border-border-subtle p-4">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
              {model.field} for {model.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {model.allowed.map((value) => (
                <span
                  key={value}
                  className="rounded-full border border-(--landing-accent) bg-[rgb(var(--landing-glow)/0.14)] px-3 py-1 font-ds-mono text-ds-mono-2xs text-(--landing-accent-bright)"
                >
                  {value}
                </span>
              ))}
              {valid ? null : (
                <span className="rounded-full border border-red-400/60 px-3 py-1 font-ds-mono text-ds-mono-2xs text-red-400/90 line-through">
                  {model.picked}
                </span>
              )}
            </div>
            <p className="mt-3 text-ds-body-xs text-text-primary/40">
              {model.note}
            </p>
            {valid ? (
              <p className="mt-4 min-h-10 font-ds-mono text-ds-mono-2xs text-emerald-400/80">
                ✓ no errors. '{model.picked}' is a valid {model.field} for{' '}
                {model.name}.
              </p>
            ) : (
              <p className="mt-4 min-h-10 font-ds-mono text-ds-mono-2xs text-red-400/90">
                error TS2322: Type '{model.picked}' is not assignable to type '
                {model.allowed.join(' | ')}'.
              </p>
            )}
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}
