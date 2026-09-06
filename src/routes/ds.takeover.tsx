import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import {
  Button,
  Takeover,
  TakeoverContent,
  TakeoverDescription,
  TakeoverTitle,
  type TakeoverScrim,
} from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/takeover')({
  component: TakeoverPage,
  head: () => ({
    meta: seo({
      title: 'Takeover | TanStack Design System',
      description: 'The full-bleed, immersive overlay posture.',
    }),
  }),
})

function TakeoverPage() {
  const [scrim, setScrim] = React.useState<TakeoverScrim | null>(null)
  const [withLeading, setWithLeading] = React.useState(false)

  return (
    <DsPage
      title="Takeover"
      description="The full-bleed posture. Unlike Dialog and Drawer there is no panel — content fills the viewport and scrolls edge to edge, with the close affordance floating over it. Use it when the overlay is the destination rather than something shown alongside the page. Source: src/components/ds/ui/Takeover.tsx."
    >
      <DsSection
        title="Scrims"
        description="The two scrims the overlay audit asked for, after finding seven hand-picked values. `standard` dims the page with the shared --color-scrim. `glass` dissolves it behind a heavy blur, for takeovers that should feel like a new surface rather than a layer over the old one."
      >
        <ComponentPreview
          code={`<Takeover open={open} onOpenChange={setOpen}>
  <TakeoverContent scrim="glass">
    <TakeoverTitle>All Libraries</TakeoverTitle>
    …
  </TakeoverContent>
</Takeover>`}
        >
          <div className="flex flex-wrap gap-2">
            {(['standard', 'glass'] as const).map((s) => (
              <Button
                key={s}
                variant="secondary"
                size="sm"
                onClick={() => setScrim(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Takeover
            open={scrim !== null}
            onOpenChange={(open) => !open && setScrim(null)}
          >
            <TakeoverContent scrim={scrim ?? 'standard'}>
              <div className="mx-auto w-full max-w-3xl px-6 py-24">
                <TakeoverTitle className="font-ds-display text-3xl font-medium text-text-primary">
                  scrim=&quot;{scrim}&quot;
                </TakeoverTitle>
                <TakeoverDescription className="mt-3 text-text-secondary">
                  The content is the scroll container. Clicking its empty space
                  dismisses, which is why a takeover does not need a separate
                  backdrop element.
                </TakeoverDescription>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border-default bg-background-surface p-5"
                    >
                      <p className="font-medium text-text-primary">
                        Card {i + 1}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        Content scrolls edge to edge.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TakeoverContent>
          </Takeover>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Leading action"
        description="`leading` floats an action opposite the close button. The libraries overlay uses it for a mobile-only Back control, since on small screens the takeover replaces a menu the user was already inside."
      >
        <ComponentPreview
          code={`<TakeoverContent
  scrim="glass"
  leading={
    <button onClick={onBack}>
      <ArrowLeftIcon /> Back to menu
    </button>
  }
/>`}
        >
          <Button variant="secondary" onClick={() => setWithLeading(true)}>
            Open with Back
          </Button>
          <Takeover open={withLeading} onOpenChange={setWithLeading}>
            <TakeoverContent
              scrim="glass"
              leading={
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-background-subtle px-3 font-ds-display text-ds-body-md font-medium text-text-primary transition-colors hover:bg-surface-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <ArrowLeftIcon className="size-5" />
                  Back to menu
                </button>
              }
            >
              <div className="mx-auto w-full max-w-3xl px-6 py-24">
                <TakeoverTitle className="font-ds-display text-3xl font-medium text-text-primary">
                  Leading action
                </TakeoverTitle>
                <TakeoverDescription className="mt-3 text-text-secondary">
                  Both floating controls sit above the scrolling content and
                  stay put as it moves.
                </TakeoverDescription>
              </div>
            </TakeoverContent>
          </Takeover>
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Notes"
        description="What the takeover owns, and what it deliberately leaves to the caller."
      >
        <ul className="flex flex-col gap-2 text-sm text-text-secondary">
          {[
            'No panel and no header bar. TakeoverTitle / TakeoverDescription go wherever the content wants them — visible or sr-only.',
            'The content element is the scroll container, so a takeover never nests a second scrollbar.',
            'Clicking the content’s own empty space dismisses. It routes through the same close button rather than a second dismissal path that could drift from it.',
            'onInteractOutside is forwarded, for content that portals menus of its own and must not close when they are clicked.',
            'The surface fades rather than slides: nothing is arriving from an edge, the whole surface is being replaced.',
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-[9px] size-1 shrink-0 rounded-full bg-text-muted" />
              {line}
            </li>
          ))}
        </ul>
      </DsSection>
    </DsPage>
  )
}
