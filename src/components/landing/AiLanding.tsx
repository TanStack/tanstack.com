import { useParams } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { aiProject } from '~/libraries/ai'
import { AILibraryHero } from '~/components/AILibraryHero'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { LazyLandingCommunitySection } from '~/components/LazyLandingCommunitySection'

const library = getLibrary('ai')

export default function AiLanding() {
  const { version } = useParams({ strict: false })

  return (
    <LibraryPageContainer>
      <LibraryHero
        project={aiProject}
        cta={{
          linkProps: {
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          },
          label: 'Get Started',
          className: 'bg-pink-500 border-pink-500 hover:bg-pink-600 text-white',
        }}
      />
      <div className="-mt-10 md:-mt-20">
        <AILibraryHero
          project={aiProject}
          cta={{
            linkProps: {
              to: '/$libraryId/$version/docs',
              params: { libraryId: library.id, version },
            },
            label: 'Get Started',
            className:
              'bg-pink-500 border-pink-500 hover:bg-pink-600 text-white',
          }}
        />
      </div>

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={aiProject.featureHighlights}
      />

      <div className="px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="pb-8">
          <h3 className="text-3xl font-bold">
            A complete AI ecosystem, not a vendor platform
          </h3>
          <p className="mt-6 text-xl leading-7 opacity-75 max-w-[90vw] sm:max-w-[500px] lg:max-w-[800px]">
            TanStack AI is open-source libraries and AG-UI-compatible standards,
            not a hosted gateway. Bring your client framework, your server
            runtime, and the AI providers you trust. There is no middleman, no
            service fee, and no vendor lock-in, just composable tools built for
            teams that want to own their AI stack.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mx-auto max-w-[90vw] sm:max-w-[600px] lg:max-w-[1200px]">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Client Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Use the headless client directly or framework bindings for React,
              Vue, Solid, Svelte, and Preact.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">AG-UI Native</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Client-to-server requests and server-to-client streams use AG-UI,
              so compatible clients and servers can interoperate.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Server Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Build endpoints in TypeScript, Python, or PHP with portable
              helpers for AG-UI events, SSE, and provider message formats.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Provider Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Official adapters cover OpenRouter, OpenAI, Anthropic, Gemini,
              Ollama, Groq, Grok/xAI, ElevenLabs, and fal.ai.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Typed Tools</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Define isomorphic tools once, run them on the client or server,
              gate them with approvals, and use provider-native tools safely.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Model-Aware Types</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Provider and model choices narrow options, tools, modalities, and
              structured outputs at compile time.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Media Generation</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Use stable APIs for image, video, speech, transcription, realtime
              voice, summarization, and generation hooks.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">Observable Runtime</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Devtools, debug logging, middleware, and observability hooks show
              what happened across your AI pipeline.
            </p>
          </div>
        </div>
      </div>

      <LazyLandingCommunitySection
        libraryId="ai"
        libraryName="TanStack AI"
        showShowcases={false}
      />
      <LazySponsorSection />
      <LandingPageGad />

      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version },
        }}
        label="Get Started!"
        className="bg-purple-500 border-purple-500 hover:bg-purple-600 text-white"
      />
      <Footer />
    </LibraryPageContainer>
  )
}
