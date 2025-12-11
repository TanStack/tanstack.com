import { createFileRoute } from '@tanstack/react-router'
import { FaCheckCircle } from 'react-icons/fa'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { LibraryHero } from '~/components/LibraryHero'
import { BottomCTA } from '~/components/BottomCTA'
import { configProject } from '~/libraries/config'
import { getLibrary } from '~/libraries'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import { seo } from '~/utils/seo'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import OpenSourceStats from '~/components/OpenSourceStats'
import { ossStatsQuery } from '~/queries/stats'
import { AdGate } from '~/contexts/AdsContext'
import { GamHeader } from '~/components/Gam'

const library = getLibrary('config')

export const Route = createFileRoute('/_libraries/config/$version/')({
  component: FormVersionIndex,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(ossStatsQuery({ library }))
  },
  head: () => ({
    meta: seo({
      title: configProject.name,
      description: configProject.description,
    }),
  }),
})

function FormVersionIndex() {
  // sponsorsPromise no longer needed - using lazy loading

  return (
    <>
      <div className="flex flex-col gap-20 md:gap-32 pt-32">
        <LibraryHero
          project={configProject}
          actions={
            <a
              href={`/config/latest/docs`}
              className="inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors bg-gray-500 text-white"
            >
              Get Started
            </a>
          }
        />

        <div className="w-fit mx-auto px-4">
          <OpenSourceStats library={library} />
        </div>
        <AdGate>
          <GamHeader />
        </AdGate>

        <LibraryFeatureHighlights
          featureHighlights={library.featureHighlights}
        />

        <div className="px-4 sm:px-6 lg:px-8 mx-auto container">
          <div className=" sm:text-center pb-16">
            <h3 className="text-3xl text-center mx-auto leading-tight font-extrabold tracking-tight sm:text-4xl lg:leading-none mt-2">
              Hassle-Free Setup
            </h3>
            <p className="mt-4 text-xl max-w-3xl mx-auto leading-7 opacity-60">
              Incorporate TanStack Config into your development toolkit and
              experience a new level of efficiency, speed, and customization in
              building and releasing high-quality JavaScript packages.
            </p>
          </div>
          <div className="grid grid-flow-row grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-4 w-max mx-auto">
            {[
              // A list of features that @tanstack/config provides
              'Vite ecosystem',
              'Opinionated defaults',
              'Publint-compliant',
              'Minimal configuration',
              'Package versioning',
              'Automated changelogs',
            ].map((d, i) => {
              return (
                <span key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-green-500 " /> {d}
                </span>
              )
            })}
          </div>
        </div>

        <PartnersSection libraryId="config" />

        <LazySponsorSection />

        <LandingPageGad />

        <BottomCTA
          linkProps={{
            to: '/$libraryId/$version/docs',
            params: { libraryId: library.id },
          }}
          label="Get Started!"
          className="bg-gray-500 text-white"
        />
        <Footer />
      </div>
    </>
  )
}
