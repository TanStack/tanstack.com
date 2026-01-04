import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { rangerProject } from '~/libraries/ranger'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { StackBlitzEmbed } from '~/components/StackBlitzEmbed'
import { FrameworkIconTabs } from '~/components/FrameworkIconTabs'
import { LibraryHero } from '~/components/LibraryHero'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('ranger')

export const Route = createFileRoute('/_libraries/ranger/$version/')({
  component: VersionIndex,
  head: () => ({
    meta: seo({
      title: rangerProject.name,
      description: rangerProject.description,
    }),
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
})

function VersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading
  const { version } = Route.useParams()
  const branch = getBranch(rangerProject, version)
  const [framework, setFramework] = React.useState<Framework>('react')

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 max-w-full pt-32">
        <LibraryHero
          project={rangerProject}
          cta={{
            linkProps: {
              to: '/$libraryId/$version/docs',
              params: { libraryId: library.id, version },
            },
            label: 'Get Started',
            className:
              'bg-slate-500 border-slate-500 hover:bg-slate-600 text-white',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>
        <AdGate>
          <GamHeader />
        </AdGate>

        <LibraryFeatureHighlights
          featureHighlights={rangerProject.featureHighlights}
        />

        <div className="flex flex-col gap-4">
          <div className="px-4 sm:px-6 lg:px-8  mx-auto container max-w-3xl sm:text-center">
            <h3 className="text-3xl text-center leading-8 font-extrabold tracking-tight sm:text-4xl sm:leading-10 lg:leading-none mt-2">
              Take it for a spin!
            </h3>
            <p className="my-4 text-xl leading-7  text-gray-600">
              Let's see it in action!
            </p>
          </div>
        </div>

        <div className="px-4">
          <div className="relative w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-xl">
            <div className="">
              <FrameworkIconTabs
                frameworks={rangerProject.frameworks}
                value={framework}
                onChange={setFramework}
              />
            </div>
            <StackBlitzEmbed
              repo={rangerProject.repo}
              branch={branch}
              examplePath={`examples/${framework}/basic`}
              title="tannerlinsley/react-ranger: basic"
            />
          </div>
        </div>

        <PartnersSection libraryId="ranger" />

        <LazySponsorSection />

        <LandingPageGad />

        <BottomCTA
          linkProps={{
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          }}
          label="Get Started!"
          className="bg-slate-500 border-slate-500 hover:bg-slate-600 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
