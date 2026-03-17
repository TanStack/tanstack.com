import {
  Outlet,
  redirect,
  notFound,
  createFileRoute,
} from '@tanstack/react-router'
import { RedirectVersionBanner } from '~/components/RedirectVersionBanner'
import { findLibrary, getBranch } from '~/libraries'
import { getTanstackDocsConfig } from '~/utils/config'

export const Route = createFileRoute('/$libraryId/$version')({
  staleTime: 1000 * 60 * 5,
  beforeLoad: (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    library.handleRedirects?.(ctx.location.href)

    if (!library.availableVersions.concat('latest').includes(version!)) {
      throw redirect({
        params: { libraryId, version: 'latest' } as never,
      })
    }
  },
  loader: async (ctx) => {
    const { libraryId, version } = ctx.params
    const library = findLibrary(libraryId)

    if (!library) {
      throw notFound()
    }

    const branch = getBranch(library, version)
    const config = await getTanstackDocsConfig({
      data: {
        repo: library.repo,
        branch,
        docsRoot: library.docsRoot || 'docs',
      },
    })

    return { config }
  },
  component: RouteForm,
})

function RouteForm() {
  const { libraryId, version } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    throw notFound()
  }

  return (
    <>
      <Outlet />
      <RedirectVersionBanner
        version={version!}
        latestVersion={library.latestVersion}
      />
    </>
  )
}
