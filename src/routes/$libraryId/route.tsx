import { notFound, Outlet, rootRouteId } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { findLibrary, getLibrary, LibraryId } from '~/libraries'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  params: {
    parse: (params) => {
      return params as { libraryId: LibraryId }
    },
  },
  loader: (ctx) => {
    const library = findLibrary(ctx.params.libraryId as any)

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
                    1
                  )} ${library.name.replace('TanStack ', '')}`
              )
              .join(', ')}`
          : '',
        description: library.description,
        image: library.ogImage,
      }),
    }
  },
  component: RouteForm,
})

export default function RouteForm() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId as any)

  return (
    <>
      <Outlet />
      {library?.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}
