import * as React from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  CodeIcon,
  FilmSlateIcon,
  ImageIcon,
  PencilLineIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import './AiCampaignHero.css'

type CampaignProvider = {
  adapter: string
  model: string
  name: string
  pkg: string
  provider: string
}

type CampaignStep = {
  activity: 'chat' | 'generateImage' | 'generateVideo'
  clientCode: string
  file: string
  hook: string
  icon: typeof PencilLineIcon
  prompt: string
  providers: Array<CampaignProvider>
  reply: string
  route: '/api/chat' | '/api/image' | '/api/video'
  serverFile: string
  title: string
}

const campaignSteps: Array<CampaignStep> = [
  {
    title: 'The brief',
    icon: PencilLineIcon,
    hook: 'useChat',
    prompt:
      'A launch campaign for TanStack AI. Something that feels like possibility, not another robot.',
    reply: 'Let’s give your next big idea a little room to grow.',
    file: 'src/components/campaign.tsx',
    serverFile: 'src/routes/api/chat.ts',
    activity: 'chat',
    route: '/api/chat',
    providers: [
      {
        name: 'Anthropic',
        adapter: 'anthropicText',
        model: 'claude-fable-5-1',
        pkg: '@tanstack/ai-anthropic',
        provider: 'Anthropic',
      },
      {
        name: 'Grok',
        adapter: 'grokText',
        model: 'grok-4.6',
        pkg: '@tanstack/ai-grok',
        provider: 'xAI',
      },
      {
        name: 'OpenAI',
        adapter: 'openaiText',
        model: 'gpt-6-astra',
        pkg: '@tanstack/ai-openai',
        provider: 'OpenAI',
      },
    ],
    clientCode: `import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'

const brief =
  'A launch campaign for TanStack AI. ' +
  'Something that feels like possibility, not another robot.'

export function Campaign() {
  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
  })

  return (
    <div>
      {messages.map((message) => (
        <p key={message.id}>
          {message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.content)
            .join('')}
        </p>
      ))}
      <button
        disabled={isLoading}
        onClick={() => sendMessage(brief)}
      >
        Send brief
      </button>
    </div>
  )
}`,
  },
  {
    title: 'The artwork',
    icon: ImageIcon,
    hook: 'useGenerateImage',
    prompt:
      'Give it a visual. A single palm tree against a pastel sky. Leave room for the idea.',
    reply: 'One tree. An open sky. A world of possibility.',
    file: 'src/components/artwork.tsx',
    serverFile: 'src/routes/api/image.ts',
    activity: 'generateImage',
    route: '/api/image',
    providers: [
      {
        name: 'GPT Image 2.5',
        adapter: 'openaiImage25',
        model: 'gpt-image-2.5-sunburst',
        pkg: '@tanstack/ai-openai',
        provider: 'OpenAI',
      },
      {
        name: 'Nano Banana 2',
        adapter: 'geminiImage',
        model: 'gemini-3.1-flash-image',
        pkg: '@tanstack/ai-gemini',
        provider: 'Google',
      },
      {
        name: 'Grok Imagine',
        adapter: 'grokImage',
        model: 'grok-imagine-image-2.0',
        pkg: '@tanstack/ai-grok',
        provider: 'xAI',
      },
    ],
    clientCode: `import { fetchServerSentEvents, useGenerateImage } from '@tanstack/ai-react'

const prompt =
  'Give it a visual. A single palm tree against a pastel sky. ' +
  'Leave room for the idea.'

export function Artwork() {
  const { generate, result, isLoading } = useGenerateImage({
    connection: fetchServerSentEvents('/api/image'),
  })

  return (
    <div>
      <button
        disabled={isLoading}
        onClick={() => generate({ prompt })}
      >
        {isLoading ? 'Generating...' : 'Create artwork'}
      </button>
      {result?.images.map((image, index) => (
        <img key={index} src={image.url} alt="" />
      ))}
    </div>
  )
}`,
  },
  {
    title: 'The launch film',
    icon: FilmSlateIcon,
    hook: 'useGenerateVideo',
    prompt:
      'Now make it move. A short launch film, with the palm swaying in a soft breeze.',
    reply: 'Same idea. A little more life.',
    file: 'src/components/launch-film.tsx',
    serverFile: 'src/routes/api/video.ts',
    activity: 'generateVideo',
    route: '/api/video',
    providers: [
      {
        name: 'Seedance 2.5',
        adapter: 'byteplusVideo',
        model: 'dreamina-seedance-2-5-260628',
        pkg: '@tanstack/ai-byteplus',
        provider: 'BytePlus',
      },
      {
        name: 'Google Omni',
        adapter: 'geminiVideo',
        model: 'gemini-omni-1.1-flash',
        pkg: '@tanstack/ai-gemini',
        provider: 'Google',
      },
      {
        name: 'MiniMax H3',
        adapter: 'falVideo',
        model: 'minimax/h3/image-to-video',
        pkg: '@tanstack/ai-fal',
        provider: 'fal',
      },
    ],
    clientCode: `import { fetchServerSentEvents, useGenerateVideo } from '@tanstack/ai-react'

const prompt =
  'Now make it move. A short launch film, ' +
  'with the palm swaying in a soft breeze.'

export function LaunchFilm() {
  const { generate, result, videoStatus, isLoading } = useGenerateVideo({
    connection: fetchServerSentEvents('/api/video'),
  })

  return (
    <div>
      <button
        disabled={isLoading}
        onClick={() =>
          generate({
            prompt,
            artworkUrl: '/campaign-artwork.webp',
          })
        }
      >
        {isLoading ? (videoStatus?.status ?? 'Generating...') : 'Make it move'}
      </button>
      {result?.url ? <video src={result.url} controls /> : null}
    </div>
  )
}`,
  },
]

function campaignServerCode(step: CampaignStep, provider: CampaignProvider) {
  const isImage25 = provider.adapter === 'openaiImage25'
  const adapterCall = isImage25
    ? `openaiImage25('${provider.model}')`
    : `${provider.adapter}('${provider.model}')`

  const imports = isImage25
    ? `import {
  createModel,
  extendAdapter,
  generateImage,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { openaiImage } from '@tanstack/ai-openai'
import { createFileRoute } from '@tanstack/react-router'`
    : `import { ${step.activity}, toServerSentEventsResponse } from '@tanstack/ai'
import { ${provider.adapter} } from '${provider.pkg}'
import { createFileRoute } from '@tanstack/react-router'`

  const setup = isImage25
    ? `
const openaiImage25 = extendAdapter(
  openaiImage,
  [createModel('gpt-image-2.5-sunburst', ['text', 'image'])],
)
`
    : ''

  let bodyAndCall = ''
  if (step.activity === 'chat') {
    bodyAndCall = `        const { messages } = await request.json()

        const stream = chat({
          adapter: ${adapterCall},
          messages,
        })`
  } else if (step.activity === 'generateVideo') {
    bodyAndCall = `        const { prompt, artworkUrl } = await request.json()

        const stream = generateVideo({
          adapter: ${adapterCall},
          prompt: [
            { type: 'text', content: prompt },
            {
              type: 'image',
              source: {
                type: 'url',
                value: artworkUrl,
              },
            },
          ],
          stream: true,
        })`
  } else {
    bodyAndCall = `        const { prompt } = await request.json()

        const stream = generateImage({
          adapter: ${adapterCall},
          prompt,
          stream: true,
        })`
  }

  return `${imports}
${setup}
export const Route = createFileRoute('${step.route}')({
  server: {
    handlers: {
      POST: async ({ request }) => {
${bodyAndCall}

        return toServerSentEventsResponse(stream)
      },
    },
  },
})`
}

function campaignNote(step: CampaignStep, showServer: boolean) {
  if (showServer) {
    return 'A TanStack Start server route. Swap the adapter, keep the handler.'
  }
  if (step.activity === 'generateVideo') {
    return 'A React component. From job progress to a playable video.'
  }
  if (step.activity === 'generateImage') {
    return 'A React component. Prompt in. Image out. Loading state included.'
  }
  return 'A React component. Messages, streaming, and send. Ready for your UI.'
}

type ChatPhase = 'user' | 'pending' | 'result'

function stageView(
  index: number,
  stage: number,
  phase: ChatPhase,
): ChatPhase | 'hidden' {
  if (index < stage) {
    return 'result'
  }
  if (index > stage) {
    return 'hidden'
  }
  return phase
}

function CampaignTyping() {
  return (
    <div className="ai-campaign-typing" aria-label="Generating">
      <span />
      <span />
      <span />
    </div>
  )
}

function CampaignStageOutput({
  reducedMotion,
  stage,
}: {
  reducedMotion: boolean | null
  stage: number
}) {
  if (stage === 0) {
    return (
      <div className="ai-campaign-brief">
        <span>Campaign idea</span>
        <h3>
          Build something
          <br />
          that moves you.
        </h3>
        <p>
          The tools for whatever’s next.
          <br />
          The freedom to make it yours.
        </p>
        <div>
          <span>Open skies</span>
          <span>Endless possibilities</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-campaign-output">
      <div className="ai-campaign-media">
        {stage === 2 ? (
          <video
            key={String(reducedMotion)}
            autoPlay={reducedMotion === false}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/hero-palm-gradient-960.webp"
            aria-label="Sample campaign film: a palm tree moving against a pastel sky"
          >
            <source src="/images/hero-palm-motion.mp4" type="video/mp4" />
          </video>
        ) : (
          <img
            src="/images/hero-palm-gradient-960.webp"
            alt="A palm tree against a blue and pink sky, with the campaign headline Build something that moves you"
          />
        )}
        <div className="ai-campaign-art-direction" aria-hidden="true">
          <span>TanStack AI</span>
          <p>
            Build something
            <br />
            that moves you.
          </p>
        </div>
      </div>
      <div className="ai-campaign-output-meta">
        <span>
          <CheckIcon size={12} />{' '}
          {stage === 2 ? 'Launch film' : 'Campaign artwork'}
        </span>
        <span>{stage === 2 ? '0:05 · MP4' : 'Art direction · WebP'}</span>
      </div>
    </div>
  )
}

function CampaignChatPanel({
  phase,
  reducedMotion,
  stage,
}: {
  phase: ChatPhase
  reducedMotion: boolean | null
  stage: number
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = scrollerRef.current
    if (!node) {
      return
    }

    const scrollToLatest = () => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    }

    scrollToLatest()
    const frame = window.requestAnimationFrame(scrollToLatest)
    const timeoutId = window.setTimeout(scrollToLatest, 320)
    const media = [...node.querySelectorAll('img, video')]
    media.forEach((item) => {
      item.addEventListener('loadeddata', scrollToLatest)
      item.addEventListener('load', scrollToLatest)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeoutId)
      media.forEach((item) => {
        item.removeEventListener('loadeddata', scrollToLatest)
        item.removeEventListener('load', scrollToLatest)
      })
    }
  }, [phase, reducedMotion, stage])

  const composer =
    stage === 0 && phase !== 'result'
      ? 'Write a launch brief…'
      : stage === 0
        ? 'Give it a visual…'
        : stage === 1 && phase === 'result'
          ? 'Now make it move…'
          : stage === 1
            ? 'Give it a visual…'
            : 'Ask a follow-up'

  return (
    <div className="ai-campaign-chat">
      <div className="ai-campaign-chat-main">
        <div className="ai-campaign-chat-header">
          <span className="ai-campaign-chat-avatar">
            <SparkleIcon aria-hidden="true" size={16} weight="fill" />
          </span>
          <span className="ai-campaign-chat-title">
            <span>Campaign studio</span>
            <span>TanStack AI</span>
          </span>
          <span className="ai-campaign-chat-status">
            <span />
            Online
          </span>
        </div>
        <div className="ai-campaign-messages" ref={scrollerRef}>
          {campaignSteps.map((item, index) => {
            const view = stageView(index, stage, phase)
            if (view === 'hidden') {
              return null
            }

            return (
              <React.Fragment key={item.title}>
                <div className="ai-campaign-msg ai-campaign-bubble-user">
                  <p>{item.prompt}</p>
                  {index === 2 ? (
                    <div className="ai-campaign-attachment">
                      <img
                        src="/images/hero-palm-gradient-960.webp"
                        alt="Palm tree campaign artwork"
                      />
                      <span>campaign-artwork.webp</span>
                    </div>
                  ) : null}
                </div>
                {view === 'pending' ? (
                  <div className="ai-campaign-msg ai-campaign-row-assistant">
                    <span
                      className="ai-campaign-chat-avatar"
                      aria-hidden="true"
                    >
                      <SparkleIcon size={14} weight="fill" />
                    </span>
                    <CampaignTyping />
                  </div>
                ) : null}
                {view === 'result' ? (
                  <div className="ai-campaign-msg ai-campaign-row-assistant">
                    <span
                      className="ai-campaign-chat-avatar"
                      aria-hidden="true"
                    >
                      <SparkleIcon size={14} weight="fill" />
                    </span>
                    <div className="ai-campaign-assistant-body">
                      <p>{item.reply}</p>
                      <CampaignStageOutput
                        reducedMotion={reducedMotion}
                        stage={index}
                      />
                    </div>
                  </div>
                ) : null}
              </React.Fragment>
            )
          })}
        </div>
      </div>
      <div className="ai-campaign-composer">
        <div className="ai-campaign-composer-field">
          <span>{composer}</span>
          <span aria-hidden="true">
            <ArrowRightIcon size={14} weight="bold" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function AiCampaignHero() {
  const [step, setStep] = React.useState(0)
  const [phase, setPhase] = React.useState<ChatPhase>('user')
  const [pinned, setPinned] = React.useState(false)
  const [showServer, setShowServer] = React.useState(false)
  const [providerIndices, setProviderIndices] = React.useState([0, 0, 0])
  const reducedMotion = usePrefersReducedMotion()
  const current = campaignSteps[step] ?? campaignSteps[0]!
  const provider =
    current.providers[providerIndices[step]] ?? current.providers[0]!
  const serverCode = campaignServerCode(current, provider)
  const sample = showServer ? serverCode : current.clientCode

  React.useEffect(() => {
    if (reducedMotion === true && !pinned) {
      setStep(2)
      setPhase('result')
    }
  }, [pinned, reducedMotion])

  React.useEffect(() => {
    if (pinned || reducedMotion !== false) {
      return
    }

    const delay = phase === 'user' ? 900 : phase === 'pending' ? 1600 : 2600
    const timeoutId = window.setTimeout(() => {
      if (phase === 'user') {
        setPhase('pending')
        return
      }
      if (phase === 'pending') {
        setPhase('result')
        return
      }
      if (step < campaignSteps.length - 1) {
        setStep(step + 1)
        setPhase('user')
        setShowServer(false)
        return
      }
      setStep(0)
      setPhase('user')
      setShowServer(false)
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [phase, pinned, reducedMotion, step])

  const stopOnStage = (index: number) => {
    setPinned(true)
    setStep(index)
    setPhase('result')
    setShowServer(false)
  }

  return (
    <div className="ai-campaign-hero">
      <div className="ai-campaign-heading">
        <span>
          <SparkleIcon size={19} weight="duotone" /> Campaign studio
        </span>
        <span>Built with TanStack AI</span>
      </div>
      <div
        className="ai-campaign-steps"
        role="group"
        aria-label="Campaign stage"
      >
        {campaignSteps.map((item, index) => (
          <React.Fragment key={item.title}>
            {index > 0 ? (
              <ArrowRightIcon
                className="ai-campaign-step-arrow"
                size={12}
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              aria-pressed={step === index}
              onClick={() => stopOnStage(index)}
            >
              <item.icon
                size={15}
                weight={step === index ? 'fill' : 'regular'}
              />
              <span>{item.title}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="ai-campaign-workspace">
        <div className="ai-campaign-code">
          <div className="ai-campaign-code-main">
            <div className="ai-campaign-code-heading">
              <CodeIcon size={15} />
              <span>{showServer ? current.serverFile : current.file}</span>
            </div>
            <div
              className="ai-campaign-code-tabs"
              role="group"
              aria-label="Code example"
            >
              <button
                type="button"
                aria-pressed={!showServer}
                onClick={() => setShowServer(false)}
              >
                Client
              </button>
              <button
                type="button"
                aria-pressed={showServer}
                onClick={() => setShowServer(true)}
              >
                Server route
              </button>
            </div>
            <CodeBlock
              key={`${current.file}-${showServer}-${provider.name}`}
              className="m-0 border-0 bg-transparent [&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:bg-transparent [&_pre]:px-4 [&_pre]:py-4 [&_pre]:text-[11px] [&_pre]:leading-[1.7] sm:[&_pre]:text-xs"
              showTypeCopyButton={false}
            >
              <code className={showServer ? 'language-ts' : 'language-tsx'}>
                {sample}
              </code>
            </CodeBlock>
            <div className="ai-campaign-hook-note">
              <span>{showServer ? current.activity : current.hook}</span>
              <p>{campaignNote(current, showServer)}</p>
            </div>
          </div>
          <div className="ai-campaign-providers">
            <p id="ai-campaign-provider-label">Swap the model</p>
            <div
              className="ai-campaign-provider-chips"
              role="group"
              aria-labelledby="ai-campaign-provider-label"
            >
              {current.providers.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={providerIndices[step] === index}
                  onClick={() => {
                    setProviderIndices((indices) =>
                      indices.map((value, itemIndex) =>
                        itemIndex === step ? index : value,
                      ),
                    )
                    setShowServer(true)
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <p>Via {provider.provider}. The client component stays the same.</p>
          </div>
        </div>

        <CampaignChatPanel
          phase={phase}
          reducedMotion={reducedMotion}
          stage={step}
        />
      </div>
      <div className="ai-campaign-caption">
        <span>One campaign. More than chat.</span>
        <span>Text → image → video</span>
      </div>
    </div>
  )
}
