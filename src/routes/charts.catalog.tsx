import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/charts/catalog')({
  component: ChartsCatalogLayout,
})

function ChartsCatalogLayout() {
  return <Outlet />
}
