import * as React from 'react'
import {
  BracketsCurly,
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

const aiHeroClients = ['Vanilla', 'React', 'Vue', 'Solid', 'Svelte', 'Preact']
const aiHeroServers: Array<AiHeroServer> = [
  { label: 'TanStack AI', detail: 'TypeScript', kind: 'tanstack' },
  { label: 'Python', dotted: true },
  { label: 'Go', dotted: true },
  { label: 'PHP', dotted: true },
]
const aiHeroProviders = ['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini']
const graphClientNodes = aiHeroClients.map((label, index) => ({
  label,
  x: [34, 154, 274][index % 3] ?? 154,
  y: index < 3 ? 44 : 90,
  width: 86,
  height: 34,
}))
const graphAgUiNode: GraphNodePosition & {
  detail: string
  kind: 'tanstack'
} = {
  label: 'TanStack AI Client',
  detail: 'AG-UI',
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
    user: 'Build the invoice assistant on our stack.',
    assistant:
      'Using TanStack AI for TypeScript, AG-UI events, a server tool for invoices, and OpenRouter for model routing.',
  },
  {
    user: 'Ask before it charges a card.',
    assistant:
      'Tool approval added. The UI will pause on chargeCard until your app confirms it.',
  },
  {
    user: 'Can we switch providers later?',
    assistant:
      'Yes. The provider stays behind an adapter; the app keeps the same event stream and typed tools.',
  },
]

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
      headline="Own the path between your interface and every model."
      description="TanStack AI is a typed, composable SDK for streaming model output, tools, structured data, media, and realtime experiences through infrastructure you control."
      hero={<AiGraphChatHero />}
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

function AiGraphChatHero() {
  const [activeClient, setActiveClient] = React.useState(0)
  const [activeProvider, setActiveProvider] = React.useState(0)
  const [chatMessages, setChatMessages] = React.useState<
    Array<AiHeroChatMessage>
  >([])
  const [typingUserMessage, setTypingUserMessage] = React.useState('')
  const primaryServerNode = graphServerNodes[0]
  const chatScrollRef = React.useRef<HTMLDivElement>(null)
  const chatLockedToBottomRef = React.useRef(true)

  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const clientIntervalId = window.setInterval(() => {
      setActiveClient((current) => (current + 1) % aiHeroClients.length)
    }, 2300)
    const providerIntervalId = window.setInterval(() => {
      setActiveProvider((current) => (current + 1) % aiHeroProviders.length)
    }, 4100)

    return () => {
      window.clearInterval(clientIntervalId)
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
        A client graph shows six UI adapters converging on the TanStack AI
        Client over AG-UI, then reaching a TypeScript runtime and
        interchangeable model providers.
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
                active={index === 0}
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
                  bottomAnchor(primaryServerNode),
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
            detail={graphAgUiNode.detail}
            kind={graphAgUiNode.kind}
            label={graphAgUiNode.label}
            node={graphAgUiNode}
          />
          {graphServerNodes.map((node, index) => (
            <GraphNode
              key={node.label}
              active={index === 0}
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
            className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-h-full flex-col justify-end gap-2.5 p-4">
              {chatMessages.map((message) => (
                <React.Fragment key={message.id}>
                  <div className="ml-auto max-w-[86%] rounded-xl bg-[var(--landing-accent)] px-3 py-2 text-ds-body-xs text-[var(--landing-accent-ink)] shadow-sm">
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
                  ['runtime', 'TanStack AI'],
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
      ? 'absolute z-20 flex flex-col items-center justify-center rounded-lg border-2 border-[var(--landing-accent-dark)] bg-[linear-gradient(135deg,var(--landing-accent-dark),var(--landing-accent))] px-2 text-center font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-ink)] shadow-[0_12px_28px_rgb(var(--landing-glow)/0.28)] ring-2 ring-[color:rgb(var(--landing-glow)/0.24)] transition-all duration-500 motion-reduce:transition-none'
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
          <p className="text-[var(--landing-accent-bright)]">
            lookupInvoice.{boundary}(
            {boundary === 'client' ? 'openInvoicePanel' : 'readPrivateLedger'})
          </p>
        </div>
        <p
          className="mt-4 text-ds-body-xs text-text-primary/35"
          aria-live="polite"
        >
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
          <div className="min-w-0 flex-1 rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-background-subtle p-5 text-center">
            <p className="text-ds-heading-4 text-text-primary">{label}</p>
            <p className="mt-2 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
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
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {modalities.map((modality, index) => {
        const Icon = modality.icon

        return (
          <div
            key={modality.label}
            className="grid gap-3 border-b border-border-subtle p-5 last:border-b-0 sm:grid-cols-[3rem_1fr_auto] sm:items-center"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[color:rgb(var(--landing-glow)/0.18)] text-[var(--landing-accent-bright)]">
              <Icon aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-ds-label-md text-text-primary">
                {modality.label}
              </p>
              <p className="mt-1 font-ds-mono text-ds-mono-2xs text-text-primary/30">
                {modality.detail}
              </p>
            </div>
            <span className="font-ds-mono text-ds-mono-2xs text-text-primary/20">
              0{index + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}
