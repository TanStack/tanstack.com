import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { dsNav } from '~/components/ds/ds-nav'

export const Route = createFileRoute('/ds')({
  component: DesignSystemLayout,
  head: () => ({
    meta: seo({
      title: 'Design System | TanStack',
      description:
        'The TanStack Design System — living design tokens and components for use across TanStack sites, library docs, and landing pages.',
    }),
  }),
})

function DesignSystemSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border-default md:block">
      <div className="sticky top-[var(--navbar-height)] max-h-[calc(100dvh-var(--navbar-height))] overflow-y-auto px-3 py-6">
        <div className="px-3 pb-5">
          <div className="font-ds-display text-ds-heading-5 text-text-primary">
            Design System
          </div>
          <div className="font-ds-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
            TanStack DS · v0
          </div>
        </div>
        <nav className="space-y-6">
          {dsNav.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-1.5 font-ds-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === '/ds' }}
                      className="block rounded-md px-3 py-1.5 text-sm transition-colors"
                      activeProps={{
                        className:
                          'font-medium bg-background-subtle text-text-primary',
                      }}
                      inactiveProps={{
                        className:
                          'text-text-secondary hover:bg-background-subtle hover:text-text-primary',
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function DesignSystemLayout() {
  return (
    <div className="flex w-full flex-1 bg-background-default text-text-primary">
      <DesignSystemSidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
