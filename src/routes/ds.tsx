import * as React from 'react'
import { CaretRightIcon as CaretRight } from '@phosphor-icons/react'
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { dsNav, toDsSectionId } from '~/components/ds/ds-nav'

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
  const location = useLocation()
  const [expandedPath, setExpandedPath] = React.useState<string | null>(
    location.pathname,
  )
  const cancelScrollRef = React.useRef<() => void>(() => {})

  React.useEffect(() => {
    setExpandedPath(location.pathname)
  }, [location.pathname])

  React.useEffect(() => () => cancelScrollRef.current(), [])

  const navigateToSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
    path: string,
    sectionId: string,
  ) => {
    if (path !== location.pathname) return

    const target = document.getElementById(sectionId)
    if (!target) return

    event.preventDefault()
    window.history.pushState(null, '', `#${sectionId}`)
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (event.detail === 0 || reducedMotion) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' })
      return
    }

    cancelScrollRef.current()
    const start = window.scrollY
    const scrollMargin = Number.parseFloat(
      window.getComputedStyle(target).scrollMarginTop,
    )
    const destination =
      start + target.getBoundingClientRect().top - scrollMargin
    const distance = destination - start
    const duration = Math.min(480, Math.max(300, Math.abs(distance) * 0.4))
    const startedAt = performance.now()
    let frame = 0

    const cancel = () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('pointerdown', cancel)
      window.removeEventListener('keydown', cancel)
    }

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 5)
      window.scrollTo(0, start + distance * eased)

      if (progress < 1) {
        frame = window.requestAnimationFrame(step)
      } else {
        cancel()
      }
    }

    cancelScrollRef.current = cancel
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('pointerdown', cancel, { passive: true })
    window.addEventListener('keydown', cancel)
    frame = window.requestAnimationFrame(step)
  }

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
        <nav className="divide-y divide-border-subtle">
          {dsNav.map((section) => (
            <div key={section.title} className="py-3 first:pt-0 last:pb-0">
              <div className="px-3 pb-1.5 font-ds-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const expanded = expandedPath === item.to
                  const hasSections = (item.sections?.length ?? 0) > 1

                  return (
                    <li key={item.to}>
                      <div className="flex items-center gap-0.5">
                        <Link
                          to={item.to}
                          activeOptions={{ exact: item.to === '/ds' }}
                          onClick={() => setExpandedPath(item.to)}
                          className="min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm transition-colors"
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
                        {hasSections ? (
                          <button
                            type="button"
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label} sections`}
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedPath(expanded ? null : item.to)
                            }
                            className="grid size-7 shrink-0 place-items-center rounded-md text-text-muted hover:bg-background-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                          >
                            <CaretRight
                              size={14}
                              className={expanded ? 'rotate-90' : undefined}
                            />
                          </button>
                        ) : null}
                      </div>
                      {expanded && hasSections && item.sections ? (
                        <ul className="ml-3.5 mt-1 space-y-0.5 border-l border-border-subtle pl-2">
                          {item.sections.map((subsection) => (
                            <li key={subsection}>
                              <a
                                href={`${item.to}#${toDsSectionId(subsection)}`}
                                onClick={(event) =>
                                  navigateToSection(
                                    event,
                                    item.to,
                                    toDsSectionId(subsection),
                                  )
                                }
                                className="block rounded-md px-2 py-1 text-xs text-text-muted hover:bg-background-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                              >
                                {subsection}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
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
