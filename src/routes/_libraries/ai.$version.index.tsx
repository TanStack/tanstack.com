import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { aiProject } from '~/libraries/ai'
import { seo } from '~/utils/seo'
import { AILibraryHero } from '~/components/AILibraryHero'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { ossStatsQuery } from '~/queries/stats'
import { LibraryHero } from '~/components/LibraryHero'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'

const library = getLibrary('ai')

export const Route = createFileRoute('/_libraries/ai/$version/')({
  component: AIVersionIndex,
  head: () => ({
    meta: seo({
      title: aiProject.name,
      description: aiProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function AIVersionIndex() {
  const { version } = Route.useParams()

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
      <AILibraryHero
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
            TanStack AI is a pure open-source ecosystem of libraries and
            standards, not a service. We connect you directly to the AI
            providers you choose, with no middleman, no service fees, and no
            vendor lock-in. Just powerful, type-safe tools built by and for the
            community.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mx-auto max-w-[90vw] sm:max-w-[600px] lg:max-w-[1200px]">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🖥️ Server Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Use any backend server you want. Well-documented protocol with
              libraries for TypeScript, PHP, Python, and more.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">📱 Client Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Vanilla client library (@tanstack/ai-client) or framework
              integrations for React, Solid, and more coming soon.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🔌 Service Agnostic</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Connect to OpenAI, Anthropic, Gemini, and Ollama out of the box.
              Create custom adapters for any provider.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🛠️ Full Tooling Support</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Complete support for client and server tools, including tool
              approvals and execution control.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🧠 Thinking & Reasoning</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Full support for thinking and reasoning models with
              thinking/reasoning tokens streamed to clients.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🎯 Fully Type-Safe</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Complete type safety across providers, models, and model options
              from end to end.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">🔍 Next-Gen DevTools</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              Amazing developer tools that show you everything happening with
              your AI connections in real-time.
            </p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs p-6 transition-all duration-300 ease-out bg-white dark:bg-gray-900 hover:shadow-sm hover:border-pink-500/50 hover:-translate-y-1">
            <h4 className="text-xl font-bold mb-3">💚 Pure Open Source</h4>
            <p className="opacity-90 text-sm leading-relaxed">
              No hidden service, no fees, no upsells. Community-supported
              software connecting you directly to your chosen providers.
            </p>
          </div>
        </div>
      </div>

      <MaintainersSection libraryId="ai" />
      <PartnersSection libraryId="ai" />
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
