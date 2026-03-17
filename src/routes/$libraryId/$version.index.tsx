import {
  useMatch,
  redirect,
  Link,
  notFound,
  createFileRoute,
} from '@tanstack/react-router'
import { DocsLayout } from '~/components/DocsLayout'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { seo } from '~/utils/seo'

import { Button } from '~/ui'
import { ConfigSchema } from '~/utils/config'
import type { ComponentType } from 'react'

import QueryLanding from '~/components/landing/QueryLanding'
import RouterLanding from '~/components/landing/RouterLanding'
import TableLanding from '~/components/landing/TableLanding'
import FormLanding from '~/components/landing/FormLanding'
import StartLanding from '~/components/landing/StartLanding'
import StoreLanding from '~/components/landing/StoreLanding'
import VirtualLanding from '~/components/landing/VirtualLanding'
import RangerLanding from '~/components/landing/RangerLanding'
import PacerLanding from '~/components/landing/PacerLanding'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import ConfigLanding from '~/components/landing/ConfigLanding'
import DbLanding from '~/components/landing/DbLanding'
import AiLanding from '~/components/landing/AiLanding'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import CliLanding from '~/components/landing/CliLanding'
import IntentLanding from '~/components/landing/IntentLanding'

const landingComponents: Partial<Record<LibraryId, ComponentType>> = {
  query: QueryLanding,
  router: RouterLanding,
  table: TableLanding,
  form: FormLanding,
  start: StartLanding,
  store: StoreLanding,
  virtual: VirtualLanding,
  ranger: RangerLanding,
  pacer: PacerLanding,
  hotkeys: HotkeysLanding,
  config: ConfigLanding,
  db: DbLanding,
  ai: AiLanding,
  devtools: DevtoolsLanding,
  cli: CliLanding,
  intent: IntentLanding,
}

export const Route = createFileRoute('/$libraryId/$version/')({
  head: (ctx) => {
    const { libraryId } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    return {
      meta: seo({
        title: library.name,
        description: library.description,
        noindex: library.visible === false,
      }),
    }
  },
  beforeLoad: ({ params }) => {
    const { libraryId, version } = params
    // Libraries without landing pages redirect directly to docs
    if (!landingComponents[libraryId as LibraryId]) {
      throw redirect({
        to: '/$libraryId/$version/docs',
        params: { libraryId, version } as never,
      })
    }
    return undefined as never
  },
  // Stats load via Suspense in OpenSourceStats — no need to block the route loader
  component: LibraryVersionIndex,
})

function LibraryVersionIndex() {
  const { libraryId, version } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }
  const versionMatch = useMatch({ from: '/$libraryId/$version' })
  const { config } = versionMatch.loaderData as { config: ConfigSchema }

  const LandingComponent = landingComponents[libraryId as LibraryId]

  if (!LandingComponent) {
    return (
      <DocsLayout
        name={library.name.replace('TanStack ', '')}
        version={version === 'latest' ? library.latestVersion : version!}
        colorFrom={library.accentColorFrom ?? library.colorFrom}
        colorTo={library.accentColorTo ?? library.colorTo}
        textColor={library.accentTextColor ?? library.textColor ?? ''}
        config={config}
        frameworks={library.frameworks}
        versions={library.availableVersions}
        repo={library.repo}
        isLandingPage
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <h1 className="text-2xl font-bold">{library.name}</h1>
          <p className="text-gray-600">{library.description}</p>
          <Button
            as={Link}
            to="/$libraryId/$version/docs"
            params={{ libraryId, version } as never}
          >
            View Documentation
          </Button>
        </div>
      </DocsLayout>
    )
  }

  return (
    <DocsLayout
      name={library.name.replace('TanStack ', '')}
      version={version === 'latest' ? library.latestVersion : version!}
      colorFrom={library.accentColorFrom ?? library.colorFrom}
      colorTo={library.accentColorTo ?? library.colorTo}
      textColor={library.accentTextColor ?? library.textColor ?? ''}
      config={config}
      frameworks={library.frameworks}
      versions={library.availableVersions}
      repo={library.repo}
      isLandingPage
    >
      <LandingComponent />
    </DocsLayout>
  )
}
