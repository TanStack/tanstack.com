import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/charts/catalog')({
  component: ChartsCatalogLayout,
})

function ChartsCatalogLayout() {
  return (
    <>
      <nav
        aria-label="Charts catalog"
        className="border-b border-gray-200 dark:border-gray-800"
      >
        <div className="mx-auto flex max-w-[1680px] gap-5 px-4 py-3 text-sm">
          <Link
            to="/charts/catalog"
            search={true}
            activeOptions={{ exact: true }}
            activeProps={{
              className: 'font-semibold text-blue-600 dark:text-blue-400',
            }}
            inactiveProps={{
              className:
                'text-gray-500 hover:text-gray-950 dark:hover:text-white',
            }}
          >
            Catalog
          </Link>
          <Link
            to="/charts/catalog/all"
            search={true}
            activeProps={{
              className: 'font-semibold text-blue-600 dark:text-blue-400',
            }}
            inactiveProps={{
              className:
                'text-gray-500 hover:text-gray-950 dark:hover:text-white',
            }}
          >
            All
          </Link>
        </div>
      </nav>
      <Outlet />
    </>
  )
}
