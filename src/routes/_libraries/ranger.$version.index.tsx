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
import OpenSourceStats, { ossStatsQuery } from '~/components/OpenSourceStats'

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
            className: 'bg-slate-500 text-white',
          }}
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <LazySponsorSection />

        <PartnersSection libraryId="ranger" />

        <LandingPageGad />

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
          <div className="relative w-full bg-white/50 dark:bg-black/50 rounded-lg overflow-hidden shadow-xl">
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
        <BottomCTA
          linkProps={{
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id, version },
          }}
          label="Get Started!"
          className="bg-slate-500 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
