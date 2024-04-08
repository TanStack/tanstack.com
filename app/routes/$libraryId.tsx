import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Scarf } from '~/components/Scarf'
import { getLibrary } from '~/libraries'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/$libraryId')({
  component: RouteForm,
  meta: (ctx) => {
    const library = getLibrary(ctx.params.libraryId)

    return seo({
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
      description: library?.description,
      image: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
    })
  },
})

export default function RouteForm() {
  const { libraryId } = Route.useParams()
  const library = getLibrary(libraryId)

  return (
    <>
      <Outlet />
      {library.scarfId ? <Scarf id={library.scarfId} /> : null}
    </>
  )
}
