import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/partners/ag-grid')({
  component: AgGridLayout,
})

function AgGridLayout() {
  return <Outlet />
}
