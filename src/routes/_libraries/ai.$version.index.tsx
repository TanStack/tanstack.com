import { createFileRoute } from '@tanstack/react-router'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { PartnersSection } from '~/components/PartnersSection'
import { BottomCTA } from '~/components/BottomCTA'
import { aiProject } from '~/libraries/ai'
import { seo } from '~/utils/seo'
import { AILibraryHero } from '~/components/AILibraryHero'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'

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
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <AILibraryHero
          project={aiProject}
          cta={{
            linkProps: {
              to: '/$libraryId/$version/docs',
              params: { libraryId: library.id, version },
            },
            label: 'Get Started',
            className: 'bg-pink-500 text-white',
          }}
        />
        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>
        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />
        <div className="px-4 sm:px-6 lg:px-8 mx-auto">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              No vendor lock-in, just clean TypeScript
            </h3>
            <p className="mt-6 text-xl mx-auto leading-7 opacity-75 max-w-[90vw] sm:max-w-[500px] lg:max-w-[800px]">
              TanStack AI provides a unified interface across multiple AI
              providers. Switch between OpenAI, Anthropic, Ollama, and Google
              Gemini at runtime without code changes. Built with TypeScript
              first principles and zero lock-in.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-10 lg:gap-x-12 gap-y-4 mx-auto max-w-[90vw] sm:max-w-[500px] lg:max-w-[650px]">
            <div>
              <h4 className="text-xl my-2">🔌 Multi-Provider Support</h4>
              <p>OpenAI, Anthropic, Ollama, and Google Gemini.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">⚡ Automatic Tool Execution</h4>
              <p>No manual tool management needed.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">🎯 Type-Safe by Default</h4>
              <p>Full type inference from adapters.</p>
            </div>
            <div>
              <h4 className="text-xl my-2">🌟 Framework Agnostic</h4>
              <p>Works with React, Solid, and vanilla JS.</p>
            </div>
          </div>
        </div>
        <PartnersSection libraryId="ai" />
        <LazySponsorSection />
        <LandingPageGad />
        <BottomCTA
          linkProps={{
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          }}
          label="Get Started!"
          className="bg-purple-500 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
