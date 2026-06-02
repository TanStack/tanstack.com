import type { ComponentType } from 'react'
import {
  Link,
  createFileRoute,
  notFound,
  redirect,
} from '@tanstack/react-router'
import AiLanding from '~/components/landing/AiLanding'
import CliLanding from '~/components/landing/CliLanding'
import ConfigLanding from '~/components/landing/ConfigLanding'
import DbLanding from '~/components/landing/DbLanding'
import DevtoolsLanding from '~/components/landing/DevtoolsLanding'
import FormLanding from '~/components/landing/FormLanding'
import HotkeysLanding from '~/components/landing/HotkeysLanding'
import IntentLanding from '~/components/landing/IntentLanding'
import PacerLanding from '~/components/landing/PacerLanding'
import QueryLanding from '~/components/landing/QueryLanding'
import RangerLanding from '~/components/landing/RangerLanding'
import RouterLanding from '~/components/landing/RouterLanding'
import StartLanding from '~/components/landing/StartLanding'
import StoreLanding from '~/components/landing/StoreLanding'
import TableLanding from '~/components/landing/TableLanding'
import VirtualLanding from '~/components/landing/VirtualLanding'
import WorkflowLanding from '~/components/landing/WorkflowLanding'
import { DocsLayout } from '~/components/DocsLayout'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { Scarf } from '~/components/Scarf'
import { findLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'
import { loadLibraryConfig, validateLibraryVersion } from '../-library-landing'
import type { LandingComponentProps } from '../-library-landing'
import { fetchLandingCodeExample } from '~/utils/landing-code-example.functions'
import { seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'
import { stackBlitzEmbedHeaders } from '~/utils/stackblitz-embed'

type LibraryLandingConfig = {
  LandingComponent: ComponentType<LandingComponentProps>
  hasStackBlitzEmbed?: boolean
}

const libraryLandingConfigs: Partial<Record<LibraryId, LibraryLandingConfig>> =
  {
    ai: { LandingComponent: AiLanding },
    cli: { LandingComponent: CliLanding },
    config: { LandingComponent: ConfigLanding },
    db: { LandingComponent: DbLanding },
    devtools: { LandingComponent: DevtoolsLanding },
    form: { LandingComponent: FormLanding, hasStackBlitzEmbed: true },
    hotkeys: { LandingComponent: HotkeysLanding },
    intent: { LandingComponent: IntentLanding },
    pacer: { LandingComponent: PacerLanding },
    query: { LandingComponent: QueryLanding, hasStackBlitzEmbed: true },
    ranger: { LandingComponent: RangerLanding, hasStackBlitzEmbed: true },
    router: { LandingComponent: RouterLanding, hasStackBlitzEmbed: true },
    start: { LandingComponent: StartLanding },
    store: { LandingComponent: StoreLanding },
    table: { LandingComponent: TableLanding, hasStackBlitzEmbed: true },
    virtual: { LandingComponent: VirtualLanding, hasStackBlitzEmbed: true },
    workflow: { LandingComponent: WorkflowLanding },
  }

function getLibraryLandingConfig(libraryId: string) {
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }

  const landingConfig = libraryLandingConfigs[library.id]

  if (!landingConfig) {
    throw notFound()
  }

  return { landingConfig, library }
}

export const Route = createFileRoute('/$libraryId/$version/')({
  staleTime: 1000 * 60 * 5,
  beforeLoad: (ctx) => {
    const { library } = getLibraryLandingConfig(ctx.params.libraryId)

    library.handleRedirects?.(ctx.location.href)

    validateLibraryVersion(library.id, ctx.params.version, () => {
      throw redirect({ href: `/${library.id}/latest` })
    })
  },
  loader: async ({ params }) => {
    const { library } = getLibraryLandingConfig(params.libraryId)

    const [config, landingCodeExample] = await Promise.all([
      loadLibraryConfig(library.id, params.version),
      fetchLandingCodeExample({
        data: {
          libraryId: library.id,
        },
      }),
    ])

    return {
      config,
      landingCodeExampleRsc: landingCodeExample?.contentRsc ?? null,
    }
  },
  head: ({ params }) => {
    const { library } = getLibraryLandingConfig(params.libraryId)

    return {
      meta: seo({
        title: library.name,
        description: library.description,
        image: ogImageUrl(library.id),
        noindex: library.visible === false,
      }),
    }
  },
  headers: ({ params }) => {
    const { landingConfig } = getLibraryLandingConfig(params.libraryId)

    return landingConfig.hasStackBlitzEmbed ? stackBlitzEmbedHeaders : {}
  },
  staticData: {
    Title: LibraryNavbarTitle,
  },
  component: LibraryVersionIndex,
})

function LibraryVersionIndex() {
  const { libraryId, version } = Route.useParams()
  const { config, landingCodeExampleRsc } = Route.useLoaderData()
  const { landingConfig, library } = getLibraryLandingConfig(libraryId)
  const { LandingComponent } = landingConfig

  if (!config) {
    throw notFound()
  }

  return (
    <>
      <DocsLayout
        libraryId={library.id}
        name={library.name.replace('TanStack ', '')}
        version={version === 'latest' ? library.latestVersion : version}
        colorFrom={library.accentColorFrom ?? library.colorFrom}
        colorTo={library.accentColorTo ?? library.colorTo}
        textColor={library.accentTextColor ?? library.textColor ?? ''}
        config={config}
        frameworks={library.frameworks}
        versions={library.availableVersions}
        repo={library.repo}
        isLandingPage
      >
        <LandingComponent landingCodeExampleRsc={landingCodeExampleRsc} />
      </DocsLayout>
      <RedirectVersionBanner
        version={version}
        latestVersion={library.latestVersion}
      />
      {library.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}

function LibraryNavbarTitle() {
  const { libraryId, version } = Route.useParams()
  const { library } = getLibraryLandingConfig(libraryId)
  const libraryName = library.name.replace('TanStack ', '')
  const resolvedVersion = version === 'latest' ? library.latestVersion : version
  const gradientText = `inline-block text-transparent bg-clip-text bg-linear-to-r ${library.colorFrom} ${library.colorTo}`

  return (
    <Link
      to="/$libraryId"
      params={{ libraryId: library.id }}
      className="relative whitespace-nowrap"
    >
      <span className={gradientText}>{libraryName}</span>{' '}
      <span className="text-sm absolute right-0 top-0 font-normal normal-case">
        {resolvedVersion}
      </span>
      <span className="text-sm opacity-0 normal-case">{resolvedVersion}</span>
    </Link>
  )
}
