import { createFileRoute } from '@tanstack/react-router'
import { CaretDown } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/collapsible')({
  component: CollapsiblePage,
  head: () => ({
    meta: seo({
      title: 'Collapsible | TanStack Design System',
      description: 'The Collapsible disclosure component.',
    }),
  }),
})

function CollapsiblePage() {
  return (
    <DsPage
      title="Collapsible"
      description="A disclosure that animates open/closed via a grid-rows transition. Controlled or uncontrolled; children may be a render function exposing `open`. Source: src/components/Collapsible.tsx."
    >
      <DsSection title="Disclosure">
        <ComponentPreview
          className="block"
          code={`<Collapsible defaultOpen>
  {({ open }) => (
    <>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3">
        <span>What is TanStack?</span>
        <CaretDown className={open ? 'rotate-180' : ''} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="px-4 pb-4">…</p>
      </CollapsibleContent>
    </>
  )}
</Collapsible>`}
        >
          <Collapsible
            defaultOpen
            className="w-full max-w-md overflow-hidden rounded-lg border border-border-default bg-background-surface"
          >
            {({ open }) => (
              <>
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-primary">
                  <span>What is TanStack?</span>
                  <CaretDown
                    className={`h-4 w-4 text-icon-muted transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="px-4 pb-4 text-sm text-text-muted">
                    A suite of headless, type-safe libraries for building modern
                    web applications — Query, Router, Table, Form, and more.
                  </p>
                </CollapsibleContent>
              </>
            )}
          </Collapsible>
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
