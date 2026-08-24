import { createFileRoute } from '@tanstack/react-router'
import { CaretDownIcon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Panel,
  PanelContent,
  PanelTrigger,
} from '~/components/Panel'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/panel')({
  component: PanelPage,
  head: () => ({
    meta: seo({
      title: 'Panel | TanStack Design System',
      description: 'The Panel disclosure component.',
    }),
  }),
})

function PanelPage() {
  return (
    <DsPage
      title="Panel"
      description="A vertical or horizontal disclosure. Controlled or uncontrolled; children may be a render function exposing `open`. Source: src/components/Panel.tsx."
    >
      <DsSection title="Disclosure">
        <ComponentPreview
          className="block"
          code={`<Panel defaultOpen>
  {({ open }) => (
    <>
      <PanelTrigger className="flex w-full items-center justify-between px-4 py-3">
        <span>What is TanStack?</span>
        <CaretDownIcon className={open ? 'rotate-180' : ''} />
      </PanelTrigger>
      <PanelContent>
        <p className="px-4 pb-4">…</p>
      </PanelContent>
    </>
  )}
</Panel>`}
        >
          <Panel
            defaultOpen
            className="w-full max-w-md overflow-hidden rounded-lg border border-border-default bg-background-surface"
          >
            {({ open }) => (
              <>
                <PanelTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-primary">
                  <span>What is TanStack?</span>
                  <CaretDownIcon
                    className={`h-4 w-4 text-icon-muted transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </PanelTrigger>
                <PanelContent>
                  <p className="px-4 pb-4 text-sm text-text-muted">
                    A suite of headless, type-safe libraries for building modern
                    web applications — Query, Router, Table, Form, and more.
                  </p>
                </PanelContent>
              </>
            )}
          </Panel>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
