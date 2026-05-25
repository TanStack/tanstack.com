import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/partners')({
  staticData: {
    // Editorial top-nav surface; suppress the global left rail across all
    // /partners/* routes via this layout.
    showNavbar: false,
  },
  component: PartnersLayout,
})

function PartnersLayout() {
  return <Outlet />
}
