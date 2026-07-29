import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { LibrariesBrowser } from '~/components/LibrariesBrowser'
import { frameworkOptions } from '~/libraries/frameworks'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/libraries_/$framework')({
  loader: ({ params }) => {
    const framework = frameworkOptions.find(
      (option) => option.value === params.framework,
    )

    if (!framework) {
      throw notFound()
    }

    return { framework }
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData?.framework
        ? `TanStack ${loaderData.framework.label} Libraries`
        : 'TanStack Libraries by Framework',
      description: loaderData?.framework
        ? `Type-safe TanStack libraries for ${loaderData.framework.label}: routing, server state, tables, forms, virtualization, sync, AI, and tooling.`
        : 'Browse TanStack libraries by framework.',
    }),
  }),
  component: LibrariesFrameworkPage,
})

function LibrariesFrameworkPage() {
  const { framework } = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <LibrariesBrowser
      variant="page"
      activeFramework={framework.value}
      onFrameworkChange={(nextFramework) => {
        if (nextFramework) {
          void navigate({
            to: '/libraries/$framework',
            params: { framework: nextFramework },
          })
        } else {
          void navigate({ to: '/libraries' })
        }
      }}
    />
  )
}
