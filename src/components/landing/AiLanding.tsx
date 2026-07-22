import * as React from 'react'
import {
  BracketsCurly,
  CheckCircle,
  HandPalm,
  Microphone,
  Plug,
  Radio,
  Robot,
  Waveform,
  type Icon,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const aiPrompt = [
  'Build a TanStack AI feature for a TypeScript app.',
  'Use the headless client or framework adapter, AG-UI-compatible request and event streams, provider adapters, typed client and server tools, structured output, and observable runtime state without requiring a hosted gateway.',
  'Show provider-specific capabilities honestly, make tool approval explicit, and include media or realtime primitives only where the selected model supports them.',
].join(' ')

const providers = [
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

const runtimeEvents = [
  ['RUN_STARTED', 'AG-UI request accepted'],
  ['TEXT_MESSAGE_CONTENT', 'The invoice total is…'],
  ['TOOL_CALL_START', 'lookupInvoice({ id })'],
  ['CUSTOM', 'approval-requested · waiting on the client'],
  ['RUN_FINISHED', 'usage and result recorded'],
]

export default function AiLanding() {
  return (
    <LibraryLandingShell
      libraryId="ai"
      headline="Own the path between your interface and every model."
      description="TanStack AI is a typed, composable SDK for streaming model output, tools, structured data, media, and realtime experiences through infrastructure you control."
      hero={<AiRuntimeHero />}
      prompt={aiPrompt}
      promptLabel="Copy AI prompt"
    >
      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Typed tools"
            icon={<BracketsCurly aria-hidden="true" size={15} />}
            title="One contract. Two execution boundaries."
            body="Define the input and output once, then choose where the work belongs. Client tools can touch local UI state. Server tools can reach private systems. Isomorphic tools share the same definition and can still pause for approval."
          />
          <ToolBoundary />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <ProviderWorkbench />
          <LandingSectionIntro
            eyebrow="Provider types"
            icon={<Plug aria-hidden="true" size={15} />}
            title="The adapter changes. The capability surface stays honest."
            body="Providers share a common SDK shape without pretending every model is identical. Model names, options, tool support, and modality-specific results remain typed at the adapter boundary."
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="AG-UI both ways"
          icon={<Radio aria-hidden="true" size={15} />}
          title="The protocol is the seam, not a hosted middleman."
          body="Headless clients send AG-UI-compatible requests and consume AG-UI events. Your runtime can live in TypeScript or interoperate with another AG-UI server while your application keeps control of transport, auth, and deployment."
        />
        <ProtocolMap />
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <LandingSectionIntro
            eyebrow="Beyond chat"
            icon={<Microphone aria-hidden="true" size={15} />}
            title="Different media. The same observable runtime."
            body="Text and structured output sit beside image generation, speech, transcription, realtime voice, and video. Middleware, hooks, devtools, and OpenTelemetry can observe work at the activity level."
          />
          <ModalityRail />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function AiRuntimeHero() {
  const [activeProviderIndex, setActiveProviderIndex] = React.useState(0)
  const [approved, setApproved] = React.useState(false)
  const provider = providers[activeProviderIndex] ?? providers[0]

  return (
    <LandingWindow label="owned AI runtime">
      <div className="grid min-h-[24rem] md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-white/5 p-4 md:border-r">
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
            client
          </p>
          <div className="mt-3 rounded-lg border border-white/10 bg-[#141414] p-3">
            <p className="text-ds-label-sm text-white">React useChat()</p>
            <p className="mt-1 font-ds-mono text-[10px] text-white/35">
              headless client · AG-UI
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mx-auto h-5 w-px bg-[var(--landing-accent)]"
          />
          <div className="rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] p-3 text-center">
            <p className="text-ds-label-md text-[var(--landing-accent-bright)]">
              TanStack AI runtime
            </p>
            <p className="mt-1 font-ds-mono text-[10px] text-white/35">
              stream · tools · middleware
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mx-auto h-5 w-px bg-[var(--landing-accent)]"
          />
          <div className="grid grid-cols-2 gap-2">
            {providers.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={index === activeProviderIndex}
                className="rounded-lg border border-white/5 bg-[#141414] px-2 py-2 text-left font-ds-mono text-[10px] text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
                onClick={() => {
                  setActiveProviderIndex(index)
                  setApproved(false)
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
                event stream
              </p>
              <p className="mt-1 truncate font-ds-mono text-[11px] text-[var(--landing-accent-bright)]">
                {provider.name} / {provider.model}
              </p>
            </div>
            <span className="rounded bg-emerald-400 px-2 py-1 font-ds-mono text-[9px] font-semibold uppercase text-emerald-950">
              connected
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {runtimeEvents.slice(0, approved ? 5 : 4).map(([event, detail]) => (
              <div
                key={event}
                className="rounded-lg border border-white/5 bg-[#121212] px-3 py-2"
              >
                <p className="font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                  {event}
                </p>
                <p className="mt-1 truncate text-ds-body-xs text-white/35">
                  {event === 'CUSTOM' && approved
                    ? 'approval-requested · approved by client'
                    : detail}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={approved}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-bright)] hover:bg-[color:rgb(var(--landing-glow)/0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onClick={() => setApproved((current) => !current)}
          >
            {approved ? (
              <CheckCircle aria-hidden="true" size={16} />
            ) : (
              <HandPalm aria-hidden="true" size={16} />
            )}
            {approved ? 'Tool approved' : 'Approve lookupInvoice'}
          </button>
        </div>
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
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-ds-label-sm capitalize text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setBoundary(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg bg-black p-4 font-ds-mono text-[11px] leading-6 text-white/65">
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
          <p className="text-[var(--landing-accent-bright)]">
            lookupInvoice.{boundary}(
            {boundary === 'client' ? 'openInvoicePanel' : 'readPrivateLedger'})
          </p>
        </div>
        <p className="mt-4 text-ds-body-xs text-white/35" aria-live="polite">
          {boundary === 'client'
            ? 'Runs beside the UI and can update local application state.'
            : 'Runs behind your server boundary with private credentials and data.'}
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
        <div className="border-white/5 p-3 sm:border-r">
          {providers.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={index === activeIndex}
              className="mb-1 block w-full rounded-lg px-3 py-2 text-left text-ds-label-sm text-white/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="p-5" aria-live="polite">
          <p className="font-ds-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
            selected model
          </p>
          <p className="mt-2 font-ds-mono text-[13px] text-white">
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
                        ? 'rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] px-3 py-1.5 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]'
                        : 'rounded-full border border-white/5 px-3 py-1.5 font-ds-mono text-[10px] text-white/20 line-through'
                    }
                  >
                    {capability}
                  </span>
                )
              },
            )}
          </div>
          <p className="mt-6 text-ds-body-xs text-white/35">
            Adapter-specific types expose the options and outputs available for
            this model.
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function ProtocolMap() {
  const nodes = [
    ['UI', 'headless client'],
    ['AG-UI', 'request + events'],
    ['Runtime', 'your server'],
    ['Provider', 'typed adapter'],
  ]

  return (
    <div className="mx-auto mt-14 flex max-w-[68rem] flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
      {nodes.map(([label, detail], index) => (
        <React.Fragment key={label}>
          <div className="min-w-0 flex-1 rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-[#111] p-5 text-center">
            <p className="text-ds-heading-4 text-white">{label}</p>
            <p className="mt-2 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
              {detail}
            </p>
          </div>
          {index < nodes.length - 1 ? (
            <div
              aria-hidden="true"
              className="mx-auto h-6 w-px bg-[var(--landing-accent)] md:h-px md:w-10"
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  )
}

function ModalityRail() {
  const modalities: Array<{ detail: string; icon: Icon; label: string }> = [
    {
      label: 'Text + objects',
      detail: 'chat · outputSchema',
      icon: Robot,
    },
    {
      label: 'Speech + transcription',
      detail: 'generateSpeech · generateTranscription',
      icon: Microphone,
    },
    {
      label: 'Realtime voice',
      detail: 'realtimeToken · RealtimeClient',
      icon: Waveform,
    },
    {
      label: 'Images + video',
      detail: 'generateImage · generateVideo',
      icon: Radio,
    },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101010]">
      {modalities.map((modality, index) => {
        const Icon = modality.icon

        return (
          <div
            key={modality.label}
            className="grid gap-3 border-b border-white/5 p-5 last:border-b-0 sm:grid-cols-[3rem_1fr_auto] sm:items-center"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[color:rgb(var(--landing-glow)/0.18)] text-[var(--landing-accent-bright)]">
              <Icon aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-ds-label-md text-white">{modality.label}</p>
              <p className="mt-1 font-ds-mono text-[10px] text-white/30">
                {modality.detail}
              </p>
            </div>
            <span className="font-ds-mono text-[10px] text-white/20">
              0{index + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}
