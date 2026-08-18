import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  SealCheckIcon,
  CaretDownIcon,
  CaretUpDownIcon,
  UserCircleIcon,
  DropIcon,
  StackIcon,
  CircleNotchIcon,
  MapPinLineIcon,
  CursorClickIcon,
  PaletteIcon,
  SparkleIcon,
  SquareIcon,
  TagIcon,
  TextTIcon,
  BrowserIcon,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { DsPage, DsSection } from '~/components/ds/DsKit'
import { PageHeader } from '~/components/ds/ui/PageHeader'
import { dsNav } from '~/components/ds/ds-nav'

// A correlating icon per section so users can orient themselves at a glance.
const SECTION_ICONS: Record<string, Icon> = {
  '/ds/colors': DropIcon,
  '/ds/typography': TextTIcon,
  '/ds/shadows': StackIcon,
  '/ds/effects': SparkleIcon,
  '/ds/palette': PaletteIcon,
  '/ds/semantic': TagIcon,
  '/ds/buttons': CursorClickIcon,
  '/ds/badges': SealCheckIcon,
  '/ds/inputs': TextTIcon,
  '/ds/dropdown': CaretDownIcon,
  '/ds/avatar': UserCircleIcon,
  '/ds/spinner': CircleNotchIcon,
  '/ds/panel': CaretUpDownIcon,
  '/ds/breadcrumbs': MapPinLineIcon,
  '/ds/cards': StackIcon,
  '/ds/navbar': BrowserIcon,
}

export const Route = createFileRoute('/ds/')({
  component: DesignSystemOverview,
  head: () => ({
    meta: seo({
      title: 'Design System | TanStack',
      description:
        'The TanStack Design System — living design tokens and components.',
    }),
  }),
})

function DesignSystemOverview() {
  return (
    <DsPage
      header={
        <PageHeader
          title="TanStack Design System"
          lede="A living catalog of the design tokens and components that power TanStack sites, library docs, and landing pages. Everything here renders with the real production styles — toggle light/dark from the navbar to preview both."
        />
      }
    >
      <DsSection
        title="How to use this"
        description="Phase 1 is a copy-paste registry. Browse a component, open its code, and copy it into your site. Tokens live in app.css and are shared across every TanStack surface."
      >
        <div className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2">
          {dsNav
            .flatMap((section) =>
              section.items
                .filter((item) => item.to !== '/ds')
                .map((item) => ({ ...item, section: section.title })),
            )
            .map((item) => {
              const Icon = SECTION_ICONS[item.to] ?? SquareIcon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center gap-3 bg-background-default px-4 py-3.5 transition-colors hover:bg-background-subtle"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center text-text-secondary transition-colors group-hover:text-text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-ds-mono text-[11px] font-medium uppercase tracking-wider text-text-muted">
                      {item.section}
                    </div>
                    <div className="font-medium text-text-primary">
                      {item.label}
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-secondary" />
                </Link>
              )
            })}
        </div>
      </DsSection>
    </DsPage>
  )
}
