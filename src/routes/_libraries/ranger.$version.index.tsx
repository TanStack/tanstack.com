import { createFileRoute } from '@tanstack/react-router'
import { rangerProject } from '~/libraries/ranger'
import { Footer } from '~/components/Footer'
import { LazySponsorSection } from '~/components/LazySponsorSection'
import { BottomCTA } from '~/components/BottomCTA'
import { LibraryHero } from '~/components/LibraryHero'
import { getBranch, getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'
import { LibraryFeatureHighlights } from '~/components/LibraryFeatureHighlights'
import LandingPageGad from '~/components/LandingPageGad'
import { PartnersSection } from '~/components/PartnersSection'
import { MaintainersSection } from '~/components/MaintainersSection'
import { ossStatsQuery } from '~/queries/stats'
import { LibraryPageContainer } from '~/components/LibraryPageContainer'
import { LibraryStatsSection } from '~/components/LibraryStatsSection'
import { StackBlitzSection } from '~/components/StackBlitzSection'

const library = getLibrary('ranger')

export const Route = createFileRoute('/_libraries/ranger/$version/')({
  component: RangerVersionIndex,
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

function RangerVersionIndex() {
  const { version } = Route.useParams()
  const branch = getBranch(rangerProject, version)

  return (
    <LibraryPageContainer>
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

      <LibraryStatsSection library={library} />

      <LibraryFeatureHighlights
        featureHighlights={rangerProject.featureHighlights}
      />

      <div className="flex flex-col gap-4">
        <div className="px-4 sm:px-6 lg:px-8 mx-auto container max-w-3xl">
          <h3 className="text-3xl font-bold">Take it for a spin!</h3>
          <p className="my-4 text-xl leading-7 text-gray-600">
            Let's see it in action!
          </p>
        </div>
      </div>

      <StackBlitzSection
        project={rangerProject}
        branch={branch}
        examplePath="examples/${framework}/basic"
        title="tannerlinsley/react-ranger: basic"
      />

      <MaintainersSection libraryId="ranger" />
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
    </LibraryPageContainer>
  )
}
