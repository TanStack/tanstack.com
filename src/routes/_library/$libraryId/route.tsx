import { createFileRoute } from '@tanstack/react-router'
import { notFound, Outlet } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { findLibrary, LibraryId } from '~/libraries'
import { seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'

export const Route = createFileRoute('/_library/$libraryId')({
  params: {
    parse: (params) => {
      return params as { libraryId: LibraryId }
    },
  },
  beforeLoad: (ctx) => {
    const library = findLibrary(ctx.params.libraryId)

    if (!library) {
      throw notFound()
    }
  },
  loader: (ctx) => {
    const library = findLibrary(ctx.params.libraryId)

    if (!library) {
      throw notFound()
    }
  },
  head: (ctx) => {
    const library = findLibrary(ctx.params.libraryId)

    if (!library) {
      return {
        meta: seo({
          title: '404 Not Found',
        }),
      }
    }

    return {
      meta: seo({
        title: library.name
          ? `${library.name} | ${library.frameworks
              .map(
                (framework) =>
                  `${framework.charAt(0).toUpperCase()}${framework.slice(
                    1,
                  )} ${library.name.replace('TanStack ', '')}`,
              )
              .join(', ')}`
          : '',
        description: library.description,
        image: ogImageUrl(library.id),
        noindex: library.visible === false,
      }),
    }
  },
  component: RouteForm,
})

function RouteForm() {
  const { libraryId } = Route.useParams()
  const library = findLibrary(libraryId)

  if (!library) {
    return null
  }

  return (
    <>
      <Outlet />
      {library?.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}
