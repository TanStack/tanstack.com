import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowRight,
  ArrowsDownUp,
  ArrowsLeftRight,
  BracketsCurly,
  Bug,
  Code,
  Cube,
  Database,
  HardDrives,
  Microphone,
  Plug,
  Radio,
  Robot,
  Terminal,
  Waveform,
  type Icon,
} from '@phosphor-icons/react'

import { getLibrary } from '~/libraries'
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
      headline="The headless agent framework. Bring your own stack."
      description="TanStack AI is a pluggable AI ecosystem that makes it easy for you to build AI features into your apps. It offers a toolkit that allows you to provide tools to the LLMs, interrupt the chat for user approval, run agents inside of sandboxes, build headless UI for your chats, stream the data from your server to your client, and connect to any AG-UI protocol compatible server or client. No opinions on how you should add AI into your apps: you bring your own existing infrastructure, we offer you the pluggable APIs to build on top of."
      hero={<AiGraphChatHero />}
      prompt={aiPrompt}
      promptLabel="Copy AI prompt"
    >
      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Two files"
          icon={<Terminal aria-hidden="true" size={15} />}
          title="Own both sides of the AI interaction."
          body="One route on the server, one hook in the client, and the transport between them is yours. Nothing here is a wrapper around a service we run."
        />
        <QuickStart />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Isomorphic tools"
            icon={<BracketsCurly aria-hidden="true" size={15} />}
            title="Define your agent tools once, re-use them on the server and client."
            body={
              <>
                Our <code>chat()</code> function allows you to define custom
                functions the LLM provider can call (tools) and you define the
                input and output to these functions once and re-use them across
                server and client by providing the specific implementations. Our
                library automatically calls these tools, stops and asks for
                approvals if needed, updates the input to the tools if the user
                changes it after the approval is granted and handles all the
                back and forth between the LLM provider and your app under the
                hood. You only define the tool, we handle the rest.
              </>
            }
          />
          <ToolBoundary />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <ProviderWorkbench />
          <LandingSectionIntro
            eyebrow="Typesafe models"
            icon={<Plug aria-hidden="true" size={15} />}
            title="Swap an LLM provider. Keep the typesafety."
            body={
              <>
                OpenRouter, OpenAI, Anthropic, Gemini, Vertex, Bedrock, Mistral,
                Groq, Grok, Ollama, Cohere, Perplexity, BytePlus, ElevenLabs,
                fal.ai, Lovable, LLM Gateway, and Vercel AI Gateway ship as
                official adapters, and openaiCompatible covers any endpoint that
                speaks the same shape, including a model on your own hardware.{' '}
                <AdapterDocsLink /> Every model from every provider is typesafe.
                When you need to send custom configuration for a specific model,
                send images, files and audio, or native tools like web search,
                every model is type-constrained and if it does not accept those
                options natively you learn about it at compile-time.
              </>
            }
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Open protocol"
          icon={<Radio aria-hidden="true" size={15} />}
          title="AG-UI compliant, in both directions."
          body="The client sends AG-UI requests and consumes AG-UI events, with no proprietary stream format and no translation layer in between. That is what makes the agent on the other end replaceable: point the same client at a Python, Go, or PHP AG-UI runtime and it keeps working. The transport is yours too, whether that is SSE, HTTP streams, XHR, RPC, a raw async iterable, or a fetcher you wrote. Nothing to sign up for, no key to hand over, no traffic through us."
        />
        <ProtocolMap />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <LandingSectionIntro
            eyebrow="More than just a chat function"
            icon={<Cube aria-hidden="true" size={15} />}
            title="Sandboxes, code mode, MCP, memory, compaction, skills and more."
            body="We offer more than just a simple chat interface. We allow you to build any AI feature you might need, from automated AI workflows in CI, to web apps consuming LLM providers, chatbots and more."
          />
          <FeatureRail items={agentStack} />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-16">
          <LandingSectionIntro
            eyebrow="Beyond chat"
            icon={<Microphone aria-hidden="true" size={15} />}
            title="Need to generate images, video, audio and more? We have you covered."
            body="We equally care about every generation, not just text. We offer you a whole suite of utilities to generate images, video, speech, transcription, music and realtime voice with full observability and cost tracking."
          />
          <FeatureRail items={modalities} />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
          <LandingSectionIntro
            eyebrow="Devtools"
            icon={<Bug aria-hidden="true" size={15} />}
            title="Full observability of every action with our devtools"
            body="Our devtools show you every detail about every part of your system, whether you are generating images, video or using chat you can see every action that happened on both the server and the client and easily debug what is going on on both sides."
          />
          <DevtoolsPanel />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function CodeLine({
  children,
  indent = 0,
}: {
  children?: React.ReactNode
  indent?: number
}) {
  return <p style={{ paddingLeft: `${indent * 0.75}rem` }}>{children || ' '}</p>
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-pink-300">{children}</span>
}

// ponytail: the code surface is always dark, so these use fixed token colors.
// --landing-accent-bright resolves to a dark terracotta in light mode and is
// unreadable here.
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-orange-300">{children}</span>
}

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-300">{children}</span>
}

function Cmt({ children }: { children: React.ReactNode }) {
  return <span className="text-white/30">{children}</span>
}

function CodeSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-x-auto bg-ds-neutral-500 p-5 font-ds-mono text-ds-mono-xs leading-relaxed text-white/70">
      {children}
    </div>
  )
}

function QuickStart() {
  return (
    <div className="mt-14 grid gap-5 lg:grid-cols-2">
      <LandingWindow
        className="flex flex-col"
        label="server · routes/api.chat.ts"
      >
        <CodeSurface>
          <CodeLine>
            <Kw>import</Kw> {'{ chat, toServerSentEventsResponse }'}{' '}
            <Kw>from</Kw> <Str>'@tanstack/ai'</Str>
          </CodeLine>
          <CodeLine>
            <Kw>import</Kw> {'{ openRouterText }'} <Kw>from</Kw>{' '}
            <Str>'@tanstack/ai-openrouter'</Str>
          </CodeLine>
          <CodeLine>
            <Kw>import</Kw> {'{ createFileRoute }'} <Kw>from</Kw>{' '}
            <Str>'@tanstack/react-router'</Str>
          </CodeLine>
          <CodeLine />
          <CodeLine>
            <Kw>export const</Kw> Route = <Fn>createFileRoute</Fn>(
            <Str>'/api/chat'</Str>)({'{'}
          </CodeLine>
          <CodeLine indent={2}>server: {'{'}</CodeLine>
          <CodeLine indent={4}>handlers: {'{'}</CodeLine>
          <CodeLine indent={6}>
            <Fn>POST</Fn>: <Kw>async</Kw> ({'{ request }'}) =&gt; {'{'}
          </CodeLine>
          <CodeLine indent={8}>
            <Kw>const</Kw> {'{ messages }'} = <Kw>await</Kw> request.
            <Fn>json</Fn>()
          </CodeLine>
          <CodeLine />
          <CodeLine indent={8}>
            <Kw>const</Kw> stream = <Fn>chat</Fn>({'{'}
          </CodeLine>
          <CodeLine indent={10}>
            adapter: <Fn>openRouterText</Fn>(
            <Str>'anthropic/claude-sonnet-4.5'</Str>),
          </CodeLine>
          <CodeLine indent={10}>messages,</CodeLine>
          <CodeLine indent={10}>tools: [lookupInvoice],</CodeLine>
          <CodeLine indent={8}>{'})'}</CodeLine>
          <CodeLine />
          <CodeLine indent={8}>
            <Cmt>// your route, your auth, your deploy target</Cmt>
          </CodeLine>
          <CodeLine indent={8}>
            <Kw>return</Kw> <Fn>toServerSentEventsResponse</Fn>(stream)
          </CodeLine>
          <CodeLine indent={6}>{'},'}</CodeLine>
          <CodeLine indent={4}>{'},'}</CodeLine>
          <CodeLine indent={2}>{'},'}</CodeLine>
          <CodeLine>{'})'}</CodeLine>
        </CodeSurface>
      </LandingWindow>

      <LandingWindow className="flex flex-col" label="client · chat.tsx">
        <CodeSurface>
          <CodeLine>
            <Kw>import</Kw> {'{ useChat, fetchServerSentEvents }'} <Kw>from</Kw>{' '}
            <Str>'@tanstack/ai-react'</Str>
          </CodeLine>
          <CodeLine />
          <CodeLine>
            <Kw>export function</Kw> <Fn>Chat</Fn>() {'{'}
          </CodeLine>
          <CodeLine indent={2}>
            <Kw>const</Kw> {'{ messages, sendMessage, interrupts }'} ={' '}
            <Fn>useChat</Fn>({'{'}
          </CodeLine>
          <CodeLine indent={4}>
            connection: <Fn>fetchServerSentEvents</Fn>(<Str>'/api/chat'</Str>),
          </CodeLine>
          <CodeLine indent={2}>{'})'}</CodeLine>
          <CodeLine />
          <CodeLine indent={2}>
            <Cmt>// typed state and events. no components, no styles.</Cmt>
          </CodeLine>
          <CodeLine indent={2}>
            <Kw>return</Kw> (
          </CodeLine>
          <CodeLine indent={4}>&lt;&gt;</CodeLine>
          <CodeLine indent={6}>
            {'{'}messages.<Fn>map</Fn>((message) =&gt; (
          </CodeLine>
          <CodeLine indent={8}>
            &lt;<Fn>Bubble</Fn> key={'{'}message.id{'}'} {'{'}...message{'}'}{' '}
            /&gt;
          </CodeLine>
          <CodeLine indent={6}>)){'}'}</CodeLine>
          <CodeLine />
          <CodeLine indent={6}>
            <Cmt>
              {'{/* the loop paused. you decide when it continues. */}'}
            </Cmt>
          </CodeLine>
          <CodeLine indent={6}>
            {'{'}interrupts.<Fn>map</Fn>((interrupt) =&gt; (
          </CodeLine>
          <CodeLine indent={8}>
            &lt;<Fn>button</Fn> key={'{'}interrupt.id{'}'}
          </CodeLine>
          <CodeLine indent={10}>
            onClick={'{'}() =&gt; interrupt.<Fn>resolveInterrupt</Fn>(
            <Kw>true</Kw>){'}'}&gt;
          </CodeLine>
          <CodeLine indent={10}>
            Approve {'{'}interrupt.toolName{'}'}
          </CodeLine>
          <CodeLine indent={8}>
            &lt;/<Fn>button</Fn>&gt;
          </CodeLine>
          <CodeLine indent={6}>)){'}'}</CodeLine>
          <CodeLine indent={4}>&lt;/&gt;</CodeLine>
          <CodeLine indent={2}>)</CodeLine>
          <CodeLine>{'}'}</CodeLine>
        </CodeSurface>
      </LandingWindow>

      <p className="text-center text-ds-body-xs text-text-primary/35 lg:col-span-2">
        Swap React for any other framework and keep your server-side code
        identical.
      </p>
    </div>
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
            className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          <ArrowsDownUp className="md:hidden" size={22} weight="bold" />
          <ArrowsLeftRight
            className="hidden md:block"
            size={22}
            weight="bold"
          />
        </>
      ) : (
        <>
          <ArrowDown className="md:hidden" size={20} weight="bold" />
          <ArrowRight className="hidden md:block" size={20} weight="bold" />
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
    icon: Code,
  },
  {
    label: 'Coding-agent harnesses',
    detail: '@tanstack/ai-sandbox',
    body: 'Run Claude Code, Codex, OpenCode, Grok Build, or any ACP agent as a chat backend, inside a local process, Docker, Daytona, Vercel, Sprites, or Cloudflare sandbox. Their tool activity streams back as AG-UI events your UI already renders.',
    icon: Terminal,
  },
  {
    label: 'MCP + MCP Apps',
    detail: '@tanstack/ai-mcp',
    body: 'A host-side MCP client with a type-generating CLI, provider-routed mcpTool(), and interactive ui:// widgets rendered from tool results across multiple servers.',
    icon: Cube,
  },
  {
    label: 'Memory + compaction',
    detail: '@tanstack/ai-memory · @tanstack/ai-compaction',
    body: 'memoryMiddleware recalls across sessions through Redis, mem0, Honcho, or Hindsight adapters. Compaction keeps long threads inside the model window so the agent does not lose the thread as context grows.',
    icon: Database,
  },
  {
    label: 'Durability + persistence',
    detail: '@tanstack/ai-persistence · @tanstack/ai-durable-stream',
    body: 'Persistence keeps an authoritative server thread, resumes a stream through a dropped connection, and survives a reload. Durability lets a run continue after a process restart.',
    icon: HardDrives,
  },
]

const modalities: Array<RailItem> = [
  {
    label: 'Text, objects, reasoning',
    detail: 'chat · outputSchema · summarize',
    body: 'Generate an output from an AI that matches your validation schema exactly using structured output.',
    icon: Robot,
  },
  {
    label: 'Speech, transcription, music',
    detail: 'generateSpeech · generateTranscription · generateAudio',
    body: 'Six speech formats with speed control, transcription with word timestamps and diarization, plus music and sound effects.',
    icon: Microphone,
  },
  {
    label: 'Realtime voice',
    detail: 'openaiRealtimeToken · RealtimeClient',
    body: 'OpenAI, Grok, and ElevenLabs with VAD modes and tool calling inside a live session.',
    icon: Waveform,
  },
  {
    label: 'Images + video',
    detail: 'generateImage · generateVideo',
    body: 'Generate images and videos, edit existing generations and show progress updates to your users with ease.',
    icon: Radio,
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
      {items.map((item, index) => {
        const Icon = item.icon

        return (
          <div
            key={item.label}
            className="grid gap-3 border-b border-border-subtle p-5 last:border-b-0 sm:grid-cols-[3rem_1fr_auto] sm:items-start"
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
            <span className="font-ds-mono text-ds-mono-2xs text-text-primary/20">
              0{index + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}
