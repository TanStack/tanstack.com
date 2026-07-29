import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LibrariesBrowser } from '~/components/LibrariesBrowser'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/libraries')({
  component: LibrariesPage,
  head: () => ({
    meta: seo({
      title: 'TanStack Libraries: Type-Safe Tools for Modern Web Apps',
      description:
        'Explore TanStack libraries for routing, server state, tables, forms, virtualization, sync, AI, and developer tooling.',
    }),
  }),
})

function LibrariesPage() {
  const navigate = useNavigate()

  return (
    <LibrariesBrowser
      variant="page"
      activeFramework={null}
      onFrameworkChange={(framework) => {
        if (framework) {
          void navigate({
            to: '/libraries/$framework',
            params: { framework },
          })
        }
      }}
    />
  )
}
