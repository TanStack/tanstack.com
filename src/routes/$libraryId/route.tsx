import { notFound, Outlet, redirect, rootRouteId } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'

export const Route = createFileRoute({
  component: RouteForm,
  beforeLoad: (ctx) => {
    const { libraryId } = ctx.params
    const library = getLibrary(libraryId, { strict: false })

    if (!library) {
      throw notFound({
        routeId: rootRouteId,
      })
    }
  },
  head: (ctx) => {
    const library = getLibrary(ctx.params.libraryId, { strict: false })

    if (!library) {
      return {
        meta: seo({
          title: 'Not Found',
        }),
      }
    }

    return {
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
    }
  },
})

export default function RouteForm() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)

  return (
    <>
      <Outlet />
      {library?.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}
