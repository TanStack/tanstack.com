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

const campaignSteps = [
  {
    title: 'The brief',
    icon: PencilLineIcon,
    hook: 'useChat',
    prompt:
      'A launch campaign for TanStack AI. Something that feels like possibility, not another robot.',
    reply: 'Let’s give your next big idea a little room to grow.',
    file: 'campaign.tsx',
    serverFile: 'api/chat.ts',
    activity: 'chat',
    serverInput: '  messages,',
    providers: [
      {
        name: 'Anthropic',
        adapter: 'anthropicText',
        model: 'claude-fable-5-1',
        provider: 'Anthropic',
      },
      { name: 'Grok', adapter: 'grokText', model: 'grok-4.6', provider: 'xAI' },
      {
        name: 'OpenAI',
        adapter: 'openaiText',
        model: 'gpt-6-astra',
        provider: 'OpenAI',
      },
    ],
    code: `const {\n  messages,\n  sendMessage,\n  isLoading,\n} = useChat({\n  connection:\n    fetchServerSentEvents(\n      '/api/chat',\n    ),\n})\n\nconst onSend = () =>\n  sendMessage(brief)`,
  },
  {
    title: 'The artwork',
    icon: ImageIcon,
    hook: 'useGenerateImage',
    prompt:
      'Give it a visual. A single palm tree against a pastel sky. Leave room for the idea.',
    reply: 'One tree. An open sky. A world of possibility.',
    file: 'artwork.tsx',
    serverFile: 'api/image.ts',
    activity: 'generateImage',
    serverInput: '  prompt,\n  stream: true,',
    providers: [
      {
        name: 'GPT Image 2.5',
        adapter: 'openaiImage25',
        model: 'gpt-image-2.5-sunburst',
        provider: 'OpenAI',
      },
      {
        name: 'Nano Banana 2',
        adapter: 'geminiImage',
        model: 'gemini-3.1-flash-image',
        provider: 'Google',
      },
      {
        name: 'Grok Imagine',
        adapter: 'grokImage',
        model: 'grok-imagine-image-2.0',
        provider: 'xAI',
      },
    ],
    code: `const {\n  generate,\n  result,\n  isLoading,\n} = useGenerateImage({\n  connection:\n    fetchServerSentEvents(\n      '/api/image',\n    ),\n})\n\nconst onGenerate = () =>\n  generate({ prompt })`,
  },
  {
    title: 'The launch film',
    icon: FilmSlateIcon,
    hook: 'useGenerateVideo',
    prompt:
      'Now make it move. A short launch film, with the palm swaying in a soft breeze.',
    reply: 'Same idea. A little more life.',
    file: 'launch-film.tsx',
    serverFile: 'api/video.ts',
    activity: 'generateVideo',
    serverInput:
      "  prompt: [\n    { type: 'text', content: prompt },\n    {\n      type: 'image',\n      source: {\n        type: 'url',\n        value: artworkUrl,\n      },\n    },\n  ],\n  stream: true,",
    providers: [
      {
        name: 'Seedance 2.5',
        adapter: 'byteplusVideo',
        model: 'dreamina-seedance-2-5-260628',
        provider: 'BytePlus',
      },
      {
        name: 'Google Omni',
        adapter: 'geminiVideo',
        model: 'gemini-omni-1.1-flash',
        provider: 'Google',
      },
      {
        name: 'MiniMax H3',
        adapter: 'falVideo',
        model: 'minimax/h3/image-to-video',
        provider: 'fal',
      },
    ],
    code: `const {\n  generate,\n  result,\n  videoStatus,\n} = useGenerateVideo({\n  connection:\n    fetchServerSentEvents(\n      '/api/video',\n    ),\n})\n\nconst onGenerate = () =>\n  generate({ prompt })\n\nreturn <video\n  src={result?.url} controls\n/>`,
  },
]

export function AiCampaignHero() {
  const [step, setStep] = React.useState(2)
  const [showServer, setShowServer] = React.useState(false)
  const [providerIndices, setProviderIndices] = React.useState([0, 0, 0])
  const reducedMotion = usePrefersReducedMotion()
  const current = campaignSteps[step]
  const provider = current.providers[providerIndices[step]]
  const setup =
    provider.adapter === 'openaiImage25'
      ? `const openaiImage25 =\n  extendAdapter(\n    openaiImage,\n    [createModel(\n      'gpt-image-2.5-sunburst',\n      ['text', 'image'],\n    )],\n  )\n\n`
      : ''
  const serverCode = `${setup}const stream = ${current.activity}({\n  adapter:\n    ${provider.adapter}(\n      '${provider.model}',\n    ),\n${current.serverInput}\n})\n\nreturn toServerSentEventsResponse(\n  stream,\n)`

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
          <button
            key={item.title}
            type="button"
            aria-pressed={step === index}
            onClick={() => {
              setStep(index)
              setShowServer(false)
            }}
          >
            <item.icon size={15} />
            <span>{item.title}</span>
            {index < campaignSteps.length - 1 && (
              <ArrowRightIcon
                className="ai-campaign-step-arrow"
                size={12}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      <div className="ai-campaign-workspace">
        <div className="ai-campaign-chat">
          <div className="ai-campaign-user">
            <p>{current.prompt}</p>
            {step === 2 && (
              <div className="ai-campaign-attachment">
                <img
                  src="/images/hero-palm-gradient-960.webp"
                  alt="Palm tree campaign artwork"
                />
                <span>campaign-artwork.webp</span>
              </div>
            )}
          </div>
          <div className="ai-campaign-reply">
            <SparkleIcon size={15} weight="fill" />
            <p>{current.reply}</p>
          </div>

          {step === 0 ? (
            <div className="ai-campaign-brief">
              <span>The campaign idea</span>
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
              <hr />
              <p>
                A bright, optimistic launch. Start with one simple image, then
                bring it to life.
              </p>
            </div>
          ) : (
            <div className="ai-campaign-output">
              <div className="ai-campaign-media">
                {step === 2 ? (
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
                    <source
                      src="/images/hero-palm-motion.mp4"
                      type="video/mp4"
                    />
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
                  {step === 2 ? 'Launch film' : 'Campaign artwork'}
                </span>
                <span>
                  {step === 2 ? '0:05 · MP4' : 'Art direction · WebP'}
                </span>
              </div>
            </div>
          )}
          <div className="ai-campaign-chat-footer">
            <span>Sample conversation &amp; output</span>
            {step < 2 && (
              <button type="button" onClick={() => setStep(step + 1)}>
                {step === 0 ? 'Create the artwork' : 'Make it move'}
                <ArrowRightIcon size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="ai-campaign-code">
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
              Client hook
            </button>
            <button
              type="button"
              aria-pressed={showServer}
              onClick={() => setShowServer(true)}
            >
              Server adapter
            </button>
          </div>
          <CodeBlock
            className="m-0 border-0 bg-transparent [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:px-4 [&_pre]:py-4 [&_pre]:text-[10px] [&_pre]:leading-[1.8]"
            showTypeCopyButton={false}
          >
            <code className="language-tsx">
              {showServer ? serverCode : current.code}
            </code>
          </CodeBlock>
          <div className="ai-campaign-hook-note">
            <span>{showServer ? current.activity : current.hook}</span>
            <p>
              {step === 2
                ? 'From job progress to a playable video. Your hook handles the state.'
                : step === 1
                  ? 'Prompt in. Image out. Loading state included.'
                  : 'Messages, streaming, and conversation state. Ready for your UI.'}
            </p>
          </div>
          <div className="ai-campaign-providers">
            <label htmlFor="ai-campaign-provider">Swap the model</label>
            <select
              id="ai-campaign-provider"
              value={providerIndices[step]}
              onChange={(event) => {
                const selected = Number(event.target.value)
                setProviderIndices((indices) =>
                  indices.map((value, index) =>
                    index === step ? selected : value,
                  ),
                )
                setShowServer(true)
              }}
            >
              {current.providers.map((item, index) => (
                <option key={item.name} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
            <p>Via {provider.provider}. The client hook stays the same.</p>
          </div>
        </div>
      </div>
      <div className="ai-campaign-caption">
        <span>One campaign. More than chat.</span>
        <span>Text → image → video</span>
      </div>
    </div>
  )
}
